using System.Diagnostics;
using ExportService.Models;
using ExportService.Services;
using Microsoft.AspNetCore.Mvc;

namespace ExportService.Controllers
{
    /// <summary>
    /// GET /api/export/companies?{CompanyFilter}&amp;format=csv|bitrix и /api/export/projects?{ProjectFilter}&amp;format=… —
    /// ровно то, что на экране: фильтр уходит в core-api исходной строкой (без format), разбирает и проверяет его
    /// core-api — здесь не дублируем.
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
        public Task GetCompanies(CancellationToken ct) =>
            Export("radar", _core.CompaniesAsync, CsvExport.WriteAsync, ct);

        /// <summary>Инвестпроекты Навигатора: тот же путь, фильтр — ProjectFilter (docs/tz/06, «Продукт 2»).</summary>
        [HttpGet("/api/export/projects")]
        public Task GetProjects(CancellationToken ct) =>
            Export("navigator", _core.ProjectsAsync, ProjectCsvExport.WriteAsync, ct);

        /// <summary>
        /// Общая схема выгрузки: токен -> format -> core-api с исходным фильтром -> потоком в CSV.
        /// 400/413 core-api отдаём как есть, остальные отказы соседа — 502.
        /// </summary>
        private async Task Export(
            string filePrefix,
            Func<string, CancellationToken, Task<HttpResponseMessage>> fetch,
            Func<Stream, Stream, string, CancellationToken, Task<int>> write,
            CancellationToken ct)
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
                core = await fetch(FilterQuery(), ct);
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
                    _logger.LogError("core-api ответил {Status} на {Path}", status, core.RequestMessage?.RequestUri?.AbsolutePath);
                    await Error(502, "UPSTREAM_UNAVAILABLE", "Сервис данных временно недоступен — повторите позже");
                    return;
                }

                var fileName = $"{filePrefix}_{(format == "bitrix" ? "bitrix_" : "")}{DateTime.UtcNow.AddHours(3):yyyy-MM-dd}.csv";   // дата по Москве
                Response.ContentType = "text/csv; charset=utf-8";
                Response.Headers.ContentDisposition = $"attachment; filename=\"{fileName}\"; filename*=UTF-8''{Uri.EscapeDataString(fileName)}";
                await using var body = await core.Content.ReadAsStreamAsync(ct);
                var rows = await write(body, Response.Body, format, ct);
                _logger.LogInformation("выгрузка {Path} {Format}: {Rows} строк за {Ms} мс, фильтр: {Query}",
                    Request.Path, format, rows, started.ElapsedMilliseconds, FilterQuery());
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
