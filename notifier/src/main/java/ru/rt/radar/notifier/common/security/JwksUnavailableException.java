package ru.rt.radar.notifier.common.security;

import org.springframework.security.oauth2.jwt.BadJwtException;

/**
 * Не удалось получить JWKS у auth-service (не ответил, недоступен). Наследник BadJwtException — чтобы Spring Security
 * довёл ошибку до нашего AuthenticationEntryPoint, а тот ответил 502 UPSTREAM_UNAVAILABLE, а не 500.
 */
public class JwksUnavailableException extends BadJwtException {

    public JwksUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
