package ru.rt.radar.radar;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Резолвер CompanyFilter, формат ошибок и параметры фильтра в OpenAPI. БД не нужна (Hikari стартует лениво). */
@SpringBootTest(properties = "spring.datasource.url=jdbc:postgresql://127.0.0.1:1/none")
@AutoConfigureMockMvc(addFilters = false)   // без JWT: безопасность — в common/security/SecurityTest
class CompanyFilterWebTest {

    @Autowired
    MockMvc mvc;

    @Test
    void filterResolvedFromQuery() throws Exception {
        mvc.perform(get("/test/filter-probe?client=ours&industry=it&industry=trade&isNew=false"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.client").value("OURS"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.industries.length()").value(2))
                .andExpect(jsonPath("$.isNew").value(false))
                .andExpect(jsonPath("$.q").value(nullValue()));
    }

    @Test
    void validationErrorInContractFormat() throws Exception {
        mvc.perform(get("/test/filter-probe?revenueMin=200&revenueMax=100"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.message").value("revenueMin больше revenueMax"))
                .andExpect(jsonPath("$.error.details.field").value("revenueMin"));
    }

    @Test
    void swaggerShowsAllFilterParams() throws Exception {
        String op = "$.paths['/test/filter-probe'].get";
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath(op + ".parameters[*].name", containsInAnyOrder(
                        "client", "status", "industry", "revenueMin", "revenueMax", "minLat", "maxLat",
                        "minLon", "maxLon", "municipalityId", "sizeCategory", "growthMin", "isNew", "q")))
                .andExpect(jsonPath(op + ".parameters[?(@.name == 'industry')].schema.type", hasItem("array")))
                .andExpect(jsonPath(op + ".parameters[?(@.name == 'industry')].schema.items.enum[*]", hasItem("logistics")))
                .andExpect(jsonPath(op + ".parameters[?(@.name == 'status')].schema.default", hasItem("active")));
    }
}
