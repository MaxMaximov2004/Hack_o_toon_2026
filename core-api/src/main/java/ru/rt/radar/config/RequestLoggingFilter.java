package ru.rt.radar.config;

import jakarta.servlet.AsyncEvent;
import jakarta.servlet.AsyncListener;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Одна строка лога на запрос: метод, путь, статус, время.
 * Медленнее 500 мс — WARN вместе с query-строкой (там параметры фильтра).
 * Для потоковых ответов (StreamingResponseBody) строка пишется, когда поток завершён.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger("access");
    private static final long SLOW_MS = 500;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long start = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            if (request.isAsyncStarted()) {
                request.getAsyncContext().addListener(new AsyncListener() {
                    @Override public void onComplete(AsyncEvent e) { write(request, response, start); }
                    @Override public void onTimeout(AsyncEvent e) { }
                    @Override public void onError(AsyncEvent e) { }
                    @Override public void onStartAsync(AsyncEvent e) { }
                });
            } else {
                write(request, response, start);
            }
        }
    }

    private static void write(HttpServletRequest request, HttpServletResponse response, long start) {
        long ms = (System.nanoTime() - start) / 1_000_000;
        if (ms > SLOW_MS) {
            String query = request.getQueryString();
            log.warn("{} {} {} {}ms SLOW params={}", request.getMethod(), request.getRequestURI(),
                    response.getStatus(), ms, query == null ? "" : query);
        } else {
            log.info("{} {} {} {}ms", request.getMethod(), request.getRequestURI(), response.getStatus(), ms);
        }
    }
}
