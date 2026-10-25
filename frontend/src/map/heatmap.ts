import type { HeatmapLayerSpecification } from 'maplibre-gl'
import type { MapDataResponse } from '../api/types'

// Тепловая карта плотности бизнеса (кейс: «интерактивная тепловая карта с возможностью приближения»).
// Источник — те же /api/map/cells с фильтрами, но по всей области и на сетке мельче текущего масштаба,
// чтобы пятна были плавными, а не квадратами ячеек.

/** До этого масштаба видно тепло; дальше — кружки кластеров и точки компаний */
export const HEAT_MAX_ZOOM = 11

/** Сетка для тепла: на 3 уровня мельче видимой, но не мельче 12 (~2 км) — запрос остаётся ~0,1 с */
export function heatGridZoom(zoom: number): number {
  return Math.min(12, Math.max(9, Math.round(zoom) + 3))
}

/**
 * Ячейки -> точки GeoJSON с весом 0..1. Вес — квадрат логарифма: линейный вес даёт один Ростов (десятки тысяч
 * компаний) и невидимые сёла, чистый логарифм — ровную заливку всей области; квадрат оставляет и то, и другое.
 */
export function cellsToHeatGeoJson(data: MapDataResponse | undefined) {
  const cells =
    data?.mode === 'cells'
      ? data.cells.map((c) => ({ lat: c.lat, lon: c.lon, total: c.total }))
      : (data?.points ?? []).map((p) => ({ lat: p.lat, lon: p.lon, total: 1 }))
  const max = Math.max(1, ...cells.map((c) => c.total))
  return {
    type: 'FeatureCollection' as const,
    features: cells
      .filter((c) => c.total > 0)
      .map((c) => ({
        type: 'Feature' as const,
        properties: { w: (Math.log1p(c.total) / Math.log1p(max)) ** 2 },
        geometry: { type: 'Point' as const, coordinates: [c.lon, c.lat] }, // MapLibre — [lon, lat]
      })),
  }
}

// Фирменная палитра: лаванда -> фиолетовый -> оранжевый (мало -> много); та же шкала в легенде (MapLegend.module.css)
export const heatmapPaint: HeatmapLayerSpecification['paint'] = {
  'heatmap-weight': ['get', 'w'],
  // Почти постоянная: сетка при приближении и так мельче, рост интенсивности сливал Ростов в одно пятно
  'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 6, 1, 9, 1.1, 12, 1.2],
  'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 6, 20, 7, 26, 9, 30, 12, 38],
  'heatmap-color': [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0, 'rgba(232, 210, 237, 0)',
    0.1, 'rgba(232, 210, 237, 0.5)',
    0.3, 'rgba(119, 0, 255, 0.55)',
    0.6, 'rgba(119, 0, 255, 0.8)',
    // Оранжевый — только самые плотные места: по гайдлайну он акцент, не больше 30% от фиолетового
    0.85, 'rgba(255, 79, 18, 0.85)',
    1, 'rgba(255, 79, 18, 0.95)',
  ],
  // Кластеры появляются, когда Math.round(zoom) доходит до HEAT_MAX_ZOOM (с HEAT_MAX_ZOOM − 0.5) — тепло гаснет
  // начиная оттуда же, иначе между бледным теплом и кластерами пустая карта
  'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], HEAT_MAX_ZOOM - 0.5, 0.9, HEAT_MAX_ZOOM + 0.5, 0.2],
}
