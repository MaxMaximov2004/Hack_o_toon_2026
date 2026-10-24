package ru.rt.radar.radar.dictionary;

/** Район или город с центроидом. kind: district | city. */
public record Municipality(int id, String name, String kind, double lat, double lon) {
}
