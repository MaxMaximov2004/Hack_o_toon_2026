package ru.rt.radar.invest;

import ru.rt.radar.common.exception.ValidationException;
import ru.rt.radar.radar.filter.CodedEnum;
import ru.rt.radar.radar.filter.Industry;
import ru.rt.radar.radar.filter.Need;
import ru.rt.radar.radar.filter.Stage;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static ru.rt.radar.radar.filter.QueryParams.*;

/**
 * Разбор и проверка ProjectFilter — по тем же правилам, что CompanyFilter ({@link ru.rt.radar.radar.filter.QueryParams}).
 * Параметры, не относящиеся к фильтру (page, size, sort, updatedSince, format), игнорируются.
 */
public final class ProjectFilterParser {

    public static final String STAGE = "stage";
    public static final String INDUSTRY = "industry";
    public static final String NEED = "need";
    public static final String MUNICIPALITY_ID = "municipalityId";
    public static final String YEAR_FROM = "yearFrom";
    public static final String YEAR_TO = "yearTo";
    public static final String IS_KEY = "isKey";
    public static final String AMOUNT_MIN = "amountMin";
    public static final String Q = "q";

    static final int MIN_YEAR = 1900;
    static final int MAX_YEAR = 2100;

    private ProjectFilterParser() {
    }

    public static ProjectFilter parse(Map<String, String[]> params) {
        List<Stage> stages = multi(params, STAGE, v -> CodedEnum.fromCode(Stage.class, v, STAGE));
        List<Industry> industries = multi(params, INDUSTRY, v -> CodedEnum.fromCode(Industry.class, v, INDUSTRY));
        List<Need> needs = multi(params, NEED, v -> CodedEnum.fromCode(Need.class, v, NEED));
        List<Integer> municipalityIds = multi(params, MUNICIPALITY_ID, v -> positiveInt(v, MUNICIPALITY_ID));

        Integer yearFrom = single(params, YEAR_FROM, v -> intInRange(v, YEAR_FROM, MIN_YEAR, MAX_YEAR));
        Integer yearTo = single(params, YEAR_TO, v -> intInRange(v, YEAR_TO, MIN_YEAR, MAX_YEAR));
        if (yearFrom != null && yearTo != null && yearFrom > yearTo) {
            throw new ValidationException(YEAR_FROM, "yearFrom больше yearTo");
        }

        Boolean isKey = single(params, IS_KEY, v -> bool(v, IS_KEY));
        BigDecimal amountMin = single(params, AMOUNT_MIN, v -> nonNegative(v, AMOUNT_MIN));
        String q = single(params, Q, v -> query(v, Q));

        return new ProjectFilter(stages, industries, needs, municipalityIds, yearFrom, yearTo,
                Boolean.TRUE.equals(isKey), amountMin, q);
    }
}
