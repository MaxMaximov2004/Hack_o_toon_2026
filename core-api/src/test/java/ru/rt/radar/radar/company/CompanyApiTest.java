package ru.rt.radar.radar.company;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import ru.rt.radar.ContractShape;
import ru.rt.radar.DbWebTest;
import ru.rt.radar.TestDb;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** /api/companies и /api/companies/{id} на данных TestDb.resetStandardData() (таблица — в его javadoc). */
class CompanyApiTest extends DbWebTest {

    @BeforeAll
    static void data() {
        TestDb.resetStandardData();
    }

    private String body(String url) throws Exception {
        return mvc.perform(get(url)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    // ---- форма ответа = contracts/examples ----

    @Test
    void listMatchesContractExample() throws Exception {
        ContractShape.assertMatches("companies.json", body("/api/companies?status=all"));
    }

    @Test
    void cardMatchesContractExample() throws Exception {
        ContractShape.assertMatches("company.json", body("/api/companies/1"));
    }

    // ---- значения и форматы ----

    @Test
    void cardValues() throws Exception {
        mvc.perform(get("/api/companies/1"))
                .andExpect(jsonPath("$.inn").value("6100000001"))
                .andExpect(jsonPath("$.industryName").value("Торговля"))
                .andExpect(jsonPath("$.municipalityName").value("г. Тестоград"))
                .andExpect(jsonPath("$.registeredAt").value("2019-07-10"))
                .andExpect(jsonPath("$.kind").value("ours"))
                .andExpect(jsonPath("$.subjectType").value("legal"))
                .andExpect(jsonPath("$.hasLicenses").value(true))
                .andExpect(jsonPath("$.website").value(nullValue()))
                .andExpect(jsonPath("$.settlement").value(nullValue()))
                .andExpect(jsonPath("$.excludedAt").value(nullValue()));
        // выручка — целое число рублей, рост — один знак, null не пропускается
        String card = body("/api/companies/1");
        org.assertj.core.api.Assertions.assertThat(card)
                .contains("\"revenueEst\":10000000,")
                .contains("\"revenueGrowthEst\":5.0,")
                .contains("\"website\":null");
        String gamma = body("/api/companies/3");
        org.assertj.core.api.Assertions.assertThat(gamma)
                .contains("\"employees\":null", "\"revenueEst\":null", "\"revenueGrowthEst\":null", "\"revenueSource\":null");
    }

    @Test
    void excludedCompanyCardOpens() throws Exception {
        mvc.perform(get("/api/companies/4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("excluded"))
                .andExpect(jsonPath("$.status").value("excluded"));
    }

    @Test
    void cardNotFound() throws Exception {
        mvc.perform(get("/api/companies/999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.error.details").value(nullValue()));
    }

    @Test
    void cardBadId() throws Exception {
        mvc.perform(get("/api/companies/abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details.field").value("id"));
    }

    // ---- список: фильтр, сортировка, пагинация ----

    @Test
    void defaultSortRevenueDescNullsLastThenId() throws Exception {
        // действующие: Зета 70M, Бета 50M, Альфа 10M (id 1), Тета 10M (id 8), Эпсилон 3M, Гамма null
        mvc.perform(get("/api/companies"))
                .andExpect(jsonPath("$.items[*].id", contains(6, 2, 1, 8, 5, 3)))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(50))
                .andExpect(jsonPath("$.total").value(6));
    }

    @ParameterizedTest(name = "sort={0} → {1}")
    @CsvSource(delimiter = '|', value = {
            "revenueEst,asc        | 5,1,8,2,6,3",
            "employees,asc         | 1,5,2,3,6,8",   // null — в конце, между собой по id
            "employees,desc        | 2,5,1,3,6,8",
            "revenueGrowthEst,desc | 5,2,1,8,6,3",
            "registeredAt          | 2,6,1,5,8,3",
            "name,asc              | 3,6,1,2,8,5",
    })
    void sorting(String sort, String expected) throws Exception {
        Integer[] ids = java.util.Arrays.stream(expected.split(",")).map(Integer::valueOf).toArray(Integer[]::new);
        mvc.perform(get("/api/companies").param("sort", sort))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", contains(ids)));
    }

    @Test
    void pagination() throws Exception {
        mvc.perform(get("/api/companies?size=2&page=1"))
                .andExpect(jsonPath("$.items[*].id", contains(1, 8)))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.total").value(6));
        mvc.perform(get("/api/companies?size=2&page=10"))
                .andExpect(jsonPath("$.items.length()").value(0))
                .andExpect(jsonPath("$.total").value(6));
    }

    @Test
    void filterAppliedAndTotalConsistent() throws Exception {
        mvc.perform(get("/api/companies?client=ours&status=all"))
                .andExpect(jsonPath("$.items[*].id", contains(4, 6, 1)))
                .andExpect(jsonPath("$.items[*].kind", contains("excluded", "ours", "ours")))
                .andExpect(jsonPath("$.total").value(3));
        mvc.perform(get("/api/companies?minLat=47&maxLat=48&minLon=39&maxLon=40&industry=logistics"))
                .andExpect(jsonPath("$.items[*].id", contains(2, 3)))
                .andExpect(jsonPath("$.total").value(2));
    }

    @ParameterizedTest(name = "{0} → 400 field={1}")
    @CsvSource(delimiter = '|', value = {
            "sort=lat                | sort",
            "sort=name,up            | sort",
            "sort=name,asc,id        | sort",
            "size=201                | size",
            "size=0                  | size",
            "page=-1                 | page",
            "page=abc                | page",
            "industry=nope           | industry",
            "client=false            | client",
    })
    void invalidParams(String query, String field) throws Exception {
        mvc.perform(get("/api/companies?" + query))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details.field").value(field));
    }

    /** relocated: поле в списке, карточке и выгрузке = фильтр; total у списка, карты и выгрузки одинаковый. */
    @Test
    void relocatedFieldMatchesFilterEverywhere() throws Exception {
        TestDb.addLocation("610000000601", "actual", "г. Тестоград", null);      // 6 — другой район
        TestDb.addLocation("6100000001", "actual", "г. Тестоград", null);        // 1 — там же, где зарегистрирован
        try {
            mvc.perform(get("/api/companies?relocated=true"))
                    .andExpect(jsonPath("$.items[*].id", contains(6)))
                    .andExpect(jsonPath("$.items[0].relocated").value(true))
                    .andExpect(jsonPath("$.total").value(1));
            mvc.perform(get("/api/companies/1")).andExpect(jsonPath("$.relocated").value(false));
            mvc.perform(get("/api/companies/6")).andExpect(jsonPath("$.relocated").value(true));
            mvc.perform(get("/api/map/cells?zoom=7&relocated=true"))
                    .andExpect(jsonPath("$.total").value(1))
                    .andExpect(jsonPath("$.points[*].id", contains(6)));
            var started = mvc.perform(get("/internal/companies?relocated=true")).andReturn();
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch(started))
                    .andExpect(jsonPath("$[*].id", contains(6)))
                    .andExpect(jsonPath("$[0].relocated").value(true));
        } finally {
            TestDb.jdbc().update("DELETE FROM company_location");
        }
    }

    @Test
    void swaggerShowsFilterAndPaging() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/companies'].get.parameters[*].name", org.hamcrest.Matchers.hasItems(
                        "client", "status", "industry", "q", "minLat", "page", "size", "sort")))
                .andExpect(jsonPath("$.paths['/api/companies/{id}'].get").exists())
                .andExpect(jsonPath("$.paths['/api/dictionaries'].get").exists());
    }
}
