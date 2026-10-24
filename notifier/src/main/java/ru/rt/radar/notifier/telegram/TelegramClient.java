package ru.rt.radar.notifier.telegram;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Bot API Telegram по HTTPS. Входящие команды — long polling (getUpdates), без вебхука: не нужен белый IP и сертификат.
 * Токена нет — клиент выключен ({@link #enabled()} = false), остальные функции notifier работают.
 */
@Component
public class TelegramClient {

    /** Long polling: сервер держит запрос до 25 с, если сообщений нет. */
    static final int POLL_SECONDS = 25;

    private final RestClient http;
    private final boolean enabled;

    public TelegramClient(@Value("${radar.telegram-bot-token:}") String token,
                          @Value("${radar.telegram-api-url}") String apiUrl,
                          RestClient.Builder builder) {
        this.enabled = StringUtils.hasText(token);
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(POLL_SECONDS + 10));
        this.http = builder.baseUrl(apiUrl + "/bot" + token).requestFactory(factory).build();
    }

    public boolean enabled() {
        return enabled;
    }

    /** Имя бота для ссылки https://t.me/<username>. */
    public String botUsername() {
        return call("getMe", Map.of()).path("username").asText(null);
    }

    public List<Update> getUpdates(long offset) {
        JsonNode result = call("getUpdates", Map.of("offset", offset, "timeout", POLL_SECONDS, "allowed_updates", List.of("message")));
        List<Update> updates = new ArrayList<>();
        for (JsonNode u : result) {
            JsonNode message = u.path("message");
            updates.add(new Update(u.path("update_id").asLong(),
                    message.path("chat").path("id").asLong(), message.path("text").asText("")));
        }
        return updates;
    }

    public void sendMessage(long chatId, String text) {
        call("sendMessage", Map.of("chat_id", chatId, "text", text));
    }

    private JsonNode call(String method, Map<String, Object> body) {
        JsonNode response = http.post().uri("/" + method).contentType(MediaType.APPLICATION_JSON).body(body)
                .retrieve().body(JsonNode.class);
        if (response == null || !response.path("ok").asBoolean()) {
            throw new IllegalStateException(method + ": " + (response == null ? "пустой ответ" : response.path("description").asText()));
        }
        return response.path("result");
    }

    public record Update(long updateId, long chatId, String text) {
    }
}
