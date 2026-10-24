package ru.rt.radar.radar.web;

import java.util.List;

/** Страница по контракту: { items, page, size, total }. */
public record PageResponse<T>(List<T> items, int page, int size, long total) {
}
