package ru.rt.radar.radar.company;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Строка списка компаний (GET /api/companies). Порядок полей = порядок в JSON (contracts/examples/companies.json).
 * geoPrecision — точность lat/lon: settlement | municipality | approx (адресов в реестре нет, см. etl/etl/geo.py).
 * relocated — есть фактическое место в другом районе или регионе (задача со *, locations/).
 */
public record CompanyShort(
        int id,
        String inn,
        String name,
        String industry,
        String industryName,
        String okvedCode,
        String okvedName,
        int municipalityId,
        String municipalityName,
        String settlement,
        double lat,
        double lon,
        String geoPrecision,
        String sizeCategory,
        Integer employees,
        Long revenueEst,
        BigDecimal revenueGrowthEst,
        String revenueSource,
        boolean isEstimated,
        boolean isClient,
        String status,
        String kind,
        LocalDate excludedAt,
        boolean isNew,
        LocalDate registeredAt,
        boolean relocated
) {
}
