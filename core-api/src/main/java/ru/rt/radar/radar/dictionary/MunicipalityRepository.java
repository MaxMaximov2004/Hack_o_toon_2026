package ru.rt.radar.radar.dictionary;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Справочник районов с кэшем в памяти на 60 с. Не вечный: ETL при перезагрузке пересоздаёт районы с новыми id,
 * а core-api может стартовать раньше, чем ETL заполнит таблицу. Пустой результат не кэшируется.
 */
@Repository
public class MunicipalityRepository {

    static final Duration TTL = Duration.ofSeconds(60);

    private static final String SQL = "SELECT id, name, kind, lat, lon FROM municipality ORDER BY kind DESC, name";

    private record Cached(List<Municipality> items, Instant loadedAt) {
    }

    private final JdbcTemplate jdbc;
    private final Clock clock;
    private volatile Cached cached;

    @Autowired
    public MunicipalityRepository(JdbcTemplate jdbc) {
        this(jdbc, Clock.systemUTC());
    }

    MunicipalityRepository(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public List<Municipality> findAll() {
        Instant now = clock.instant();
        Cached c = cached;
        if (c != null && now.isBefore(c.loadedAt().plus(TTL))) {
            return c.items();
        }
        List<Municipality> items = List.copyOf(jdbc.query(SQL, (rs, i) -> new Municipality(
                rs.getInt("id"), rs.getString("name"), rs.getString("kind"), rs.getDouble("lat"), rs.getDouble("lon"))));
        if (!items.isEmpty()) {
            cached = new Cached(items, now);
        }
        return items;
    }
}
