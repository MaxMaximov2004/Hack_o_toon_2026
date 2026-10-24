package ru.rt.radar.common.dto.error;

import java.util.Map;

/**
 * Тело ошибки по контракту: { "error": { "code", "message", "details" } }.
 * details — null, если уточнять нечего (поле не пропускаем, см. 00-common).
 */
public record ErrorResponseDTO(ErrorBody error) {

    public record ErrorBody(ErrorCode code, String message, Map<String, Object> details) {
    }

    public static ErrorResponseDTO of(ErrorCode code, String message, Map<String, Object> details) {
        return new ErrorResponseDTO(new ErrorBody(code, message, details));
    }
}
