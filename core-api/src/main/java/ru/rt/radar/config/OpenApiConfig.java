package ru.rt.radar.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.HandlerMethod;
import ru.rt.radar.common.security.InternalTokenFilter;
import ru.rt.radar.invest.ProjectFilter;
import ru.rt.radar.invest.ProjectFilterOpenApi;
import ru.rt.radar.radar.filter.CompanyFilter;
import ru.rt.radar.radar.filter.CompanyFilterOpenApi;

import java.util.Arrays;

@Configuration
public class OpenApiConfig {

    /** Имена схем в Swagger — кнопка Authorize. Правила доступа те же, что в common/security/SecurityConfig. */
    static final String BEARER = "bearerAuth";
    static final String INTERNAL = "internalToken";

    static {
        // Фильтры разбирают свои резолверы — springdoc не должен выводить их как один параметр-объект
        SpringDocUtils.getConfig().addRequestWrapperToIgnore(CompanyFilter.class, ProjectFilter.class);
    }

    @Bean
    public OpenAPI coreApiOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("core-api — Радар присутствия")
                        .version("0.1")
                        .description("Компании, карта, статистика районов, белые пятна, инвестпроекты, импорт клиентов и "
                                + "фактических адресов. Контракт — docs/tz/00-common.md, 02-java-1-core-api.md, "
                                + "08-product2-contract.md.\n\n"
                                + "**Try it out для /api/**:** войдите (auth-service: `POST /api/auth/login` → "
                                + "`POST /api/auth/2fa/verify`), скопируйте `accessToken`, нажмите **Authorize** → "
                                + "`bearerAuth` и вставьте токен без слова Bearer. Импорт — только с ролью admin."))
                .components(new Components()
                        .addSecuritySchemes(BEARER, new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")
                                .description("accessToken от auth-service (RS256, iss = radar-auth, вход с 2FA)"))
                        .addSecuritySchemes(INTERNAL, new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.HEADER)
                                .name(InternalTokenFilter.HEADER)
                                .description("Для соседних сервисов (INTERNAL_TOKEN). Снаружи nginx отдаёт на /internal/ 404 "
                                        + "— Try it out работает только напрямую на core-api:8080")));
    }

    /** /api/** — JWT, /internal/** — X-Internal-Token, остальное (/health) — без авторизации. */
    @Bean
    public OpenApiCustomizer securityByPath() {
        return openApi -> openApi.getPaths().forEach((path, item) -> {
            String scheme = path.startsWith("/api/") ? BEARER : path.startsWith("/internal/") ? INTERNAL : null;
            if (scheme != null) {
                item.readOperations().forEach(op -> op.addSecurityItem(new SecurityRequirement().addList(scheme)));
            }
        });
    }

    /** Эндпоинтам с параметром CompanyFilter / ProjectFilter — все параметры фильтра в Swagger. */
    @Bean
    public OperationCustomizer companyFilterParameters() {
        return (operation, handlerMethod) -> {
            if (uses(handlerMethod, CompanyFilter.class)) {
                CompanyFilterOpenApi.parameters().forEach(operation::addParametersItem);
            }
            if (uses(handlerMethod, ProjectFilter.class)) {
                ProjectFilterOpenApi.parameters().forEach(operation::addParametersItem);
            }
            return operation;
        };
    }

    private static boolean uses(HandlerMethod handlerMethod, Class<?> type) {
        return Arrays.stream(handlerMethod.getMethodParameters()).anyMatch(p -> type.equals(p.getParameterType()));
    }
}
