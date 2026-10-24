using System.Diagnostics;
using ExportService.Models;
using ExportService.Services;
using Microsoft.AspNetCore.Mvc;

namespace ExportService.Controllers
{
    /// <summary>
    /// GET /api/export/companies?{CompanyFilter}&amp;format=csv|bitrix — ровно то, что на экране: фильтр уходит в core-api
    /// исходной строкой (без format), разбирает и проверяет его core-api — здесь не дублируем.
    /// </summary>
    [ApiController]
    public class ExportController : ControllerBase
    {
        private static readonly string[] Formats = { "csv", "bitrix" };

        private readonly JwtAuthService _auth;
        private readonly CoreApiClient _core;
        private readonly ILogger<ExportController> _logger;

        public ExportController(JwtAuthService auth, CoreApiClient core, ILogger<ExportController> logger)
        {
            _auth = auth;
            _core = core;
            _logger = logger;
        }

        [HttpGet("/api/export/companies")]
        public async Task GetCompanies(CancellationToken ct)
        {
            var auth = await _auth.AuthenticateAsync(Request.Headers.Authorization.FirstOrDefault(), ct);
            if (!auth.Success)
            {
                _logger.LogWarning("{Method} {Path} -> [{Status}] {Code} | причина: {Reason}",
                    Request.Method, Request.Path, auth.Status, auth.Code, auth.Reason);
                if (auth.Status == 401)
                {
                    Response.Headers.WWWAuthenticate = "Bearer";
                }
                await Error(auth.Status, auth.Code!, auth.Message!);
                return;
            }

            var format = Request.Query["format"].FirstOrDefault() ?? "csv";
            if (!Formats.Contains(format))
            {
                await Error(400, "VALIDATION_ERROR", $"Неизвестный формат '{format}', допустимо: csv, bitrix", new { field = "format" });
                return;
            }

            var started = Stopwatch.StartNew();
            HttpResponseMessage core;
            try
            {
                core = await _core.CompaniesAsync(FilterQuery(), ct);
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
            {
                _logger.LogError("core-api не ответил: {Reason}", e.Message);
                await Error(502, "UPSTREAM_UNAVAILABLE", "Сервис данных временно недоступен — повторите позже");
                return;
            }

            using (core)
            {
                var status = (int)core.StatusCode;
                if (status is 400 or 413)
                {
                    // ответ core-api — как есть: фронту нужен details.field / details.total («сузьте фильтр, N компаний»)
                    Response.StatusCode = status;
                    Response.ContentType = "application/json; charset=utf-8";
                    await core.Content.CopyToAsync(Response.Body, ct);
                    return;
                }
                if (!core.IsSuccessStatusCode)
                {
                    _logger.LogError("core-api ответил {Status} на /internal/companies", status);
                    await Error(502, "UPSTREAM_UNAVAILABLE", "Сервис данных временно недоступен — повторите позже");
                    return;
                }

                var fileName = $"radar_{(format == "bitrix" ? "bitrix_" : "")}{DateTime.UtcNow.AddHours(3):yyyy-MM-dd}.csv";   // дата по Москве
                Response.ContentType = "text/csv; charset=utf-8";
                Response.Headers.ContentDisposition = $"attachment; filename=\"{fileName}\"; filename*=UTF-8''{Uri.EscapeDataString(fileName)}";
                await using var body = await core.Content.ReadAsStreamAsync(ct);
                var rows = await CsvExport.WriteAsync(body, Response.Body, format, ct);
                _logger.LogInformation("выгрузка {Format}: {Rows} строк за {Ms} мс, фильтр: {Query}",
                    format, rows, started.ElapsedMilliseconds, FilterQuery());
            }
        }

        /// <summary>Исходная query-строка без format — повторяющиеся параметры (industry=…&amp;industry=…) сохраняются.</summary>
        private string FilterQuery() => string.Join("&", Request.Query
            .Where(p => p.Key != "format")
            .SelectMany(p => p.Value.Select(v => $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(v ?? "")}")));

        private Task Error(int status, string code, string message, object? details = null)
        {
            Response.StatusCode = status;
            return Response.WriteAsJsonAsync(ErrorResponse.Of(code, message, details));
        }
    }
}
