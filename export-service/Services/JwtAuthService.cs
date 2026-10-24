using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;

namespace ExportService.Services
{
    /// <summary>
    /// Проверка accessToken — как в core-api и notifier (docs/tz/00-common.md, «Авторизация»):
    /// RS256, подпись по ключу из JWKS (kid), срок (допуск 60 с), iss = radar-auth, в amr есть "otp".
    /// Причина отказа — только в лог одной строкой; клиенту — общий текст.
    /// </summary>
    public class JwtAuthService
    {
        public const string Issuer = "radar-auth";

        private readonly JwksCache _jwks;
        private readonly ILogger<JwtAuthService> _logger;
        // MapInboundClaims = false: иначе claim'ы переименовываются, и "amr" не найти по имени
        private readonly JwtSecurityTokenHandler _handler = new() { MapInboundClaims = false };

        public JwtAuthService(JwksCache jwks, ILogger<JwtAuthService> logger)
        {
            _jwks = jwks;
            _logger = logger;
        }

        public async Task<AuthResult> AuthenticateAsync(string? authorization, CancellationToken ct)
        {
            if (string.IsNullOrEmpty(authorization) || !authorization.StartsWith("Bearer ", StringComparison.Ordinal))
            {
                return AuthResult.Fail(401, "UNAUTHORIZED", "Требуется вход: передайте заголовок Authorization: Bearer <accessToken>",
                    "нет заголовка Authorization");
            }
            var token = authorization["Bearer ".Length..].Trim();
            try
            {
                var kid = _handler.ReadJwtToken(token).Header.Kid;
                var keys = await _jwks.KeysForAsync(kid, ct);
                var principal = _handler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidAlgorithms = new[] { SecurityAlgorithms.RsaSha256 },
                    IssuerSigningKeys = keys,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = Issuer,
                    ValidateIssuer = true,
                    ValidateAudience = false,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(60),
                }, out _);
                // amr — массив: каждое значение приходит отдельным claim "amr", поэтому HasClaim, а не FindFirst
                if (!principal.HasClaim("amr", "otp"))
                {
                    return Reject("в amr нет \"otp\": вход без второго фактора");
                }
                return AuthResult.Ok(principal.FindFirst("sub")?.Value);
            }
            catch (JwksUnavailableException e)
            {
                return AuthResult.Fail(502, "UPSTREAM_UNAVAILABLE", "Сервис авторизации недоступен — повторите позже", e.Message);
            }
            catch (Exception e) when (e is SecurityTokenException or ArgumentException)
            {
                return Reject(e.GetType().Name);
            }
        }

        private AuthResult Reject(string reason) =>
            AuthResult.Fail(401, "UNAUTHORIZED", "Токен недействителен или истёк — войдите заново", reason);
    }

    public record AuthResult(bool Success, int Status, string? Code, string? Message, string? Reason, string? UserId)
    {
        public static AuthResult Ok(string? userId) => new(true, 200, null, null, null, userId);
        public static AuthResult Fail(int status, string code, string message, string reason) =>
            new(false, status, code, message, reason, null);
    }
}
