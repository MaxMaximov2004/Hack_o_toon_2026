using ExportService.Services;

// export-service: CSV / Bitrix24 по CompanyFilter. БД нет — данные только из core-api (/internal/companies).
// Конфиг — только из env: ASPNETCORE_URLS, CORE_API_URL, AUTH_JWKS_URL, INTERNAL_TOKEN (docs/tz/06-csharp-export.md).
var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(o => { o.SingleLine = true; o.TimestampFormat = "yyyy-MM-ddTHH:mm:ss "; });
builder.Logging.AddFilter("Microsoft", LogLevel.Warning);   // по строке на событие — свои строки, без служебных
builder.Logging.AddFilter("System.Net.Http", LogLevel.Warning);

builder.Services.AddControllers();
builder.Services.AddHttpClient();
builder.Services.AddHttpClient<CoreApiClient>();
builder.Services.AddSingleton<JwksCache>();
builder.Services.AddSingleton<JwtAuthService>();

var app = builder.Build();
app.MapControllers();
app.Run();
