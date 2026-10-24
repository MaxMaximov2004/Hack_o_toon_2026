namespace ExportService.Services
{
    /// <summary>
    /// core-api по HTTP: GET /internal/companies?{фильтр} с X-Internal-Token. Возвращает ответ, как только пришли
    /// заголовки (тело — потоком, до 100 000 компаний). Сосед не ответил за 5 с — исключение, контроллер даст 502.
    /// </summary>
    public class CoreApiClient
    {
        private static readonly TimeSpan HeadersTimeout = TimeSpan.FromSeconds(5);
        private readonly HttpClient _http;

        public CoreApiClient(HttpClient http, IConfiguration config)
        {
            _http = http;
            _http.BaseAddress = new Uri(config["CORE_API_URL"] ?? "http://core-api:8080");
            _http.Timeout = Timeout.InfiniteTimeSpan;          // тело большой выгрузки идёт дольше 5 с
            var token = config["INTERNAL_TOKEN"];
            if (!string.IsNullOrEmpty(token))
            {
                _http.DefaultRequestHeaders.Add("X-Internal-Token", token);
            }
        }

        public async Task<HttpResponseMessage> CompaniesAsync(string query, CancellationToken ct)
        {
            using var headers = CancellationTokenSource.CreateLinkedTokenSource(ct);
            headers.CancelAfter(HeadersTimeout);
            var url = string.IsNullOrEmpty(query) ? "/internal/companies" : "/internal/companies?" + query;
            return await _http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, headers.Token);
        }
    }
}
