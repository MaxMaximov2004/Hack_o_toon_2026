package ru.rt.radar.notifier.notification;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.rt.radar.notifier.common.exception.NotFoundException;
import ru.rt.radar.notifier.telegram.TelegramLink;
import ru.rt.radar.notifier.telegram.TelegramService;

import static ru.rt.radar.notifier.common.util.LogPatterns.NOTIFICATION_NOT_FOUND;
import static ru.rt.radar.notifier.subscription.SubscriptionController.userId;

@RestController
@Tag(name = "Уведомления")
public class NotificationController {

    private final NotificationRepository notifications;
    private final TelegramService telegram;

    public NotificationController(NotificationRepository notifications, TelegramService telegram) {
        this.notifications = notifications;
        this.telegram = telegram;
    }

    @GetMapping("/api/notifications")
    @Operation(summary = "Лента: 50 последних, новые сверху", description = "unread=true — только непрочитанные.")
    public Notification.Feed feed(@AuthenticationPrincipal Jwt jwt, @RequestParam(defaultValue = "false") boolean unread) {
        long user = userId(jwt);
        return new Notification.Feed(notifications.feed(user, unread), notifications.unreadCount(user));
    }

    @PostMapping("/api/notifications/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Отметить прочитанным", description = "Чужое или несуществующее — 404.")
    public void read(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        if (!notifications.markRead(userId(jwt), id)) {
            throw new NotFoundException(String.format(NOTIFICATION_NOT_FOUND, id));
        }
    }

    @PostMapping("/api/notifications/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Отметить все прочитанными")
    public void readAll(@AuthenticationPrincipal Jwt jwt) {
        notifications.markAllRead(userId(jwt));
    }

    @GetMapping("/api/notifications/telegram-link")
    @Operation(summary = "Ссылка «Подключить Telegram»",
            description = "url = https://t.me/<бот>?start=<токен>. Бот не настроен на сервере — botConfigured=false, url=null.")
    public TelegramLink telegramLink(@AuthenticationPrincipal Jwt jwt) {
        return telegram.linkFor(userId(jwt));
    }
}
