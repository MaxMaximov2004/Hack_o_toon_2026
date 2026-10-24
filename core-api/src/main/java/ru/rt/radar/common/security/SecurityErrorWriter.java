package ru.rt.radar.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import ru.rt.radar.common.dto.error.ErrorCode;
import ru.rt.radar.common.dto.error.ErrorResponseDTO;

import java.io.IOException;

import static ru.rt.radar.common.util.LogPatterns.AUTH_FAILURE;

/**
 * Ответы фильтров безопасности (401 / 403 / 502) — в том же формате, что у GlobalExceptionHandler:
 * до контроллеров эти ошибки не доходят, поэтому пишем тело сами.
 */
public class SecurityErrorWriter {

    private static final Logger log = LoggerFactory.getLogger(SecurityErrorWriter.class);

    private final ObjectMapper mapper;

    public SecurityErrorWriter(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    /** reason — только в лог: клиенту не объясняем, чем именно плох токен. */
    public void write(HttpServletRequest request, HttpServletResponse response, HttpStatus status, ErrorCode code,
                      String message, String reason) throws IOException {
        if (status.is4xxClientError()) {
            log.warn(AUTH_FAILURE, request.getMethod(), request.getRequestURI(), status.value(), code, message, reason);
        } else {
            log.error(AUTH_FAILURE, request.getMethod(), request.getRequestURI(), status.value(), code, message, reason);
        }
        if (status == HttpStatus.UNAUTHORIZED && request.getRequestURI().startsWith("/api/")) {
            response.setHeader("WWW-Authenticate", "Bearer");
        }
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        mapper.writeValue(response.getOutputStream(), ErrorResponseDTO.of(code, message, null));
    }
}
