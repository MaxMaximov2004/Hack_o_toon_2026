package ru.rt.radar.invest;

import ru.rt.radar.radar.filter.Industry;
import ru.rt.radar.radar.filter.Need;
import ru.rt.radar.radar.filter.Stage;

import java.math.BigDecimal;
import java.util.List;

/**
 * Общий фильтр проектов (docs/tz/08-product2-contract.md, ProjectFilter). Один для /api/projects, /api/projects/timeline
 * и /internal/projects. Создаётся только через {@link ProjectFilterParser} — значения уже проверены.
 * Незаданное условие: null или пустой список; isKey = false — условие не задано.
 */
public record ProjectFilter(
        List<Stage> stages,
        List<Industry> industries,
        List<Need> needs,
        List<Integer> municipalityIds,
        Integer yearFrom,
        Integer yearTo,
        boolean isKey,
        BigDecimal amountMin,
        String q
) {

    public ProjectFilter {
        stages = List.copyOf(stages);
        industries = List.copyOf(industries);
        needs = List.copyOf(needs);
        municipalityIds = List.copyOf(municipalityIds);
    }

    public static ProjectFilter defaults() {
        return new ProjectFilter(List.of(), List.of(), List.of(), List.of(), null, null, false, null, null);
    }
}
