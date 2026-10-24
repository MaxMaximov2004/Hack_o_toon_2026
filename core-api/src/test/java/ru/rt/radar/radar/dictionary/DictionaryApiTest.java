package ru.rt.radar.radar.dictionary;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import ru.rt.radar.ContractShape;
import ru.rt.radar.DbWebTest;
import ru.rt.radar.TestDb;

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
                .andExpect(jsonPath("$.stages.length()").value(0))
                .andExpect(jsonPath("$.needs.length()").value(0));
    }
}
