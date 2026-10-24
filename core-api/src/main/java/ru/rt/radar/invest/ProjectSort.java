package ru.rt.radar.invest;

import ru.rt.radar.common.exception.ValidationException;

import java.util.List;

/**
 * Сортировка списка проектов: "поле[,asc|desc]" (docs/tz/08-product2-contract.md). Колонка — только из белого списка,
 * строка из запроса в SQL не попадает. Пустые значения — в конце, вторым ключом id.
 */
public record ProjectSort(String field, boolean desc) {

    public static final String PARAM = "sort";
    public static final String DEFAULT = "amountMln,desc";
    public static final List<String> FIELDS = List.of("amountMln", "jobs", "startYear", "launchYear", "title");

    public static ProjectSort parse(String raw) {
        if (raw == null || raw.isBlank()) {
            raw = DEFAULT;
        }
        String[] parts = raw.trim().split(",", -1);
        if (parts.length > 2 || !FIELDS.contains(parts[0].trim())) {
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
        return new ProjectSort(parts[0].trim(), desc);
    }

    /** Готовый ORDER BY для invest_project под алиасом p. */
    public String orderBy() {
        String column = switch (field) {
            case "amountMln" -> "p.amount_mln";
            case "jobs" -> "p.jobs";
            case "startYear" -> "p.start_year";
            case "launchYear" -> "p.launch_year";
            case "title" -> "p.title";
            default -> throw new IllegalStateException("Поле сортировки вне белого списка: " + field);
        };
        return "ORDER BY " + column + (desc ? " DESC" : " ASC") + " NULLS LAST, p.id ASC";
    }

    private static ValidationException invalid(String raw) {
        return new ValidationException(PARAM, "Неверная сортировка '" + raw + "': допустимо поле из "
                + String.join(", ", FIELDS) + " и направление asc или desc, например amountMln,desc");
    }
}
