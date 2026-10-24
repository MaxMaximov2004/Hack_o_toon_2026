package ru.rt.radar.notifier.common.exception;

/** Сосед (core-api) не ответил или ответил ошибкой → 502 UPSTREAM_UNAVAILABLE. */
public class UpstreamUnavailableException extends RuntimeException {

    public UpstreamUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
