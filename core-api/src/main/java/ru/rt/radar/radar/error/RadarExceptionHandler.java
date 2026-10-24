package ru.rt.radar.radar.error;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.LinkedHashMap;
import java.util.Map;

// TEMP: заменить на common/ (Java #2). Действует только на контроллеры пакета radar,
// чтобы не пересекаться с общим @RestControllerAdvice, когда он появится.
/** Ошибки в формате контракта: { "error": { "code", "message", "details" } }. */
@RestControllerAdvice(basePackages = "ru.rt.radar.radar")
public class RadarExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(RadarExceptionHandler.class);

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<Map<String, Object>> validation(ValidationException e) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", e.getMessage(), Map.of("field", e.getField()));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> missing(MissingServletRequestParameterException e) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "Не задан обязательный параметр " + e.getParameterName(), Map.of("field", e.getParameterName()));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> mismatch(MethodArgumentTypeMismatchException e) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "Неверное значение параметра " + e.getName() + "='" + e.getValue() + "'", Map.of("field", e.getName()));
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<Map<String, Object>> notFound(NotFoundException e) {
        return error(HttpStatus.NOT_FOUND, "NOT_FOUND", e.getMessage(), null);
    }

    @ExceptionHandler(TooLargeException.class)
    public ResponseEntity<Map<String, Object>> tooLarge(TooLargeException e) {
        return error(HttpStatus.PAYLOAD_TOO_LARGE, "TOO_LARGE", e.getMessage(),
                Map.of("total", e.getTotal(), "limit", e.getLimit()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> internal(Exception e) {
        // Исключения Spring MVC со своим статусом (405, 406, 415…) не превращаем в 500
        if (e instanceof ErrorResponse er && er.getStatusCode().is4xxClientError()) {
            HttpStatus status = HttpStatus.valueOf(er.getStatusCode().value());
            return error(status, "VALIDATION_ERROR", status.getReasonPhrase(), null);
        }
        log.error("Необработанная ошибка", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Внутренняя ошибка сервиса", null);
    }

    static ResponseEntity<Map<String, Object>> error(HttpStatus status, String code, String message,
                                                     Map<String, Object> details) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", code);
        body.put("message", message);
        body.put("details", details);
        return ResponseEntity.status(status).body(Map.of("error", body));
    }
}
