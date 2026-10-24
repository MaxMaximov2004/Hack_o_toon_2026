package ru.rt.radar.notifier.common.dto.error;

/** Коды ошибок из контракта (docs/tz/00-common.md) — одинаковые во всех сервисах. */
public enum ErrorCode {
    VALIDATION_ERROR,
    UNAUTHORIZED,
    FORBIDDEN,
    NOT_FOUND,
    CONFLICT,
    TOO_LARGE,
    UPSTREAM_UNAVAILABLE,
    INTERNAL_ERROR
}
