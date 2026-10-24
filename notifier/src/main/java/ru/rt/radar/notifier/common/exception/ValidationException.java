package ru.rt.radar.notifier.common.exception;

/** Неверный параметр запроса → 400 VALIDATION_ERROR с details.field. */
public class ValidationException extends RuntimeException {

    private final String field;

    public ValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    public String getField() {
        return field;
    }
}
