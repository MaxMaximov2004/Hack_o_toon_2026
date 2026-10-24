package ru.rt.radar.radar.dictionary;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import ru.rt.radar.ContractShape;
import ru.rt.radar.DbWebTest;
import ru.rt.radar.TestDb;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DictionaryApiTest extends DbWebTest {

    @BeforeAll
    static void data() {
        TestDb.resetStandardData();
    }

    @Test
    void matchesContractExample() throws Exception {
        String body = mvc.perform(get("/api/dictionaries"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        ContractShape.assertMatches("dictionaries.json", body);
    }

    @Test
    void codesAndOrder() throws Exception {
        mvc.perform(get("/api/dictionaries"))
                .andExpect(jsonPath("$.industries[*].code", contains("agro", "energy", "manufacturing", "construction",
                        "trade", "logistics", "hospitality", "it", "realestate", "services", "other")))
                .andExpect(jsonPath("$.industries[0].name").value("Сельское хозяйство"))
                .andExpect(jsonPath("$.sizeCategories[*].code", contains("micro", "small", "medium")))
                // ORDER BY kind DESC, name: сначала районы, потом города
                .andExpect(jsonPath("$.municipalities[*].name", contains("Тестовый р-н", "г. Тестоград")))
                .andExpect(jsonPath("$.municipalities[1].lat").value(47.2))
                .andExpect(jsonPath("$.stages[*].code", contains("design", "construction", "launch")))
                .andExpect(jsonPath("$.needs[*].code", contains("it_infra", "apcs", "phys_security", "info_security")));
    }

    /**
     * Статические справочники — ровно как в примере (коды, названия, порядок). ContractShape проверяет только форму
     * и пустой массив не ловит — поэтому здесь сравнение значений.
     */
    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"industries", "sizeCategories", "stages", "needs"})
    void staticDictionariesEqualExample(String field) throws Exception {
        String body = mvc.perform(get("/api/dictionaries")).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        JsonNode actual = new ObjectMapper().readTree(body).get(field);
        assertThat(actual).isEqualTo(ContractShape.example("dictionaries.json").get(field));
    }
}
