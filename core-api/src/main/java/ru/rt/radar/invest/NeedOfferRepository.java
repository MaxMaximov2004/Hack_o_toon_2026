package ru.rt.radar.invest;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Array;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Справочник «потребность → услуги РТ» (core.need_offer, заполняет infra/db/init/04_need_offer.sql).
 * Четыре строки — читаем целиком, кэш 60 с, как районы. Пустой результат не кэшируется.
 */
@Repository
public class NeedOfferRepository {

    static final Duration TTL = Duration.ofSeconds(60);

    private record Cached(Map<String, List<String>> offers, Instant loadedAt) {
    }

    private final JdbcTemplate jdbc;
    private final Clock clock;
    private volatile Cached cached;

    @Autowired
    public NeedOfferRepository(JdbcTemplate jdbc) {
        this(jdbc, Clock.systemUTC());
    }

    NeedOfferRepository(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /** need → offers в порядке из БД. */
    public Map<String, List<String>> offersByNeed() {
        Instant now = clock.instant();
        Cached c = cached;
        if (c != null && now.isBefore(c.loadedAt().plus(TTL))) {
            return c.offers();
        }
        Map<String, List<String>> offers = new HashMap<>();
        jdbc.query("SELECT need, offers FROM need_offer", rs -> {
            Array arr = rs.getArray("offers");
            offers.put(rs.getString("need"), arr == null ? List.of() : Arrays.asList((String[]) arr.getArray()));
        });
        Map<String, List<String>> result = Map.copyOf(offers);
        if (!result.isEmpty()) {
            cached = new Cached(result, now);
        }
        return result;
    }
}
