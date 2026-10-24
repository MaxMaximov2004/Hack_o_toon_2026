package ru.rt.radar.notifier.subscription;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

/** notify.subscription. Пользователь — sub из JWT, без FK (чужая схема). */
@Repository
public class SubscriptionRepository {

    private static final String COLUMNS = "id, industry, municipality_id, need, stage, created_at";
    private static final RowMapper<Subscription> MAPPER = (rs, i) -> new Subscription(
            rs.getLong("id"), rs.getString("industry"), rs.getObject("municipality_id", Integer.class),
            rs.getString("need"), rs.getString("stage"), rs.getObject("created_at", OffsetDateTime.class));

    private final NamedParameterJdbcTemplate jdbc;

    public SubscriptionRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Subscription> findByUser(long userId) {
        return jdbc.query("SELECT " + COLUMNS + " FROM subscription WHERE user_id = :userId ORDER BY created_at DESC, id DESC",
                new MapSqlParameterSource("userId", userId), MAPPER);
    }

    public Subscription insert(long userId, SubscriptionRequest r) {
        return jdbc.queryForObject("""
                INSERT INTO subscription (user_id, industry, municipality_id, need, stage)
                VALUES (:userId, :industry, :municipalityId, :need, :stage)
                RETURNING\s""" + COLUMNS,
                new MapSqlParameterSource("userId", userId).addValue("industry", r.industry())
                        .addValue("municipalityId", r.municipalityId()).addValue("need", r.need()).addValue("stage", r.stage()),
                MAPPER);
    }

    /** true — удалена; false — нет такой у этого пользователя. */
    public boolean delete(long userId, long id) {
        return jdbc.update("DELETE FROM subscription WHERE id = :id AND user_id = :userId",
                new MapSqlParameterSource("id", id).addValue("userId", userId)) > 0;
    }

    /** Все подписки с владельцем — для воркера. */
    public List<Owned> findAll() {
        return jdbc.query("SELECT user_id, " + COLUMNS + " FROM subscription ORDER BY id",
                (rs, i) -> new Owned(rs.getLong("user_id"), MAPPER.mapRow(rs, i)));
    }

    public record Owned(long userId, Subscription subscription) {
    }
}
