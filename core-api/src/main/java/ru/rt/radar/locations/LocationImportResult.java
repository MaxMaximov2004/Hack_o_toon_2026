package ru.rt.radar.locations;

import java.util.List;

/**
 * Ответ POST /api/locations/import (docs/tz/07): rows — строк данных; matched — строк, чей ИНН есть в реестре
 * (точные повторы уже сохранённых мест не дублируются); notFound — до 100 ИНН, которых нет в реестре;
 * invalid — до 100 строк, которые не разобрать («строка 3: неизвестный район "…"») — дополнение к контракту 07.
 */
public record LocationImportResult(int rows, int matched, List<String> notFound, List<String> invalid) {
}
