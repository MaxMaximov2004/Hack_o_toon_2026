package ru.rt.radar.common.exception;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Все ошибки — в формате контракта { "error": { "code", "message", "details" } }. БД не нужна. */
@WebMvcTest(ErrorProbeController.class)
class GlobalExceptionHandlerTest {

    @Autowired
    MockMvc mvc;

    @Test
    void validationException() throws Exception {
        mvc.perform(get("/test/errors/validation"))
                .andExpect(status().isBadRequest())
                .andExpect(content().json("""
                        {"error":{"code":"VALIDATION_ERROR","message":"revenueMin больше revenueMax",
                                  "details":{"field":"revenueMin"}}}""", true));
    }

    @Test
    void notFoundWithNullDetails() throws Exception {
        mvc.perform(get("/test/errors/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(content().json("""
                        {"error":{"code":"NOT_FOUND","message":"Компания 42 не найдена","details":null}}""", true));
    }

    @Test
    void tooLargeHasTotal() throws Exception {
        mvc.perform(get("/test/errors/too-large"))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.error.code").value("TOO_LARGE"))
                .andExpect(jsonPath("$.error.details.total").value(250_000))
                .andExpect(jsonPath("$.error.details.limit").value(100_000));
    }

    @Test
    void unhandledHidesMessage() throws Exception {
        mvc.perform(get("/test/errors/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.error.message").value("Внутренняя ошибка сервиса"))
                .andExpect(content().string(not(containsString("пароль"))));
    }

    @Test
    void typeMismatch() throws Exception {
        mvc.perform(get("/test/errors/typed/abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.message").value("Неверное значение параметра id='abc', ожидается int"))
                .andExpect(jsonPath("$.error.details.field").value("id"));
    }

    @Test
    void missingParam() throws Exception {
        mvc.perform(get("/test/errors/required"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details.field").value("name"));
    }

    @Test
    void paramConstraint() throws Exception {
        mvc.perform(get("/test/errors/min?size=0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details.field").value("size"))
                .andExpect(jsonPath("$.error.message").value(containsString("size")));
    }

    @Test
    void bodyValidationListsAllFields() throws Exception {
        mvc.perform(post("/test/errors/body").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"size\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details.fields.name").exists())
                .andExpect(jsonPath("$.error.details.fields.size").exists());
    }

    @Test
    void brokenJson() throws Exception {
        mvc.perform(post("/test/errors/body").contentType(MediaType.APPLICATION_JSON).content("{oops"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Тело запроса не читается: проверьте JSON"));
    }

    @Test
    void unsupportedMediaType() throws Exception {
        mvc.perform(post("/test/errors/body").contentType(MediaType.TEXT_PLAIN).content("x"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void methodNotAllowed() throws Exception {
        mvc.perform(post("/test/errors/validation"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.error.message").value("Метод 'POST' не поддерживается. Доступные методы: GET"));
    }

    @Test
    void unknownPath() throws Exception {
        mvc.perform(get("/test/no-such-path"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.error.message").value("Путь не найден: /test/no-such-path"));
    }
}
