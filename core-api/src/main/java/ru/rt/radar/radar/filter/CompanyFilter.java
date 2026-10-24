package ru.rt.radar.radar.filter;

import java.math.BigDecimal;
import java.util.List;

/**
 * Общий фильтр компаний (00-common, CompanyFilter). Один и тот же для /api/companies, /api/map/cells
 * и /internal/companies. Создаётся только через {@link CompanyFilterParser} — значения уже проверены.
 * Незаданное условие: null или пустой список; isNew = false — условие не задано.
 */
public record CompanyFilter(
        ClientMode client,
        StatusMode status,
        List<Industry> industries,
        BigDecimal revenueMin,
        BigDecimal revenueMax,
        Double minLat,
        Double maxLat,
        Double minLon,
        Double maxLon,
        List<Integer> municipalityIds,
        List<SizeCategory> sizeCategories,
        BigDecimal growthMin,
        boolean isNew,
        String q
) {

    public CompanyFilter {
        industries = List.copyOf(industries);
        municipalityIds = List.copyOf(municipalityIds);
        sizeCategories = List.copyOf(sizeCategories);
    }

    /** Фильтр по умолчанию: client=all, status=active, без остальных условий. */
    public static CompanyFilter defaults() {
        return new CompanyFilter(ClientMode.ALL, StatusMode.ACTIVE, List.of(), null, null,
                null, null, null, null, List.of(), List.of(), null, false, null);
    }

    /** Заданы ли границы окна карты (парсер гарантирует: все четыре или ни одной). */
    public boolean hasBounds() {
        return minLat != null;
    }
}
