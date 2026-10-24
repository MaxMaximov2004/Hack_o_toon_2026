package ru.rt.radar.radar.stats;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import ru.rt.radar.ContractShape;
import ru.rt.radar.DbWebTest;
import ru.rt.radar.TestDb;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** /api/municipalities/stats и /api/white-spots. */
class StatsApiTest extends DbWebTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private JsonNode json(String url) throws Exception {
        return JSON.readTree(mvc.perform(get(url)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    /** Строки municipality_stats вставлены вручную — проверяем чтение и форматы до знака. */
    @Nested
    class ExactValues {

        @BeforeEach
        void data() {
            TestDb.resetStandardData();
            var j = TestDb.jdbc();
            j.update("INSERT INTO municipality (id, name, kind, lat, lon) VALUES (3, 'Третий р-н', 'district', 48.1, 40.2)");
            j.update("""
                    INSERT INTO municipality_stats (municipality_id, industry, companies, clients, excluded_clients,
                        new_share, revenue_est_sum, base_score, potential_score, is_white_spot, reason) VALUES
                    (1, 'all',   3,  1, 0, 0.3333, 123456789.50, 80, 53.33, false, NULL),
                    (2, 'all',   7,  0, 1, 0.1429, NULL,         72.5, 72.50, true, '7 компаний, охват РТ 0.00% при среднем по области 0.05%'),
                    (3, 'all',   50, 0, 0, 0.2000, 1000,         90, 90.00, true, '50 компаний, охват РТ 0.00% при среднем по области 0.05%'),
                    (1, 'trade', 2,  1, 0, 0.0000, 30000000,     50, 25.00, false, NULL),
                    (2, 'it',    0,  0, 0, 0.0000, NULL,         10, 10.00, true, 'нет компаний')
                    """);
        }

        @Test
        void statsMatchContractExample() throws Exception {
            ContractShape.assertMatches("stats.json",
                    mvc.perform(get("/api/municipalities/stats")).andReturn().getResponse().getContentAsString());
        }

        @Test
        void whiteSpotsMatchContractExample() throws Exception {
            ContractShape.assertMatches("white-spots.json",
                    mvc.perform(get("/api/white-spots")).andReturn().getResponse().getContentAsString());
        }

        @Test
        void statsValuesAndOrder() throws Exception {
            mvc.perform(get("/api/municipalities/stats"))
                    .andExpect(jsonPath("$[*].municipalityId", contains(3, 2, 1)))   // potentialScore убыв.
                    .andExpect(jsonPath("$[2].name").value("г. Тестоград"))
                    .andExpect(jsonPath("$[2].kind").value("city"))
                    .andExpect(jsonPath("$[2].industry").value("all"))
                    .andExpect(jsonPath("$[2].coverage").value(0.3333))              // 1 / 3, 4 знака
                    .andExpect(jsonPath("$[2].newShare").value(0.3333))
                    .andExpect(jsonPath("$[2].revenueEstSum").value(123456790L))     // целые рубли, HALF_UP
                    .andExpect(jsonPath("$[2].potentialScore").value(53.33))
                    .andExpect(jsonPath("$[2].isWhiteSpot").value(false))
                    .andExpect(jsonPath("$[2].reason").value(nullValue()))
                    .andExpect(jsonPath("$[1].coverage").value(0.0))
                    .andExpect(jsonPath("$[1].excludedClients").value(1))
                    .andExpect(jsonPath("$[1].revenueEstSum").value(nullValue()))
                    .andExpect(jsonPath("$[1].reason").value("7 компаний, охват РТ 0.00% при среднем по области 0.05%"));
            String body = mvc.perform(get("/api/municipalities/stats")).andReturn().getResponse().getContentAsString();
            assertThat(body).contains("\"revenueEstSum\":null", "\"reason\":null", "\"potentialScore\":72.5,");
        }

        @Test
        void industryFilterAndZeroCompanies() throws Exception {
            mvc.perform(get("/api/municipalities/stats?industry=trade"))
                    .andExpect(jsonPath("$[*].municipalityId", contains(1)))
                    .andExpect(jsonPath("$[0].coverage").value(0.5));
            // companies = 0 → coverage 0, без деления на ноль
            mvc.perform(get("/api/municipalities/stats?industry=it"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].coverage").value(0.0));
            mvc.perform(get("/api/municipalities/stats?industry=agro"))
                    .andExpect(jsonPath("$.length()").value(0));
        }

        @Test
        void whiteSpotsOnlyFlaggedSortedAndLimited() throws Exception {
            mvc.perform(get("/api/white-spots"))
                    .andExpect(jsonPath("$[*].municipalityId", contains(3, 2)))
                    .andExpect(jsonPath("$[0].potentialScore").value(90.0))
                    .andExpect(jsonPath("$[0].companies").value(50))
                    .andExpect(jsonPath("$[0].clients").value(0))
                    .andExpect(jsonPath("$[0].reason").value("50 компаний, охват РТ 0.00% при среднем по области 0.05%"));
            mvc.perform(get("/api/white-spots?limit=1")).andExpect(jsonPath("$[*].municipalityId", contains(3)));
            mvc.perform(get("/api/white-spots?industry=trade")).andExpect(jsonPath("$.length()").value(0));
            mvc.perform(get("/api/white-spots?industry=it")).andExpect(jsonPath("$[*].municipalityId", contains(2)));
        }

        @Test
        void emptyTableGivesEmptyArray() throws Exception {
            TestDb.jdbc().execute("TRUNCATE municipality_stats");
            mvc.perform(get("/api/municipalities/stats")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
            mvc.perform(get("/api/white-spots")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        }
    }

    /** Таблицу заполняет настоящая функция (как ETL) — цифры районов сходятся со списком компаний. */
    @Nested
    class RealFunction {

        @BeforeEach
        void data() {
            TestDb.resetStandardData();
            TestDb.insertBulk(3000, true);
            TestDb.jdbc().queryForObject("SELECT refresh_municipality_stats(0, 1)", Integer.class);
        }

        @ParameterizedTest(name = "industry={0}")
        @ValueSource(strings = {"all", "services", "trade", "it"})
        void statsAgreeWithCompanies(String industry) throws Exception {
            String ind = industry.equals("all") ? "" : "&industry=" + industry;
            JsonNode stats = json("/api/municipalities/stats?industry=" + industry);
            assertThat(stats.size()).isPositive();
            for (JsonNode s : stats) {
                int m = s.get("municipalityId").asInt();
                assertThat(s.get("companies").asLong()).as("companies района %d", m)
                        .isEqualTo(total("/api/companies?municipalityId=" + m + ind));
                assertThat(s.get("clients").asLong()).as("clients района %d", m)
                        .isEqualTo(total("/api/companies?client=ours&municipalityId=" + m + ind));
                assertThat(s.get("excludedClients").asLong()).as("excludedClients района %d", m)
                        .isEqualTo(total("/api/companies?client=ours&status=excluded&municipalityId=" + m + ind));
                double expectedCoverage = Math.round(10000.0 * s.get("clients").asLong() / s.get("companies").asLong()) / 10000.0;
                assertThat(s.get("coverage").asDouble()).isEqualTo(expectedCoverage);
            }
        }

        @Test
        void whiteSpotsAreFlaggedStats() throws Exception {
            JsonNode stats = json("/api/municipalities/stats");
            JsonNode spots = json("/api/white-spots?limit=50");
            long flagged = 0;
            for (JsonNode s : stats) {
                if (s.get("isWhiteSpot").asBoolean()) {
                    flagged++;
                    assertThat(s.get("reason").asText()).isNotBlank();
                } else {
                    assertThat(s.get("reason").isNull()).isTrue();
                }
            }
            assertThat(spots.size()).isEqualTo(flagged);
        }

        private long total(String url) throws Exception {
            return json(url + "&size=1").get("total").asLong();
        }
    }

    @ParameterizedTest(name = "{0} → 400 field={1}")
    @CsvSource(delimiter = '|', value = {
            "/api/municipalities/stats?industry=nope              | industry",
            "/api/municipalities/stats?industry=trade&industry=it | industry",
            "/api/white-spots?industry=nope                       | industry",
            "/api/white-spots?limit=0                             | limit",
            "/api/white-spots?limit=51                            | limit",
            "/api/white-spots?limit=abc                           | limit",
    })
    void invalidParams(String url, String field) throws Exception {
        mvc.perform(get(url))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details.field").value(field));
    }

    @Test
    void coverageRounding() {
        assertThat(StatsRepository.coverage(41, 8100)).isEqualTo(0.0051);
        assertThat(StatsRepository.coverage(1, 3)).isEqualTo(0.3333);
        assertThat(StatsRepository.coverage(2, 3)).isEqualTo(0.6667);
        assertThat(StatsRepository.coverage(0, 0)).isEqualTo(0.0);
    }
}
