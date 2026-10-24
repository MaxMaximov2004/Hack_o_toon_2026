package ru.rt.radar.notifier.telegram;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;

/** notify.telegram_link: одноразовый токен для /start и привязанный chat_id. */
@Repository
public class TelegramLinkRepository {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final NamedParameterJdbcTemplate jdbc;

    public TelegramLinkRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Токен пользователя (создаётся при первом запросе) и chat_id, если уже привязан. */
    public Link ensure(long userId) {
        jdbc.update("INSERT INTO telegram_link (user_id, link_token) VALUES (:userId, :token) ON CONFLICT (user_id) DO NOTHING",
                new MapSqlParameterSource("userId", userId).addValue("token", newToken()));
        return jdbc.queryForObject("SELECT link_token, chat_id FROM telegram_link WHERE user_id = :userId",
                new MapSqlParameterSource("userId", userId),
                (rs, i) -> new Link(rs.getString("link_token"), rs.getObject("chat_id", Long.class)));
    }

    public Optional<Long> chatId(long userId) {
        return jdbc.query("SELECT chat_id FROM telegram_link WHERE user_id = :userId AND chat_id IS NOT NULL",
                new MapSqlParameterSource("userId", userId), (rs, i) -> rs.getLong("chat_id")).stream().findFirst();
    }

    /** /start <token> → привязать чат; id пользователя или пусто, если токен неизвестен. */
    public Optional<Long> link(String token, long chatId) {
        return jdbc.query("""
                UPDATE telegram_link SET chat_id = :chatId, linked_at = now() WHERE link_token = :token RETURNING user_id
                """, new MapSqlParameterSource("token", token).addValue("chatId", chatId),
                (rs, i) -> rs.getLong("user_id")).stream().findFirst();
    }

    private static String newToken() {
        byte[] bytes = new byte[12];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);   // в /start допустимы A-Z a-z 0-9 _ -
    }

    public record Link(String token, Long chatId) {
    }
}
