package ru.rt.radar.radar.map;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/** Кластеры по сетке cellDeg. Центр кластера — среднее координат его компаний. Порядок полей = contracts/examples/cells.json. */
public record CellsResponse(
        @Schema(allowableValues = "cells") String mode,
        double cellDeg,
        long total,
        List<Cell> cells
) implements MapResponse {

    public CellsResponse(double cellDeg, long total, List<Cell> cells) {
        this("cells", cellDeg, total, cells);
    }

    /** total = ours + others + excluded. */
    public record Cell(double lat, double lon, long total, long ours, long others, long excluded) {
    }
}
