package ru.rt.radar.radar.error;

// TEMP: заменить на common/ (Java #2)
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
