package ru.rt.radar.radar.error;

// TEMP: заменить на common/ (Java #2)
/** Объект не найден → 404 NOT_FOUND. */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }
}
