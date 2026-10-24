package ru.rt.radar.locations;

import java.time.Instant;
import java.util.List;

/**
 * Где работает компания (docs/tz/07-star-actual-location.md). Порядок полей = contracts/examples/locations.json.
 * registered — из company (реестр МСП); actual — фактические места из company_location, свежие первыми;
 * relocated — то же выражение, что фильтр relocated=true (CompanyFilterSql.RELOCATED).
 */
public record CompanyLocations(Registered registered, List<Actual> actual, boolean relocated) {

    public record Registered(String municipalityName, String settlement, double lat, double lon) {
    }

    /** regionName — если место за пределами области; lat/lon — центр муниципалитета или null. */
    public record Actual(long id, String municipalityName, String regionName, String address, Double lat, Double lon,
                         String source, double confidence, String note, Instant createdAt) {
    }
}
