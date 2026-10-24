using Microsoft.IdentityModel.Tokens;

namespace ExportService.Services
{
    /// <summary>
    /// Ключи проверки токенов из AUTH_JWKS_URL (auth-service). Запрашиваются лениво — при первом токене, не при старте
    /// (auth-service может подниматься дольше); кэш 10 минут; неизвестный kid — перезапрос (не чаще раза в 30 с).
    /// auth-service не ответил за 5 с — <see cref="JwksUnavailableException"/> → 502.
    /// </summary>
    public class JwksCache
    {
        private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan MinRefresh = TimeSpan.FromSeconds(30);
        private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

        private readonly IHttpClientFactory _http;
        private readonly string? _url;
        private readonly ILogger<JwksCache> _logger;
        private readonly SemaphoreSlim _lock = new(1, 1);
        private IList<SecurityKey> _keys = new List<SecurityKey>();
        private DateTimeOffset _fetchedAt = DateTimeOffset.MinValue;

        public JwksCache(IHttpClientFactory http, IConfiguration config, ILogger<JwksCache> logger)
        {
            _http = http;
            _url = config["AUTH_JWKS_URL"];
            _logger = logger;
            if (string.IsNullOrWhiteSpace(_url))
            {
                _logger.LogWarning("AUTH_JWKS_URL не задан — все запросы с токеном будут отклонены");
            }
        }

        /// <summary>Ключи, среди которых есть kid; если такого нет — один перезапрос JWKS.</summary>
        public async Task<IList<SecurityKey>> KeysForAsync(string? kid, CancellationToken ct)
        {
            var now = DateTimeOffset.UtcNow;
            bool known = _keys.Any(k => k.KeyId == kid);
            bool expired = now - _fetchedAt > Ttl;
            bool mayRefreshForKid = !known && now - _fetchedAt > MinRefresh;
            if (expired || mayRefreshForKid)
            {
                await RefreshAsync(ct);
            }
            return _keys;
        }

        private async Task RefreshAsync(CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(_url))
            {
                return;
            }
            await _lock.WaitAsync(ct);
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(Timeout);
                var json = await _http.CreateClient().GetStringAsync(_url, timeout.Token);
                _keys = new JsonWebKeySet(json).GetSigningKeys();
                _fetchedAt = DateTimeOffset.UtcNow;
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or ArgumentException)
            {
                if (_keys.Count == 0)
                {
                    throw new JwksUnavailableException(e.Message, e);
                }
                _logger.LogWarning("JWKS не обновился, работаем со старыми ключами: {Reason}", e.Message);
            }
            finally
            {
                _lock.Release();
            }
        }
    }

    public class JwksUnavailableException : Exception
    {
        public JwksUnavailableException(string message, Exception inner) : base(message, inner) { }
    }
}
