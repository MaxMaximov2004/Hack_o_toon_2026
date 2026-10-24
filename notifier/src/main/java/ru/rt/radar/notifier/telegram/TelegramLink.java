package ru.rt.radar.notifier.telegram;

/** GET /api/notifications/telegram-link. Порядок полей = contracts/examples/telegram-link.json. */
public record TelegramLink(boolean botConfigured, boolean linked, String url) {
}
