package ru.rt.radar.common.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** auth-service лежит: сервис стартует (JWKS лениво), а запрос с токеном получает 502, не 500 и не 401. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:postgresql://127.0.0.1:1/none",
        "radar.auth-jwks-url=http://127.0.0.1:1/internal/auth/jwks"})
@AutoConfigureMockMvc
class SecurityJwksDownTest {

    @Autowired
    MockMvc mvc;

    @Test
    void jwksUnavailableIs502() throws Exception {
        mvc.perform(get("/api/test/whoami").header("Authorization", "Bearer " + DevTokens.valid("manager")))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error.code").value("UPSTREAM_UNAVAILABLE"))
                .andExpect(jsonPath("$.error.message").value("Сервис авторизации недоступен — повторите позже"));
    }
}
