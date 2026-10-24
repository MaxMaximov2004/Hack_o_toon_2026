package ru.rt.radar.locations;

/**
 * Менеджер пытается удалить место не из ручного ввода → 403 FORBIDDEN (обработчик — в LocationController:
 * в common/exception нет класса для 403, а AccessDeniedException глобальный обработчик превратил бы в 500).
 */
public class LocationForbiddenException extends RuntimeException {

    public LocationForbiddenException(String message) {
        super(message);
    }
}
