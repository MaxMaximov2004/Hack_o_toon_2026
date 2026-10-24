package ru.rt.radar.invest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import ru.rt.radar.ContractShape;
import ru.rt.radar.DbWebTest;
import ru.rt.radar.TestDb;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** /internal/projects — для notifier и экспорта. Данные — TestDb.resetStandardDataWithProjects(). */
class InternalProjectApiTest extends DbWebTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @BeforeAll
    static void data() {
        TestDb.resetStandardDataWithProjects();
    }

    private String body(String url) throws Exception {
        return mvc.perform(get(URI.create(url))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private List<Integer> ids(String url) throws Exception {
        List<Integer> ids = new ArrayList<>();
        JSON.readTree(body(url)).forEach(p -> ids.add(p.get("id").asInt()));
        return ids;
    }

    @Test
    void matchesContractExample() throws Exception {
        ContractShape.assertMatches("projects-internal.json", body("/internal/projects"));
    }

    @Test
    void allSortedByUpdatedAtThenId() throws Exception {
        assertThat(ids("/internal/projects")).containsExactly(1, 2, 3, 4, 5);
    }

    @Test
    void updatedAtHasFullPrecision() throws Exception {
        mvc.perform(get("/internal/projects"))
                .andExpect(jsonPath("$[0].updatedAt").value("2026-10-20T10:00:00.123456Z"))
                .andExpect(jsonPath("$[1].updatedAt").value("2026-10-20T11:00:00Z"))
                .andExpect(jsonPath("$[2].updatedAt").value("2026-10-21T09:30:00.500Z"))
                .andExpect(jsonPath("$[4].updatedAt").value("2026-10-23T08:00:00.000001Z"));
    }

    @ParameterizedTest(name = "updatedSince={0} → {1}")
    @CsvSource(delimiter = '|', value = {
            "2026-10-21T09:30:00.5Z               | 4,5",     // строго больше: сам 3 (ровно 09:30:00.5) не входит
            "2026-10-21T09:30:00.499999Z          | 3,4,5",
            "2026-10-21T12:30:00%2B03:00          | 3,4,5",   // +03:00, закодированный плюс: 09:30 UTC
            "2026-10-21T12:30:00+03:00            | 3,4,5",   // незакодированный «+» приходит пробелом — понимаем
            "2026-10-23T08:00:00.000001Z          | ''",
    })
    void updatedSinceIsStrictAndAcceptsOffsets(String since, String expected) throws Exception {
        List<String> got = ids("/internal/projects?updatedSince=" + since).stream().map(String::valueOf).toList();
        assertThat(got).containsExactlyElementsOf(expected.isEmpty() ? List.of() : List.of(expected.split(",")));
    }

    /** Как notifier: берёт максимальный updatedAt из ответа и шлёт его обратно — повторов нет. */
    @Test
    void roundTripLikeNotifier() throws Exception {
        JsonNode all = JSON.readTree(body("/internal/projects"));
        OffsetDateTime newest = OffsetDateTime.parse(all.get(all.size() - 1).get("updatedAt").asText());
        assertThat(ids("/internal/projects?updatedSince=" + newest)).isEmpty();
        // предпоследний: остаётся ровно последний
        OffsetDateTime prev = OffsetDateTime.parse(all.get(all.size() - 2).get("updatedAt").asText());
        assertThat(ids("/internal/projects?updatedSince=" + prev)).containsExactly(5);
    }

    @Test
    void filterAppliesTogetherWithUpdatedSince() throws Exception {
        assertThat(ids("/internal/projects?industry=logistics")).containsExactly(1, 5);
        assertThat(ids("/internal/projects?industry=logistics&updatedSince=2026-10-21T00:00:00Z")).containsExactly(5);
    }

    @Test
    void projectFieldsAndOffers() throws Exception {
        mvc.perform(get("/internal/projects?municipalityId=1&stage=construction"))
                .andExpect(jsonPath("$[*].id", contains(1, 2)))
                .andExpect(jsonPath("$[1].title").value("Завод запчастей"))
                .andExpect(jsonPath("$[1].municipalityName").value("г. Тестоград"))
                .andExpect(jsonPath("$[1].lat").value(47.2))         // центр муниципалитета
                .andExpect(jsonPath("$[1].lon").value(39.7))
                .andExpect(jsonPath("$[1].isKey").value(false))
                .andExpect(jsonPath("$[1].curator").value(nullValue()))
                .andExpect(jsonPath("$[1].amountMln").value(8000.0))
                .andExpect(jsonPath("$[1].stageName").value("Строительство"))
                .andExpect(jsonPath("$[1].industryName").value("Производство"))
                .andExpect(jsonPath("$[1].needs", contains("apcs", "it_infra")))
                // порядок — как в needs, тексты — из core.need_offer
                .andExpect(jsonPath("$[1].recommendedOffers[*].need", contains("apcs", "it_infra")))
                .andExpect(jsonPath("$[1].recommendedOffers[0].needName").value("АСУ ТП и промышленный интернет вещей"))
                .andExpect(jsonPath("$[1].recommendedOffers[1].offers[0]")
                        .value("Корпоративный интернет и защищённая связь между площадками (VPN)"));
        String json = body("/internal/projects?municipalityId=1&stage=construction");
        assertThat(json).contains("\"amountMln\":8000.0,", "\"amountMln\":1150.0,");
    }

    @Test
    void nullsNotSkipped() throws Exception {
        String json = body("/internal/projects?q=" + "100%25");
        assertThat(json).contains("\"startYear\":null", "\"launchYear\":null", "\"amountMln\":null", "\"jobs\":null",
                "\"stage\":null", "\"stageName\":null", "\"industry\":null", "\"industryName\":null", "\"curator\":null");
        mvc.perform(get("/internal/projects?municipalityId=2"))
                .andExpect(jsonPath("$[0].needs.length()").value(0))           // «Теплица» без потребностей
                .andExpect(jsonPath("$[0].recommendedOffers.length()").value(0))
                .andExpect(jsonPath("$[0].initiator").value(nullValue()));
    }

    @Test
    void unknownNeedCodeSkippedInOffers() throws Exception {
        TestDb.jdbc().update("UPDATE invest_project SET needs = '{it_infra,bogus}' WHERE id = 5");
        try {
            mvc.perform(get("/internal/projects?q=_1"))
                    .andExpect(jsonPath("$[0].needs", contains("it_infra", "bogus")))
                    .andExpect(jsonPath("$[0].recommendedOffers[*].need", contains("it_infra")));
        } finally {
            TestDb.jdbc().update("UPDATE invest_project SET needs = '{it_infra}' WHERE id = 5");
        }
    }

    @ParameterizedTest(name = "{0} → 400 field={1}")
    @CsvSource(delimiter = '|', value = {
            "updatedSince=yesterday          | updatedSince",
            "updatedSince=2026-10-24         | updatedSince",   // нужна дата И время с поясом
            "stage=nope                      | stage",
            "yearFrom=2027&yearTo=2025       | yearFrom",
    })
    void invalidParams(String query, String field) throws Exception {
        mvc.perform(get("/internal/projects?" + query))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details.field").value(field));
    }

    @Test
    void swaggerShowsFilterAndUpdatedSince() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/internal/projects'].get.parameters[*].name", org.hamcrest.Matchers.hasItems(
                        "updatedSince", "stage", "industry", "need", "municipalityId", "yearFrom", "yearTo", "isKey",
                        "amountMin", "q")));
    }
}
