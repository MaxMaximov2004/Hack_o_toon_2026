package ru.rt.radar.radar.map;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/** Компаний в окне не больше порога — каждая точкой. Порядок полей = contracts/examples/points.json. */
public record PointsResponse(
        @Schema(allowableValues = "points") String mode,
        long total,
        List<Point> points
) implements MapResponse {

    public PointsResponse(long total, List<Point> points) {
        this("points", total, points);
    }

    /** kind: ours | others | excluded. */
    public record Point(int id, double lat, double lon, String kind) {
    }
}
