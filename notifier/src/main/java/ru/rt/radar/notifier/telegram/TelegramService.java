package ru.rt.radar.notifier.telegram;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicLong;

import static ru.rt.radar.notifier.common.util.LogPatterns.*;

/** Привязка чата по ссылке t.me/<бот>?start=<токен> и отправка уведомлений. */
@Service
public class TelegramService {

    private static final Logger log = LoggerFactory.getLogger(TelegramService.class);

    private final TelegramClient client;
    private final TelegramLinkRepository links;
    private final AtomicLong offset = new AtomicLong();
    private volatile String botUsername;

    public TelegramService(TelegramClient client, TelegramLinkRepository links) {
        this.client = client;
        this.links = links;
        if (!client.enabled()) {
            log.warn(TELEGRAM_DISABLED);
        }
    }

    public TelegramLink linkFor(long userId) {
        TelegramLinkRepository.Link link = links.ensure(userId);
        String username = client.enabled() ? username() : null;
        return new TelegramLink(username != null, link.chatId() != null,
                username == null ? null : "https://t.me/" + username + "?start=" + link.token());
    }

    /** true — отправлено; false — чат не привязан, бот выключен или Telegram не ответил (уведомление в ленте всё равно есть). */
    public boolean sendTo(long userId, String text) {
        if (!client.enabled()) {
            return false;
        }
        return links.chatId(userId).map(chat -> {
            try {
                client.sendMessage(chat, text);
                return true;
            } catch (Exception e) {
                log.warn(TELEGRAM_ERROR, e.getMessage());
                return false;
            }
        }).orElse(false);
    }

    /** Один цикл long polling: /start <токен> → привязать чат. Пауза между циклами — 1 с. */
    @Scheduled(fixedDelay = 1000)
    public void poll() {
        if (!client.enabled()) {
            return;
        }
        try {
            for (TelegramClient.Update u : client.getUpdates(offset.get())) {
                offset.set(u.updateId() + 1);
                handle(u);
            }
        } catch (Exception e) {
            log.warn(TELEGRAM_ERROR, e.getMessage());
        }
    }

    void handle(TelegramClient.Update u) {
        String[] parts = u.text().trim().split("\\s+");
        if (!parts[0].equals("/start")) {
            return;
        }
        if (parts.length != 2) {                  // нашли бота поиском, без ссылки из Навигатора
            client.sendMessage(u.chatId(), TELEGRAM_HOW_TO);
            return;
        }
        links.link(parts[1], u.chatId()).ifPresentOrElse(user -> {
            log.info(TELEGRAM_LINKED, user, u.chatId());
            client.sendMessage(u.chatId(), TELEGRAM_WELCOME);
        }, () -> client.sendMessage(u.chatId(), TELEGRAM_UNKNOWN_LINK));
    }

    private String username() {
        if (botUsername == null) {
            try {
                botUsername = client.botUsername();
            } catch (Exception e) {
                log.warn(TELEGRAM_ERROR, e.getMessage());
            }
        }
        return botUsername;
    }
}
