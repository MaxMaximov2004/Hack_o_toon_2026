package ru.rt.radar.radar.stats;

/** Белое пятно: высокий потенциал, низкий охват (GET /api/white-spots). Порядок полей = contracts/examples/white-spots.json. */
public record WhiteSpot(
        int municipalityId,
        String name,
        double lat,
        double lon,
        double potentialScore,
        int companies,
        int clients,
        String reason
) {
}
