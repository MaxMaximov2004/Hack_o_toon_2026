package ru.rt.radar.invest;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import ru.rt.radar.ContractShape;
import ru.rt.radar.DbWebTest;
import ru.rt.radar.TestDb;

import java.net.URI;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** /api/projects и /api/projects/{id}. Данные — TestDb.resetStandardDataWithProjects() (таблица — в его javadoc). */
class ProjectApiTest extends DbWebTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @BeforeAll
    static void data() {
        TestDb.resetStandardDataWithProjects();
    }

    private String body(String url) throws Exception {
        return mvc.perform(get(URI.create(url))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    @Test
    void listMatchesContractExample() throws Exception {
        ContractShape.assertMatches("projects.json", body("/api/projects"));
    }

    @Test
    void cardMatchesContractExample() throws Exception {
        ContractShape.assertMatches("project.json", body("/api/projects/1"));
    }

    @Test
    void defaultSortAmountDescNullsLast() throws Exception {
        mvc.perform(get("/api/projects"))
                .andExpect(jsonPath("$.items[*].id", contains(2, 3, 1, 5, 4)))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(50))
                .andExpect(jsonPath("$.total").value(5));
    }

    @ParameterizedTest(name = "sort={0} → {1}")
    @CsvSource(delimiter = '|', value = {
            "amountMln,asc    | 5,1,3,2,4",
            "jobs,desc        | 2,1,3,5,4",
            "startYear        | 5,2,1,3,4",
            "launchYear,desc  | 2,1,3,5,4",   // 2026 у 1 и 3 — по id
            "title,asc        | 4,2,1,5,3",
    })
    void sorting(String sort, String expected) throws Exception {
        Integer[] ids = java.util.Arrays.stream(expected.split(",")).map(Integer::valueOf).toArray(Integer[]::new);
        mvc.perform(get("/api/projects").param("sort", sort))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", contains(ids)));
    }

    @Test
    void pagination() throws Exception {
        mvc.perform(get("/api/projects?size=2&page=1"))
                .andExpect(jsonPath("$.items[*].id", contains(1, 5)))
                .andExpect(jsonPath("$.total").value(5));
        mvc.perform(get("/api/projects?size=2&page=9"))
                .andExpect(jsonPath("$.items.length()").value(0))
                .andExpect(jsonPath("$.total").value(5));
    }

    /** Список и /internal/projects при одном фильтре — одни и те же проекты. */
    @ParameterizedTest(name = "[{0}]")
    @ValueSource(strings = {"", "industry=logistics", "need=it_infra&need=info_security", "yearFrom=2027",
            "isKey=true&amountMin=500", "q=%D0%B7%D0%B0%D0%B2%D0%BE%D0%B4"})
    void totalEqualsInternal(String filter) throws Exception {
        long total = JSON.readTree(body("/api/projects?size=1&" + filter)).get("total").asLong();
        int internal = JSON.readTree(body("/internal/projects?" + filter)).size();
        assertThat(total).isEqualTo(internal).isPositive();
    }

    @Test
    void card() throws Exception {
        mvc.perform(get("/api/projects/1"))
                .andExpect(jsonPath("$.title").value("Логистический центр"))
                .andExpect(jsonPath("$.isKey").value(true))
                .andExpect(jsonPath("$.curator").value("Минпром"))
                .andExpect(jsonPath("$.startYear").value(2022))
                .andExpect(jsonPath("$.amountMln").value(1150.0))
                .andExpect(jsonPath("$.recommendedOffers[*].need", contains("it_infra", "phys_security")))
                .andExpect(jsonPath("$.recommendedOffers[1].needName").value("Физическая безопасность"))
                .andExpect(jsonPath("$.updatedAt").value("2026-10-20T10:00:00.123456Z"));
    }

    @Test
    void cardNotFoundAndBadId() throws Exception {
        mvc.perform(get("/api/projects/999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.error.message").value("Проект 999 не найден"));
        mvc.perform(get("/api/projects/abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details.field").value("id"));
    }

    @Test
    void relatedCompaniesPathStillWorks() throws Exception {
        // /api/projects/{id} не перехватывает /api/projects/{id}/related-companies (related/, Java #2)
        mvc.perform(get("/api/projects/1/related-companies")).andExpect(status().isOk())
                .andExpect(jsonPath("$.projectId").value(1));
    }

    @ParameterizedTest(name = "{0} → 400 field={1}")
    @CsvSource(delimiter = '|', value = {
            "sort=amount           | sort",
            "sort=title,up         | sort",
            "size=201              | size",
            "size=0                | size",
            "page=-1               | page",
            "need=internet         | need",
            "yearFrom=2027&yearTo=2020 | yearFrom",
    })
    void invalidParams(String query, String field) throws Exception {
        mvc.perform(get("/api/projects?" + query))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details.field").value(field));
    }

    @Test
    void swagger() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/projects'].get.parameters[*].name", org.hamcrest.Matchers.hasItems(
                        "page", "size", "sort", "stage", "industry", "need", "municipalityId", "yearFrom", "yearTo",
                        "isKey", "amountMin", "q")))
                .andExpect(jsonPath("$.paths['/api/projects/{id}'].get").exists());
    }
}
