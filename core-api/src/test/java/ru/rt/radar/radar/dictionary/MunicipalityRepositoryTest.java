package ru.rt.radar.radar.dictionary;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import ru.rt.radar.TestDb;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

/** Кэш районов: пустой результат не кэшируется, через TTL подхватываются изменения после перезагрузки ETL. */
class MunicipalityRepositoryTest {

    /** Часы, которые двигает тест. */
    static final class TestClock extends Clock {
        Instant now = Instant.parse("2026-10-24T10:00:00Z");

        @Override public ZoneId getZone() { return ZoneId.of("UTC"); }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
        void advance(Duration d) { now = now.plus(d); }
    }

    @AfterAll
    static void restore() {
        TestDb.resetStandardData();
    }

    @Test
    void emptyNotCachedAndTtl() {
        JdbcTemplate j = TestDb.jdbc();
        j.execute("TRUNCATE municipality_stats, company, municipality RESTART IDENTITY CASCADE");
        TestClock clock = new TestClock();
        MunicipalityRepository repo = new MunicipalityRepository(j, clock);

        // core-api стартовал раньше ETL: районов ещё нет — пустой список не запоминаем
        assertThat(repo.findAll()).isEmpty();
        j.update("INSERT INTO municipality (id, name, kind, lat, lon) VALUES (1, 'г. Первый', 'city', 47, 39)");
        assertThat(repo.findAll()).extracting(Municipality::name).containsExactly("г. Первый");

        // в пределах TTL — из кэша
        j.update("INSERT INTO municipality (id, name, kind, lat, lon) VALUES (2, 'Второй р-н', 'district', 46, 41)");
        clock.advance(MunicipalityRepository.TTL.minusSeconds(1));
        assertThat(repo.findAll()).hasSize(1);

        // TTL истёк — перечитали
        clock.advance(Duration.ofSeconds(2));
        assertThat(repo.findAll()).extracting(Municipality::name).containsExactly("Второй р-н", "г. Первый");
    }
}
