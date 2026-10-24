package ru.rt.radar.notifier.notification;

import java.time.OffsetDateTime;
import java.util.List;

/** Уведомление в ленте. Порядок полей = contracts/examples/notifications.json. */
public record Notification(long id, int projectId, String title, String municipalityName, Long subscriptionId,
                           boolean isRead, boolean sentToTelegram, OffsetDateTime createdAt) {

    /** GET /api/notifications. */
    public record Feed(List<Notification> items, long unreadCount) {
    }
}
