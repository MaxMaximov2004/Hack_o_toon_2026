package ru.rt.radar.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasKey;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Кнопка Authorize в Swagger: схемы и какая из них у какого пути. БД не нужна. */
@SpringBootTest(properties = "spring.datasource.url=jdbc:postgresql://127.0.0.1:1/none")
@AutoConfigureMockMvc
class OpenApiSecurityTest {

    @Autowired
    MockMvc mvc;

    @Test
    void schemesAndRequirementsByPath() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.type").value("http"))
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.scheme").value("bearer"))
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.bearerFormat").value("JWT"))
                .andExpect(jsonPath("$.components.securitySchemes.internalToken.type").value("apiKey"))
                .andExpect(jsonPath("$.components.securitySchemes.internalToken.in").value("header"))
                .andExpect(jsonPath("$.components.securitySchemes.internalToken.name").value("X-Internal-Token"))
                .andExpect(jsonPath("$.paths['/api/companies'].get.security[*]", everyItem(hasKey("bearerAuth"))))
                .andExpect(jsonPath("$.paths['/api/clients/import'].post.security[0].bearerAuth").exists())
                .andExpect(jsonPath("$.paths['/api/companies/{id}/locations/{locationId}'].delete.security[0].bearerAuth").exists())
                .andExpect(jsonPath("$.paths['/internal/companies'].get.security[0].internalToken").exists())
                .andExpect(jsonPath("$.paths['/internal/projects'].get.security[0].internalToken").exists())
                .andExpect(jsonPath("$.paths['/health'].get.security").doesNotExist());
    }

    @Test
    void swaggerUiKeepsToken() throws Exception {
        mvc.perform(get("/v3/api-docs/swagger-config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.persistAuthorization").value(true));
    }
}
