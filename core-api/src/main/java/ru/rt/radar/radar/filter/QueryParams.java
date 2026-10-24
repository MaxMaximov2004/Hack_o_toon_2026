package ru.rt.radar.radar.filter;

import ru.rt.radar.common.exception.ValidationException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Разбор query-параметров для фильтров (CompanyFilter, ProjectFilter) — одинаковые правила везде:
 * пустое значение = не задан, одиночный параметр нельзя повторять, множественный — повтором, дубли убираются.
 * Любая ошибка — {@link ValidationException} с именем параметра (→ 400 VALIDATION_ERROR, details.field).
 */
public final class QueryParams {

    public static final int Q_MIN = 2;
    public static final int Q_MAX = 200;

    private QueryParams() {
    }

    /** Одиночный параметр: пустое значение = не задан, повтор — ошибка. */
    public static <T> T single(Map<String, String[]> params, String name, Function<String, T> convert) {
        List<String> values = values(params, name);
        if (values.isEmpty()) {
            return null;
        }
        if (values.size() > 1) {
            throw new ValidationException(name, "Параметр " + name + " задан несколько раз");
        }
        return convert.apply(values.get(0));
    }

    /** Множественный параметр — повтором: ?industry=trade&industry=logistics. Дубли убираются. */
    public static <T> List<T> multi(Map<String, String[]> params, String name, Function<String, T> convert) {
        List<T> result = new ArrayList<>();
        for (String v : values(params, name)) {
            T item = convert.apply(v);
            if (!result.contains(item)) {
                result.add(item);
            }
        }
        return result;
    }

    private static List<String> values(Map<String, String[]> params, String name) {
        String[] raw = params.get(name);
        List<String> values = new ArrayList<>();
        if (raw != null) {
            for (String v : raw) {
                if (v != null && !v.isBlank()) {
                    values.add(v.trim());
                }
            }
        }
        return values;
    }

    public static BigDecimal decimal(String v, String field) {
        try {
            return new BigDecimal(v);
        } catch (NumberFormatException e) {
            throw new ValidationException(field, "Параметр " + field + " должен быть числом, получено '" + v + "'");
        }
    }

    public static BigDecimal nonNegative(String v, String field) {
        BigDecimal d = decimal(v, field);
        if (d.signum() < 0) {
            throw new ValidationException(field, "Параметр " + field + " не может быть отрицательным");
        }
        return d;
    }

    public static Integer positiveInt(String v, String field) {
        try {
            int i = Integer.parseInt(v);
            if (i > 0) {
                return i;
            }
        } catch (NumberFormatException ignored) {
            // ниже — общая ошибка
        }
        throw new ValidationException(field, "Параметр " + field + " должен быть положительным целым, получено '" + v + "'");
    }

    /** Целое в диапазоне [min, max], например год. */
    public static Integer intInRange(String v, String field, int min, int max) {
        try {
            int i = Integer.parseInt(v);
            if (i >= min && i <= max) {
                return i;
            }
        } catch (NumberFormatException ignored) {
            // ниже — общая ошибка
        }
        throw new ValidationException(field, "Параметр " + field + " должен быть целым от " + min + " до " + max
                + ", получено '" + v + "'");
    }

    /** true / false; что делать с false — решает вызывающий (у isNew, isKey это «условие не задано»). */
    public static Boolean bool(String v, String field) {
        return switch (v) {
            case "true" -> true;
            case "false" -> false;
            default -> throw new ValidationException(field, "Параметр " + field + " принимает true или false");
        };
    }

    /** Строка поиска: от {@value #Q_MIN} до {@value #Q_MAX} символов. */
    public static String query(String v, String field) {
        if (v.length() < Q_MIN) {
            throw new ValidationException(field, "Строка поиска " + field + " — не короче " + Q_MIN + " символов");
        }
        if (v.length() > Q_MAX) {
            throw new ValidationException(field, "Строка поиска " + field + " — не длиннее " + Q_MAX + " символов");
        }
        return v;
    }
}
