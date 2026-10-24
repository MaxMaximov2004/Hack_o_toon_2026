package ru.rt.radar.related;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import ru.rt.radar.ContractShape;
import ru.rt.radar.DbWebTest;
import ru.rt.radar.TestDb;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Стандартный набор компаний TestDb + проекты под каждое правило. */
class RelatedCompaniesApiTest extends DbWebTest {

    @BeforeEach
    void data() {
        TestDb.resetStandardData();   // TRUNCATE municipality CASCADE очищает и invest_project
        TestDb.jdbc().update("""
                INSERT INTO company (inn, name, subject_type, industry, municipality_id, lat, lon, size_category, is_client, status)
                VALUES ('6100000009', 'ООО "ДУБЛЬ"', 'legal', 'agro', 1, 47.2, 39.7, 'micro', false, 'active'),
                       ('6100000010', 'АО "Дубль"',  'legal', 'agro', 2, 46.5, 41.5, 'micro', false, 'active')
                """);
        TestDb.jdbc().update("""
                INSERT INTO invest_project (id, municipality_id, initiator, title, industry, needs) VALUES
                (1, 1, 'ООО «Бета»',            'Склад',          'logistics', '{it_infra}'),
                (2, 1, 'ИП Зета',               'Торговый центр', 'trade',     '{it_infra}'),
                (3, 2, 'ООО "НЕТ ТАКОЙ"',       'Без отрасли',    NULL,        '{}'),
                (4, 2, 'Общество с ограниченной ответственностью «Дубль»', 'Ферма', 'agro', '{apcs}')
                """);
    }

    @Test
    void initiatorFirstThenSameAreaIndustry() throws Exception {
        mvc.perform(get("/api/projects/1/related-companies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectId").value(1))
                .andExpect(jsonPath("$.items[*].id", contains(2, 3)))          // БЕТА — инициатор, Гамма — та же отрасль/район
                .andExpect(jsonPath("$.items[*].relation", contains("initiator", "same_area_industry")))
                .andExpect(jsonPath("$.sameAreaIndustryTotal").value(2))
                .andExpect(jsonPath("$.radarQuery").value("industry=logistics&municipalityId=1"));
    }

    @Test
    void prospectsBeforeClientsAndOnlyActive() throws Exception {
        // trade в районе 1: 1 — клиент, 8 — не клиент, 7 — исключён из реестра (не показываем). Инициатор Зета — из района 2
        mvc.perform(get("/api/projects/2/related-companies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", contains(6, 8, 1)))
                .andExpect(jsonPath("$.items[0].relation").value("initiator"))
                .andExpect(jsonPath("$.items[1].kind").value("others"))
                .andExpect(jsonPath("$.items[2].kind").value("ours"))
                .andExpect(jsonPath("$.sameAreaIndustryTotal").value(2));
    }

    @Test
    void noIndustryNoMatch() throws Exception {
        mvc.perform(get("/api/projects/3/related-companies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", empty()))
                .andExpect(jsonPath("$.sameAreaIndustryTotal").value(0))
                .andExpect(jsonPath("$.radarQuery").value(nullValue()));
    }

    @Test
    void ambiguousInitiatorResolvedByMunicipality() throws Exception {
        // «Дубль» есть в районах 1 и 2, проект — в районе 2 → АО "Дубль" (id 10)
        mvc.perform(get("/api/projects/4/related-companies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(10))
                .andExpect(jsonPath("$.items[0].relation").value("initiator"));
    }

    @Test
    void unknownProjectIs404() throws Exception {
        mvc.perform(get("/api/projects/999/related-companies"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    void shapeMatchesContractExample() throws Exception {
        String json = mvc.perform(get("/api/projects/1/related-companies")).andReturn().getResponse().getContentAsString();
        ContractShape.assertMatches("related-companies.json", json);
    }
}
