package ru.rt.radar.notifier.worker;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import ru.rt.radar.notifier.notification.NotificationRepository;
import ru.rt.radar.notifier.project.CoreApiClient;
import ru.rt.radar.notifier.project.ProjectEvent;
import ru.rt.radar.notifier.subscription.SubscriptionRepository;
import ru.rt.radar.notifier.telegram.TelegramService;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static ru.rt.radar.notifier.common.util.LogPatterns.*;

/**
 * Проверка новых проектов (docs/tz/08-product2-contract.md, «Воркер»): проекты, изменённые после lastCheckedAt →
 * подходящие подписки → уведомление в ленту (один раз на пользователя и проект) → Telegram, если чат привязан.
 * lastCheckedAt — максимальный updatedAt из ответа core-api, а не «сейчас»: часы сервисов не обязаны совпадать.
 */
@Service
public class ProjectCheckService {

    private static final Logger log = LoggerFactory.getLogger(ProjectCheckService.class);
    static final String STATE_KEY = "lastCheckedAt";

    private final CoreApiClient core;
    private final SubscriptionRepository subscriptions;
    private final NotificationRepository notifications;
    private final TelegramService telegram;
    private final NamedParameterJdbcTemplate jdbc;

    public ProjectCheckService(CoreApiClient core, SubscriptionRepository subscriptions, NotificationRepository notifications,
                               TelegramService telegram, NamedParameterJdbcTemplate jdbc) {
        this.core = core;
        this.subscriptions = subscriptions;
        this.notifications = notifications;
        this.telegram = telegram;
        this.jdbc = jdbc;
    }

    /** synchronized: плановый запуск и ручной POST /internal/notifier/check не идут одновременно. */
    public synchronized CheckResult check() {
        OffsetDateTime since = lastCheckedAt().orElse(null);
        List<ProjectEvent> projects = core.projectsUpdatedSince(since);
        List<SubscriptionRepository.Owned> subs = subscriptions.findAll();

        int created = 0;
        int sent = 0;
        OffsetDateTime newest = since;
        for (ProjectEvent p : projects) {
            for (SubscriptionRepository.Owned s : subs) {
                if (!s.subscription().matches(p)) {
                    continue;
                }
                Optional<Long> id = notifications.insertIfAbsent(s.userId(), s.subscription().id(), p);
                if (id.isPresent()) {
                    created++;
                    String text = String.format(TELEGRAM_MESSAGE, p.title(), p.municipalityName() == null ? "" : p.municipalityName());
                    if (telegram.sendTo(s.userId(), text)) {
                        notifications.markSentToTelegram(id.get());
                        sent++;
                    }
                }
            }
            if (p.updatedAt() != null && (newest == null || p.updatedAt().isAfter(newest))) {
                newest = p.updatedAt();
            }
        }
        if (newest != null && !newest.equals(since)) {
            saveLastCheckedAt(newest);
        }
        log.info(CHECK_DONE, projects.size(), created, sent, newest);
        return new CheckResult(projects.size(), created, sent, newest);
    }

    private Optional<OffsetDateTime> lastCheckedAt() {
        return jdbc.query("SELECT value FROM state WHERE key = :key", new MapSqlParameterSource("key", STATE_KEY),
                (rs, i) -> OffsetDateTime.parse(rs.getString("value"))).stream().findFirst();
    }

    private void saveLastCheckedAt(OffsetDateTime value) {
        jdbc.update("""
                INSERT INTO state (key, value) VALUES (:key, :value)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                """, new MapSqlParameterSource("key", STATE_KEY).addValue("value", value.toString()));
    }

    /** Ответ POST /internal/notifier/check. */
    public record CheckResult(int projects, int created, int sentToTelegram, OffsetDateTime lastCheckedAt) {
    }
}
