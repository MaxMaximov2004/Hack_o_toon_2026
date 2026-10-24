package ru.rt.radar.notifier.project;

import java.time.OffsetDateTime;
import java.util.List;

/** Нужные notifier поля Project из GET /internal/projects (docs/tz/08-product2-contract.md); остальные игнорируем. */
public record ProjectEvent(int id, String title, Integer municipalityId, String municipalityName, String industry,
                           String stage, List<String> needs, OffsetDateTime updatedAt) {
}
