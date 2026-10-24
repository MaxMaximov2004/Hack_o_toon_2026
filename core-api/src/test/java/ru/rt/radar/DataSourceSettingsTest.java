package ru.rt.radar;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/** Настройки соединений сервиса, от которых зависит скорость карты и списка. */
class DataSourceSettingsTest extends DbWebTest {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void customPlansForParameterizedQueries() {
        // Без этого с 5-го вызова JDBC окно карты (lat/lon BETWEEN :…) идёт общим планом по индексу — в 2–3 раза медленнее
        assertThat(jdbc.queryForObject("SHOW plan_cache_mode", String.class)).isEqualTo("force_custom_plan");
    }

    @Test
    void connectedAsCoreServiceToCoreSchema() {
        assertThat(jdbc.queryForObject("SELECT current_user", String.class)).isEqualTo("core_svc");
        assertThat(jdbc.queryForObject("SELECT current_schema()", String.class)).isEqualTo("core");
    }
}
