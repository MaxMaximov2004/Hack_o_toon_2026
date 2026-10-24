package ru.rt.radar.common.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Правила доступа целиком: настоящий SecurityConfig, JWKS по HTTP (contracts/dev-keys/jwks.json),
 * токены подписаны dev-ключом. БД не нужна (Hikari стартует лениво).
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:postgresql://127.0.0.1:1/none",
        "radar.internal-token=test-internal-token"})
@AutoConfigureMockMvc
class SecurityTest {

    private static final String JWKS_URL = DevTokens.startJwksServer();

    @DynamicPropertySource
    static void jwks(DynamicPropertyRegistry registry) {
        registry.add("radar.auth-jwks-url", () -> JWKS_URL);
    }

    @Autowired
    MockMvc mvc;

    private ResultActions whoami(String token) throws Exception {
        return mvc.perform(get("/api/test/whoami").header("Authorization", "Bearer " + token));
    }

    private static void unauthorized(ResultActions result, String message) throws Exception {
        result.andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.error.message").value(message))
                .andExpect(jsonPath("$.error.details").value(nullValue()));
    }

    @Test
    void noTokenIs401InContractFormat() throws Exception {
        unauthorized(mvc.perform(get("/api/test/whoami"))
                        .andExpect(header().string("WWW-Authenticate", "Bearer")),
                "Требуется вход: передайте заголовок Authorization: Bearer <accessToken>");
    }

    @Test
    void validTokenPassesWithRoles() throws Exception {
        whoami(DevTokens.valid("manager", "admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", contains("ROLE_ADMIN", "ROLE_MANAGER")));
    }

    @Test
    void tokenWithoutOtpRejected() throws Exception {
        unauthorized(whoami(DevTokens.withoutOtp()), "Токен недействителен или истёк — войдите заново");
    }

    @Test
    void foreignIssuerRejected() throws Exception {
        unauthorized(whoami(DevTokens.withIssuer("evil")), "Токен недействителен или истёк — войдите заново");
    }

    @Test
    void expiredRejected() throws Exception {
        unauthorized(whoami(DevTokens.expired()), "Токен недействителен или истёк — войдите заново");
    }

    @Test
    void foreignKeyRejected() throws Exception {
        unauthorized(whoami(DevTokens.foreignKey()), "Токен недействителен или истёк — войдите заново");
    }

    @Test
    void garbageRejected() throws Exception {
        unauthorized(whoami("not-a-jwt"), "Токен недействителен или истёк — войдите заново");
    }

    @Test
    void importNeedsAdmin() throws Exception {
        mvc.perform(post("/api/clients/import").header("Authorization", "Bearer " + DevTokens.valid("manager")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
        // Настоящий эндпоинт (clients/): admin проходит проверку доступа; без файла — уже ошибка запроса, но не 403
        mvc.perform(post("/api/clients/import").header("Authorization", "Bearer " + DevTokens.valid("manager", "admin")))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isNotEqualTo(403));
    }

    @Test
    void locationsImportNeedsAdmin() throws Exception {
        mvc.perform(post("/api/locations/import").header("Authorization", "Bearer " + DevTokens.valid("manager")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
        mvc.perform(post("/api/locations/import").header("Authorization", "Bearer " + DevTokens.valid("manager", "admin")))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isNotEqualTo(403));
    }

    @Test
    void internalNeedsInternalToken() throws Exception {
        unauthorized(mvc.perform(get("/internal/test/probe")), "Нужен верный заголовок X-Internal-Token");
        unauthorized(mvc.perform(get("/internal/test/probe").header("X-Internal-Token", "wrong")),
                "Нужен верный заголовок X-Internal-Token");
        // JWT вместо внутреннего токена не годится
        unauthorized(mvc.perform(get("/internal/test/probe").header("Authorization", "Bearer " + DevTokens.valid("admin"))),
                "Нужен верный заголовок X-Internal-Token");
        mvc.perform(get("/internal/test/probe").header("X-Internal-Token", "test-internal-token"))
                .andExpect(status().isOk());
    }

    @Test
    void swaggerIsPublic() throws Exception {
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk());
    }

    @Test
    void unknownApiPathWithoutTokenIs401NotLeak() throws Exception {
        mvc.perform(get("/api/no-such-path")).andExpect(status().isUnauthorized());
    }
}
