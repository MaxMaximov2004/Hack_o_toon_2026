package ru.rt.radar.invest;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import ru.rt.radar.ContractShape;
import ru.rt.radar.DbWebTest;
import ru.rt.radar.TestDb;

import java.net.URI;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * /api/projects/timeline. Данные — TestDb.resetStandardDataWithProjects(): события
 * 2019 start 5 · 2021 start 2 · 2022 start 1 · 2024 start 3 · 2025 launch 5 · 2026 launch 3, 1 · 2028 launch 2; у 4 лет нет.
 */
class TimelineApiTest extends DbWebTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @BeforeEach
    void data() {
        TestDb.resetStandardDataWithProjects();
    }

    private String body(String url) throws Exception {
        return mvc.perform(get(URI.create(url))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    @Test
    void matchesContractExample() throws Exception {
        ContractShape.assertMatches("timeline.json", body("/api/projects/timeline"));
    }

    @Test
    void yearsEventsAndTotal() throws Exception {
        mvc.perform(get("/api/projects/timeline"))
                .andExpect(jsonPath("$.minYear").value(2019))
                .andExpect(jsonPath("$.maxYear").value(2028))
                .andExpect(jsonPath("$.total").value(5))                       // проектов, включая 4 без лет
                .andExpect(jsonPath("$.years[*].year", contains(2019, 2021, 2022, 2024, 2025, 2026, 2028)))
                .andExpect(jsonPath("$.years[5].events[*].projectId", contains(3, 1)))   // 2026: 3704 > 1150
                .andExpect(jsonPath("$.years[5].events[*].type", contains("launch", "launch")))
                .andExpect(jsonPath("$.years[0].events[0].type").value("start"))
                .andExpect(jsonPath("$.years[0].events[0].title").value("Склад_1"))
                .andExpect(jsonPath("$.years[0].events[0].municipalityName").value("г. Тестоград"))
                .andExpect(jsonPath("$.years[0].events[0].stage").value("launch"))
                .andExpect(jsonPath("$.years[0].events[0].amountMln").value(650.5));
    }

    @Test
    void startBeforeLaunchInsideYearThenAmountDesc() throws Exception {
        TestDb.jdbc().update("""
                INSERT INTO invest_project (id, municipality_id, title, start_year, launch_year, amount_mln, stage)
                VALUES (6, 2, 'Маленький старт', 2026, NULL, 10, 'design'), (7, 2, 'Без объёма', NULL, 2026, NULL, NULL)
                """);
        mvc.perform(get("/api/projects/timeline"))
                .andExpect(jsonPath("$.years[?(@.year == 2026)].events[*].projectId", contains(6, 3, 1, 7)))
                .andExpect(jsonPath("$.years[?(@.year == 2026)].events[*].type", contains("start", "launch", "launch", "launch")))
                .andExpect(jsonPath("$.total").value(7));
    }

    @Test
    void periodShowsOnlyEventsInsideButCountsProjects() throws Exception {
        // в периоде 2025–2026 «идут» все 5 проектов, но событий внутри периода — только 2025 и 2026
        mvc.perform(get("/api/projects/timeline?yearFrom=2025&yearTo=2026"))
                .andExpect(jsonPath("$.total").value(5))
                .andExpect(jsonPath("$.minYear").value(2025))
                .andExpect(jsonPath("$.maxYear").value(2026))
                .andExpect(jsonPath("$.years[*].year", contains(2025, 2026)))
                .andExpect(jsonPath("$.years[0].events[*].projectId", contains(5)));
        mvc.perform(get("/api/projects/timeline?yearFrom=2027"))
                .andExpect(jsonPath("$.total").value(2))                       // 2 (2021–2028) и 4 (лет нет)
                .andExpect(jsonPath("$.years[*].year", contains(2028)));
    }

    @Test
    void noEventsGivesNullYears() throws Exception {
        // «без» → только 4, лет нет. URI.create: get(String) закодировал бы %D0… второй раз
        mvc.perform(get(URI.create("/api/projects/timeline?municipalityId=2&q=%D0%B1%D0%B5%D0%B7")))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.minYear").value(nullValue()))
                .andExpect(jsonPath("$.maxYear").value(nullValue()))
                .andExpect(jsonPath("$.years.length()").value(0));
        mvc.perform(get("/api/projects/timeline?stage=design"))
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.years.length()").value(0));
    }

    @ParameterizedTest(name = "[{0}]")
    @ValueSource(strings = {"", "industry=logistics", "need=apcs", "yearFrom=2027", "yearFrom=2025&yearTo=2026", "isKey=true"})
    void totalEqualsProjectsTotal(String filter) throws Exception {
        long timeline = JSON.readTree(body("/api/projects/timeline?" + filter)).get("total").asLong();
        long list = JSON.readTree(body("/api/projects?size=1&" + filter)).get("total").asLong();
        assertThat(timeline).isEqualTo(list).isPositive();
    }

    @Test
    void invalidAndSwagger() throws Exception {
        mvc.perform(get("/api/projects/timeline?stage=nope"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details.field").value("stage"));
        mvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/projects/timeline'].get.parameters[*].name",
                        org.hamcrest.Matchers.hasItems("stage", "industry", "need", "yearFrom", "yearTo")));
    }
}
