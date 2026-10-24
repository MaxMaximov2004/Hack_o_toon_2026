package ru.rt.radar.notifier.worker;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import ru.rt.radar.notifier.ContractShape;
import ru.rt.radar.notifier.DbWebTest;
import ru.rt.radar.notifier.TestDb;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Воркер целиком: core-api (фейк) → подписки → лента; ручной запуск POST /internal/notifier/check. */
class ProjectCheckTest extends DbWebTest {

    private static final AtomicReference<String> PROJECTS = new AtomicReference<>("[]");

    static {
        CORE.on("/internal/projects", r -> PROJECTS.get());
    }

    private static String project(int id, String title, int municipalityId, String industry, String stage,
                                  String needs, OffsetDateTime updatedAt) {
        return """
                {"id":%d,"title":"%s","initiator":null,"municipalityId":%d,"municipalityName":"г. Тестоград","lat":47.2,"lon":39.7,
                 "isKey":false,"curator":null,"startYear":2026,"launchYear":2028,"amountMln":100.0,"jobs":10,
                 "stage":"%s","stageName":null,"industry":"%s","industryName":null,"needs":%s,"recommendedOffers":[],
                 "updatedAt":"%s"}""".formatted(id, title, municipalityId, stage, industry, needs, updatedAt);
    }

    private void subscribe(long user, String json) throws Exception {
        mvc.perform(post("/api/subscriptions").with(user(user)).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated());
    }

    private void check() throws Exception {
        mvc.perform(post("/internal/notifier/check").header("X-Internal-Token", "test-internal-token"))
                .andExpect(status().isOk());
    }

    @Test
    void matchingNewProjectsBecomeNotificationsOnce() throws Exception {
        subscribe(1, "{\"industry\":\"logistics\",\"municipalityId\":1}");
        subscribe(1, "{\"need\":\"phys_security\"}");
        subscribe(2, "{\"stage\":\"design\"}");
        OffsetDateTime later = OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(1);
        OffsetDateTime earlier = OffsetDateTime.now(ZoneOffset.UTC).minusDays(1);
        PROJECTS.set("[" + String.join(",",
                project(10, "Склад", 1, "logistics", "construction", "[\"it_infra\"]", later),          // user 1, подписка 1
                project(11, "Завод", 2, "manufacturing", "construction", "[\"phys_security\"]", later), // user 1, подписка 2
                project(12, "Старый склад", 1, "logistics", "construction", "[]", earlier),            // раньше подписки — нет
                project(13, "Ферма", 2, "agro", "launch", "[]", later)) + "]");                         // никому

        check();
        check();   // повторная проверка ничего не дублирует

        String feed = mvc.perform(get("/api/notifications").with(user(1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].projectId", contains(11, 10)))
                .andExpect(jsonPath("$.items[0].municipalityName").value("г. Тестоград"))
                .andExpect(jsonPath("$.unreadCount").value(2))
                .andReturn().getResponse().getContentAsString();
        ContractShape.assertMatches("notifications.json", feed);
        mvc.perform(get("/api/notifications").with(user(2))).andExpect(jsonPath("$.items.length()").value(0));
        assertThat(TestDb.jdbc().queryForObject("SELECT count(*) FROM notification", Integer.class)).isEqualTo(2);
    }

    @Test
    void asksCoreApiOnlyForNewAndSendsInternalToken() throws Exception {
        OffsetDateTime t = OffsetDateTime.parse("2030-01-01T10:00:00Z");
        PROJECTS.set("[" + project(20, "П", 1, "it", "design", "[]", t) + "]");
        check();
        check();
        assertThat(CORE.to("/internal/projects")).hasSize(2);
        assertThat(CORE.to("/internal/projects").get(0).query()).isNull();
        assertThat(CORE.to("/internal/projects").get(1).query()).isEqualTo("updatedSince=2030-01-01T10:00Z");
        assertThat(CORE.to("/internal/projects").get(1).headers().get("X-internal-token")).containsExactly("test-internal-token");
    }

    @Test
    void readAndReadAll() throws Exception {
        subscribe(1, "{\"industry\":\"it\"}");
        OffsetDateTime later = OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(1);
        PROJECTS.set("[" + project(30, "А", 1, "it", "design", "[]", later) + "," + project(31, "Б", 1, "it", "design", "[]", later) + "]");
        check();
        long first = TestDb.jdbc().queryForObject("SELECT min(id) FROM notification", Long.class);

        mvc.perform(post("/api/notifications/" + first + "/read").with(user(2))).andExpect(status().isNotFound());
        mvc.perform(post("/api/notifications/" + first + "/read").with(user(1))).andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications?unread=true").with(user(1)))
                .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.unreadCount").value(1));
        mvc.perform(post("/api/notifications/read-all").with(user(1))).andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications").with(user(1))).andExpect(jsonPath("$.unreadCount").value(0));
    }

    @Test
    void manualCheckNeedsInternalToken() throws Exception {
        mvc.perform(post("/internal/notifier/check")).andExpect(status().isUnauthorized());
        mvc.perform(post("/internal/notifier/check").with(user(1))).andExpect(status().isUnauthorized());
    }

    @Test
    void coreApiDownIsNotFatal() throws Exception {
        PROJECTS.set("not json");
        mvc.perform(post("/internal/notifier/check").header("X-Internal-Token", "test-internal-token"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error.code").value("UPSTREAM_UNAVAILABLE"));
        PROJECTS.set("[]");
        check();
    }
}
