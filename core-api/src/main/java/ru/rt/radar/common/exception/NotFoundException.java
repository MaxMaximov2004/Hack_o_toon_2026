package ru.rt.radar.common.exception;

/** Объект не найден → 404 NOT_FOUND. */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }
}
