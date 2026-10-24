package ru.rt.radar.notifier.telegram;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import ru.rt.radar.notifier.ContractShape;
import ru.rt.radar.notifier.DbWebTest;
import ru.rt.radar.notifier.FakeHttp;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Бот настроен: ссылка t.me, /start привязывает чат, новое уведомление уходит в Telegram. Telegram — фейк. */
@TestPropertySource(properties = "radar.telegram-bot-token=TEST")
class TelegramTest extends DbWebTest {

    private static final FakeHttp TG = new FakeHttp()
            .on("/botTEST/getMe", r -> "{\"ok\":true,\"result\":{\"username\":\"radar_test_bot\"}}")
            .on("/botTEST/getUpdates", r -> "{\"ok\":true,\"result\":[]}")
            .on("/botTEST/sendMessage", r -> "{\"ok\":true,\"result\":{}}");

    @DynamicPropertySource
    static void telegram(DynamicPropertyRegistry registry) {
        registry.add("radar.telegram-api-url", TG::url);
    }

    @Autowired
    TelegramService telegram;

    @BeforeEach
    void clearTelegram() {
        TG.requests.clear();
    }

    @Test
    void linkStartAndSend() throws Exception {
        String json = mvc.perform(get("/api/notifications/telegram-link").with(user(7)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.botConfigured").value(true))
                .andExpect(jsonPath("$.linked").value(false))
                .andExpect(jsonPath("$.url", matchesPattern("https://t\\.me/radar_test_bot\\?start=[A-Za-z0-9_-]{16}")))
                .andReturn().getResponse().getContentAsString();
        ContractShape.assertMatches("telegram-link.json", json);
        String token = json.replaceAll(".*start=([A-Za-z0-9_-]+).*", "$1");

        telegram.handle(new TelegramClient.Update(1, 555, "/start " + token));
        mvc.perform(get("/api/notifications/telegram-link").with(user(7))).andExpect(jsonPath("$.linked").value(true));
        assertThat(TG.to("/botTEST/sendMessage").get(0).body()).contains("\"chat_id\":555").contains("Готово");

        // уведомление по подписке уходит в привязанный чат
        mvc.perform(post("/api/subscriptions").with(user(7)).contentType(MediaType.APPLICATION_JSON).content("{\"industry\":\"it\"}"))
                .andExpect(status().isCreated());
        CORE.on("/internal/projects", r -> """
                [{"id":40,"title":"ЦОД","municipalityId":1,"municipalityName":"г. Тестоград","industry":"it","stage":"design",
                  "needs":[],"updatedAt":"%s"}]""".formatted(OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(1)));
        mvc.perform(post("/internal/notifier/check").header("X-Internal-Token", "test-internal-token"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sentToTelegram").value(1));
        assertThat(TG.to("/botTEST/sendMessage")).hasSize(2);
        assertThat(TG.to("/botTEST/sendMessage").get(1).body()).contains("ЦОД").contains("г. Тестоград");
        mvc.perform(get("/api/notifications").with(user(7))).andExpect(jsonPath("$.items[0].sentToTelegram").value(true));
    }

    @Test
    void plainStartFromSearchGetsInstructions() {
        telegram.handle(new TelegramClient.Update(3, 888, "/start"));
        assertThat(TG.to("/botTEST/sendMessage"))
                .anyMatch(r -> r.body().contains("\"chat_id\":888") && r.body().contains("Подключить Telegram"));
    }

    @Test
    void unknownStartTokenGetsHint() {
        telegram.handle(new TelegramClient.Update(2, 777, "/start nope"));
        assertThat(TG.to("/botTEST/sendMessage")).anyMatch(r -> r.body().contains("\"chat_id\":777") && r.body().contains("устарела"));
    }
}
