package ru.rt.radar.notifier.notification;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import ru.rt.radar.notifier.project.ProjectEvent;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/** notify.notification. Одно уведомление на пару (пользователь, проект) — UNIQUE в таблице. */
@Repository
public class NotificationRepository {

    static final int FEED_LIMIT = 50;

    private static final RowMapper<Notification> MAPPER = (rs, i) -> new Notification(
            rs.getLong("id"), rs.getInt("project_id"), rs.getString("title"), rs.getString("municipality_name"),
            rs.getObject("subscription_id", Long.class), rs.getBoolean("is_read"), rs.getBoolean("sent_to_telegram"),
            rs.getObject("created_at", OffsetDateTime.class));

    private final NamedParameterJdbcTemplate jdbc;

    public NotificationRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Notification> feed(long userId, boolean unreadOnly) {
        return jdbc.query("""
                SELECT id, project_id, title, municipality_name, subscription_id, is_read, sent_to_telegram, created_at
                FROM notification
                WHERE user_id = :userId AND (NOT :unreadOnly OR NOT is_read)
                ORDER BY created_at DESC, id DESC
                LIMIT %d
                """.formatted(FEED_LIMIT), new MapSqlParameterSource("userId", userId).addValue("unreadOnly", unreadOnly), MAPPER);
    }

    public long unreadCount(long userId) {
        Long n = jdbc.queryForObject("SELECT count(*) FROM notification WHERE user_id = :userId AND NOT is_read",
                new MapSqlParameterSource("userId", userId), Long.class);
        return n == null ? 0 : n;
    }

    /** true — отмечено; false — нет такого у пользователя. */
    public boolean markRead(long userId, long id) {
        return jdbc.update("UPDATE notification SET is_read = true WHERE id = :id AND user_id = :userId",
                new MapSqlParameterSource("id", id).addValue("userId", userId)) > 0;
    }

    public void markAllRead(long userId) {
        jdbc.update("UPDATE notification SET is_read = true WHERE user_id = :userId AND NOT is_read",
                new MapSqlParameterSource("userId", userId));
    }

    /** id нового уведомления; пусто — такое уже было (повторная проверка того же проекта). */
    public Optional<Long> insertIfAbsent(long userId, long subscriptionId, ProjectEvent p) {
        return jdbc.query("""
                INSERT INTO notification (user_id, subscription_id, project_id, title, municipality_name)
                VALUES (:userId, :subscriptionId, :projectId, :title, :municipalityName)
                ON CONFLICT (user_id, project_id) DO NOTHING
                RETURNING id
                """, new MapSqlParameterSource("userId", userId).addValue("subscriptionId", subscriptionId)
                        .addValue("projectId", p.id()).addValue("title", p.title())
                        .addValue("municipalityName", p.municipalityName()),
                (rs, i) -> rs.getLong("id")).stream().findFirst();
    }

    public void markSentToTelegram(long id) {
        jdbc.update("UPDATE notification SET sent_to_telegram = true WHERE id = :id", new MapSqlParameterSource("id", id));
    }
}
