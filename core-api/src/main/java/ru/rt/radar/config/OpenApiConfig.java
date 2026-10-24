package ru.rt.radar.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.rt.radar.radar.filter.CompanyFilter;
import ru.rt.radar.radar.filter.CompanyFilterOpenApi;

import java.util.Arrays;

@Configuration
public class OpenApiConfig {

    static {
        // CompanyFilter разбирает свой резолвер — springdoc не должен выводить его как один параметр-объект
        SpringDocUtils.getConfig().addRequestWrapperToIgnore(CompanyFilter.class);
    }

    @Bean
    public OpenAPI coreApiOpenApi() {
        return new OpenAPI().info(new Info()
                .title("core-api — Радар присутствия")
                .version("0.1")
                .description("Компании, карта, статистика районов и белые пятна. Контракт — docs/tz/00-common.md, 02-java-1-core-api.md"));
    }

    /** Эндпоинтам с параметром CompanyFilter — все параметры фильтра в Swagger. */
    @Bean
    public OperationCustomizer companyFilterParameters() {
        return (operation, handlerMethod) -> {
            boolean usesFilter = Arrays.stream(handlerMethod.getMethodParameters())
                    .anyMatch(p -> CompanyFilter.class.equals(p.getParameterType()));
            if (usesFilter) {
                CompanyFilterOpenApi.parameters().forEach(operation::addParametersItem);
            }
            return operation;
        };
    }
}
