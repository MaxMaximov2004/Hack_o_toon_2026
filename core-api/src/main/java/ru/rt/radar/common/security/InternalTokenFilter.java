package ru.rt.radar.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import ru.rt.radar.common.dto.error.ErrorCode;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import static ru.rt.radar.common.util.LogPatterns.INTERNAL_TOKEN_INVALID;

/**
 * /internal/** — только для соседних сервисов: заголовок X-Internal-Token = INTERNAL_TOKEN.
 * Сравнение за постоянное время. Токен не задан в env — отклоняем всё (лучше 401, чем открытый эндпоинт).
 */
public class InternalTokenFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Internal-Token";

    private final byte[] expected;
    private final SecurityErrorWriter errors;

    public InternalTokenFilter(String token, SecurityErrorWriter errors) {
        this.expected = StringUtils.hasText(token) ? token.getBytes(StandardCharsets.UTF_8) : null;
        this.errors = errors;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/internal/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String got = request.getHeader(HEADER);
        if (expected != null && got != null && MessageDigest.isEqual(expected, got.getBytes(StandardCharsets.UTF_8))) {
            chain.doFilter(request, response);
            return;
        }
        String reason = expected == null ? "INTERNAL_TOKEN не задан" : got == null ? "нет заголовка" : "неверный токен";
        errors.write(request, response, HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED, INTERNAL_TOKEN_INVALID, reason);
    }
}
