package ru.rt.radar.invest;

import io.swagger.v3.oas.models.media.BooleanSchema;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.NumberSchema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.Parameter;
import ru.rt.radar.radar.filter.Industry;
import ru.rt.radar.radar.filter.Need;
import ru.rt.radar.radar.filter.QueryParams;
import ru.rt.radar.radar.filter.Stage;

import java.math.BigDecimal;
import java.util.List;

import static ru.rt.radar.invest.ProjectFilterParser.*;
import static ru.rt.radar.radar.filter.CompanyFilterOpenApi.enumSchema;
import static ru.rt.radar.radar.filter.CompanyFilterOpenApi.legend;
import static ru.rt.radar.radar.filter.CompanyFilterOpenApi.multi;
import static ru.rt.radar.radar.filter.CompanyFilterOpenApi.param;

/** Параметры ProjectFilter для Swagger — их добавляет OperationCustomizer в config/OpenApiConfig. */
public final class ProjectFilterOpenApi {

    private ProjectFilterOpenApi() {
    }

    public static List<Parameter> parameters() {
        return List.of(
                multi(STAGE, enumSchema(Stage.class), "Стадия; несколько — повтором: " + legend(Stage.class)),
                multi(INDUSTRY, enumSchema(Industry.class), "Отрасль (коды как у компаний); несколько — повтором"),
                multi(NEED, enumSchema(Need.class), "Потребность — есть хотя бы одна из выбранных; несколько — повтором: "
                        + legend(Need.class)),
                multi(MUNICIPALITY_ID, new IntegerSchema(), "Район или город (id из /api/dictionaries); несколько — повтором"),
                param(YEAR_FROM, new IntegerSchema().minimum(BigDecimal.valueOf(MIN_YEAR)).maximum(BigDecimal.valueOf(MAX_YEAR)),
                        "Период: проект идёт в эти годы (start ≤ yearTo и launch ≥ yearFrom; неизвестный год не отсекает)"),
                param(YEAR_TO, new IntegerSchema().minimum(BigDecimal.valueOf(MIN_YEAR)).maximum(BigDecimal.valueOf(MAX_YEAR)),
                        "Период: по какой год"),
                param(IS_KEY, new BooleanSchema(), "true — только ключевые проекты; false — условие не задано"),
                param(AMOUNT_MIN, new NumberSchema().minimum(BigDecimal.ZERO), "Объём инвестиций от, млн руб."),
                param(Q, new StringSchema().minLength(QueryParams.Q_MIN).maxLength(QueryParams.Q_MAX),
                        "Поиск: часть названия проекта или инициатора")
        );
    }
}
