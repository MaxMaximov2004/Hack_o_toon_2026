package ru.rt.radar.radar.filter;

import io.swagger.v3.oas.models.media.ArraySchema;
import io.swagger.v3.oas.models.media.BooleanSchema;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.NumberSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.Parameter;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import static ru.rt.radar.radar.filter.CompanyFilterParser.*;

/**
 * Описание параметров CompanyFilter для Swagger. Резолвер разбирает фильтр сам, поэтому springdoc
 * не видит его поля — их добавляет OperationCustomizer (config/OpenApiConfig) по этому списку.
 */
public final class CompanyFilterOpenApi {

    private CompanyFilterOpenApi() {
    }

    public static List<Parameter> parameters() {
        return List.of(
                param(CLIENT, enumSchema(ClientMode.class)._default(ClientMode.ALL.code()),
                        "Наши / не наши: all — все, ours — только клиенты РТ, others — только не клиенты"),
                param(STATUS, enumSchema(StatusMode.class)._default(StatusMode.ACTIVE.code()),
                        "Статус в реестре МСП: active — действующие, excluded — только исключённые из реестра, all — все"),
                multi(INDUSTRY, enumSchema(Industry.class), "Отрасль; несколько — повтором параметра: " + legend(Industry.class)),
                param(REVENUE_MIN, new NumberSchema().minimum(BigDecimal.ZERO),
                        "Выручка от, руб/год (оценка). При заданной границе компании без выручки не попадают"),
                param(REVENUE_MAX, new NumberSchema().minimum(BigDecimal.ZERO), "Выручка до, руб/год (оценка)"),
                param(MIN_LAT, new NumberSchema(), "Окно карты: южная граница. Задаются все четыре границы или ни одной"),
                param(MAX_LAT, new NumberSchema(), "Окно карты: северная граница"),
                param(MIN_LON, new NumberSchema(), "Окно карты: западная граница"),
                param(MAX_LON, new NumberSchema(), "Окно карты: восточная граница"),
                multi(MUNICIPALITY_ID, new IntegerSchema(), "Район или город (id из /api/dictionaries); несколько — повтором"),
                multi(SIZE_CATEGORY, enumSchema(SizeCategory.class), "Категория МСП; несколько — повтором: " + legend(SizeCategory.class)),
                param(GROWTH_MIN, new NumberSchema(), "Рост выручки от, % год к году (оценка)"),
                param(IS_NEW, new BooleanSchema(), "true — только вновь созданные компании; false — условие не задано"),
                param(Q, new StringSchema().minLength(Q_MIN).maxLength(Q_MAX), "Поиск: часть названия или начало ИНН"),
                param(RELOCATED, new BooleanSchema(),
                        "true — только «работает не там, где зарегистрирован» (есть фактическое место в другом районе или регионе)")
        );
    }

    public static Parameter param(String name, Schema<?> schema, String description) {
        return new Parameter().in("query").name(name).required(false).schema(schema).description(description);
    }

    public static Parameter multi(String name, Schema<?> items, String description) {
        return param(name, new ArraySchema().items(items), description)
                .style(Parameter.StyleEnum.FORM).explode(true);
    }

    public static <E extends Enum<E> & CodedEnum> StringSchema enumSchema(Class<E> type) {
        StringSchema s = new StringSchema();
        CodedEnum.codes(type).forEach(s::addEnumItem);
        return s;
    }

    public static <E extends Enum<E> & CodedEnum> String legend(Class<E> type) {
        return Arrays.stream(type.getEnumConstants())
                .map(e -> e.code() + " — " + e.title())
                .collect(Collectors.joining(", "));
    }
}
