package ru.rt.radar.radar.stats;

/**
 * Агрегаты и потенциал района (GET /api/municipalities/stats). Порядок полей = contracts/examples/stats.json.
 * Всё, кроме coverage, — как посчитала SQL-функция core.refresh_municipality_stats.
 */
public record MunicipalityStats(
        int municipalityId,
        String name,
        String kind,
        double lat,
        double lon,
        String industry,
        int companies,
        int clients,
        int excludedClients,
        double coverage,
        double newShare,
        Long revenueEstSum,
        double potentialScore,
        boolean isWhiteSpot,
        String reason
) {
}
