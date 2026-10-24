package ru.rt.radar.clients;

import java.util.List;

/**
 * Ответ POST /api/clients/import (docs/tz/03-java-2-techlead.md).
 * rows — строк данных в файле; matched — компаний помечено клиентами; notFound — до 100 ИНН, которых нет в реестре
 * или которые не похожи на ИНН; whiteSpots — белых пятен после пересчёта (industry = all).
 */
public record ClientImportResult(int rows, int matched, List<String> notFound, String mode, int whiteSpots) {
}
