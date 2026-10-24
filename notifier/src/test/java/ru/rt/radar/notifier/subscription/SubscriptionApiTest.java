package ru.rt.radar.notifier.subscription;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import ru.rt.radar.notifier.ContractShape;
import ru.rt.radar.notifier.DbWebTest;

import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SubscriptionApiTest extends DbWebTest {

    private void subscribe(long user, String json) throws Exception {
        mvc.perform(post("/api/subscriptions").with(user(user)).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated());
    }

    @Test
    void createAndListOwnOnly() throws Exception {
        mvc.perform(post("/api/subscriptions").with(user(1)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"industry\":\"logistics\",\"municipalityId\":53}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.industry").value("logistics"))
                .andExpect(jsonPath("$.municipalityId").value(53))
                .andExpect(jsonPath("$.need").isEmpty())
                .andExpect(jsonPath("$.createdAt").isString());
        subscribe(1, "{\"need\":\"phys_security\",\"stage\":\"construction\"}");
        subscribe(2, "{\"industry\":\"agro\"}");

        String json = mvc.perform(get("/api/subscriptions").with(user(1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].need", contains("phys_security", null)))   // новые сверху
                .andReturn().getResponse().getContentAsString();
        ContractShape.assertMatches("subscriptions.json", json);
    }

    @Test
    void emptySubscriptionIs400NotUnprocessable() throws Exception {
        mvc.perform(post("/api/subscriptions").with(user(1)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details.field").value("industry"));
    }

    @Test
    void unknownCodeIs400WithField() throws Exception {
        mvc.perform(post("/api/subscriptions").with(user(1)).contentType(MediaType.APPLICATION_JSON).content("{\"stage\":\"done\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details.field").value("stage"));
    }

    @Test
    void deleteOwnOnly() throws Exception {
        subscribe(1, "{\"industry\":\"it\"}");
        mvc.perform(delete("/api/subscriptions/1").with(user(2))).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
        mvc.perform(delete("/api/subscriptions/1").with(user(1))).andExpect(status().isNoContent());
        mvc.perform(get("/api/subscriptions").with(user(1))).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void withoutTokenIs401() throws Exception {
        mvc.perform(get("/api/subscriptions")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }
}
