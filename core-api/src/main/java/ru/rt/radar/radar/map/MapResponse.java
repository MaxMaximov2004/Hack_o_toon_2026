package ru.rt.radar.radar.map;

/** Ответ карты: сервер сам решает — точки (mode=points) или кластеры по сетке (mode=cells). */
public sealed interface MapResponse permits PointsResponse, CellsResponse {

    String mode();

    long total();
}
