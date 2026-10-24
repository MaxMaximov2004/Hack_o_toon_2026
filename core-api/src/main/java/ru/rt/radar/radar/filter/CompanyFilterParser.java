package ru.rt.radar.radar.filter;

import ru.rt.radar.common.exception.ValidationException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static ru.rt.radar.radar.filter.QueryParams.*;

/**
 * Разбор и проверка CompanyFilter из query-параметров. Любая ошибка — {@link ValidationException}
 * с именем параметра (→ 400 VALIDATION_ERROR, details.field). Параметры, не относящиеся к фильтру
 * (zoom, page, sort…), игнорируются.
 */
public final class CompanyFilterParser {

    public static final String CLIENT = "client";
    public static final String STATUS = "status";
    public static final String INDUSTRY = "industry";
    public static final String REVENUE_MIN = "revenueMin";
    public static final String REVENUE_MAX = "revenueMax";
    public static final String MIN_LAT = "minLat";
    public static final String MAX_LAT = "maxLat";
    public static final String MIN_LON = "minLon";
    public static final String MAX_LON = "maxLon";
    public static final String MUNICIPALITY_ID = "municipalityId";
    public static final String SIZE_CATEGORY = "sizeCategory";
    public static final String GROWTH_MIN = "growthMin";
    public static final String IS_NEW = "isNew";
    public static final String Q = "q";
    public static final String RELOCATED = "relocated";

    static final int Q_MIN = QueryParams.Q_MIN;
    static final int Q_MAX = QueryParams.Q_MAX;

    private CompanyFilterParser() {
    }

    /** @param params query-параметры как в {@code ServletRequest#getParameterMap()} */
    public static CompanyFilter parse(Map<String, String[]> params) {
        ClientMode client = single(params, CLIENT, v -> CodedEnum.fromCode(ClientMode.class, v, CLIENT));
        StatusMode status = single(params, STATUS, v -> CodedEnum.fromCode(StatusMode.class, v, STATUS));
        List<Industry> industries = multi(params, INDUSTRY, v -> CodedEnum.fromCode(Industry.class, v, INDUSTRY));
        List<SizeCategory> sizes = multi(params, SIZE_CATEGORY,
                v -> CodedEnum.fromCode(SizeCategory.class, v, SIZE_CATEGORY));
        List<Integer> municipalityIds = multi(params, MUNICIPALITY_ID, v -> positiveInt(v, MUNICIPALITY_ID));

        BigDecimal revenueMin = single(params, REVENUE_MIN, v -> nonNegative(v, REVENUE_MIN));
        BigDecimal revenueMax = single(params, REVENUE_MAX, v -> nonNegative(v, REVENUE_MAX));
        if (revenueMin != null && revenueMax != null && revenueMin.compareTo(revenueMax) > 0) {
            throw new ValidationException(REVENUE_MIN, "revenueMin больше revenueMax");
        }
        BigDecimal growthMin = single(params, GROWTH_MIN, v -> decimal(v, GROWTH_MIN));

        Double minLat = single(params, MIN_LAT, v -> coordinate(v, MIN_LAT, 90));
        Double maxLat = single(params, MAX_LAT, v -> coordinate(v, MAX_LAT, 90));
        Double minLon = single(params, MIN_LON, v -> coordinate(v, MIN_LON, 180));
        Double maxLon = single(params, MAX_LON, v -> coordinate(v, MAX_LON, 180));
        checkBounds(minLat, maxLat, minLon, maxLon);

        Boolean isNew = single(params, IS_NEW, v -> bool(v, IS_NEW));
        String q = single(params, Q, v -> query(v, Q));
        Boolean relocated = single(params, RELOCATED, v -> bool(v, RELOCATED));

        return new CompanyFilter(
                client == null ? ClientMode.ALL : client,
                status == null ? StatusMode.ACTIVE : status,
                industries, revenueMin, revenueMax, minLat, maxLat, minLon, maxLon,
                municipalityIds, sizes, growthMin, Boolean.TRUE.equals(isNew), q, Boolean.TRUE.equals(relocated));
    }

    private static void checkBounds(Double minLat, Double maxLat, Double minLon, Double maxLon) {
        int given = (minLat != null ? 1 : 0) + (maxLat != null ? 1 : 0) + (minLon != null ? 1 : 0) + (maxLon != null ? 1 : 0);
        if (given == 0) {
            return;
        }
        if (given != 4) {
            String missing = minLat == null ? MIN_LAT : maxLat == null ? MAX_LAT : minLon == null ? MIN_LON : MAX_LON;
            throw new ValidationException(missing,
                    "Границы окна карты задаются все четыре (minLat, maxLat, minLon, maxLon) или ни одной");
        }
        if (minLat >= maxLat) {
            throw new ValidationException(MIN_LAT, "minLat должен быть меньше maxLat");
        }
        if (minLon >= maxLon) {
            throw new ValidationException(MIN_LON, "minLon должен быть меньше maxLon");
        }
    }

    // ---- разбор значений (общие — в QueryParams) ----

    private static Double coordinate(String v, String field, double limit) {
        double d;
        try {
            d = Double.parseDouble(v);
        } catch (NumberFormatException e) {
            throw new ValidationException(field, "Параметр " + field + " должен быть числом, получено '" + v + "'");
        }
        if (!Double.isFinite(d) || d < -limit || d > limit) {
            throw new ValidationException(field, "Параметр " + field + " должен быть в диапазоне от -" + (int) limit + " до " + (int) limit);
        }
        return d;
    }
}
