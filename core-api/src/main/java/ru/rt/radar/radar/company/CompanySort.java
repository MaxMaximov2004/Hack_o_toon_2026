package ru.rt.radar.radar.company;

import ru.rt.radar.radar.error.ValidationException;

import java.util.List;

/**
 * Сортировка списка компаний: "поле[,asc|desc]". Колонка выбирается только из белого списка —
 * строка из запроса в SQL не попадает. Всегда NULLS LAST и вторым ключом id (стабильная пагинация).
 */
public record CompanySort(String field, boolean desc) {

    public static final String PARAM = "sort";
    public static final String DEFAULT = "revenueEst,desc";
    public static final List<String> FIELDS = List.of("name", "revenueEst", "revenueGrowthEst", "employees", "registeredAt");

    public static CompanySort parse(String raw) {
        if (raw == null || raw.isBlank()) {
            raw = DEFAULT;
        }
        String[] parts = raw.trim().split(",", -1);
        if (parts.length > 2) {
            throw invalid(raw);
        }
        String field = parts[0].trim();
        if (!FIELDS.contains(field)) {
            throw invalid(raw);
        }
        boolean desc = false;
        if (parts.length == 2) {
            String dir = parts[1].trim();
            if (dir.equalsIgnoreCase("desc")) {
                desc = true;
            } else if (!dir.equalsIgnoreCase("asc")) {
                throw invalid(raw);
            }
        }
        return new CompanySort(field, desc);
    }

    /** Готовый ORDER BY для таблицы company под алиасом c. */
    public String orderBy() {
        String column = switch (field) {
            case "name" -> "c.name";
            case "revenueEst" -> "c.revenue_est";
            case "revenueGrowthEst" -> "c.revenue_growth_est";
            case "employees" -> "c.employees";
            case "registeredAt" -> "c.registered_at";
            default -> throw new IllegalStateException("Поле сортировки вне белого списка: " + field);
        };
        return "ORDER BY " + column + (desc ? " DESC" : " ASC") + " NULLS LAST, c.id ASC";
    }

    private static ValidationException invalid(String raw) {
        return new ValidationException(PARAM, "Неверная сортировка '" + raw + "': допустимо поле из "
                + String.join(", ", FIELDS) + " и направление asc или desc, например revenueEst,desc");
    }
}
