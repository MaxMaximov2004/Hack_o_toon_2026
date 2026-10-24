package ru.rt.radar.notifier;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI notifierOpenApi() {
        return new OpenAPI().info(new Info()
                .title("notifier — Инвестиционный навигатор")
                .version("0.1")
                .description("Подписки на инвестпроекты, лента уведомлений, Telegram. Контракт — docs/tz/08-product2-contract.md"));
    }
}
