import { describe, expect, it } from 'vitest'
import { cellsToHeatGeoJson, heatGridZoom } from './heatmap'

describe('heatGridZoom', () => {
  it('на 3 уровня мельче видимой сетки, в пределах 9..12', () => {
    expect(heatGridZoom(5)).toBe(9)
    expect(heatGridZoom(7)).toBe(10)
    expect(heatGridZoom(8.4)).toBe(11)
    expect(heatGridZoom(14)).toBe(12)
  })
})

describe('cellsToHeatGeoJson', () => {
  it('вес — квадрат логарифма, максимум = 1, пустые ячейки отброшены, координаты [lon, lat]', () => {
    const fc = cellsToHeatGeoJson({
      mode: 'cells',
      cellDeg: 0.08,
      total: 10100,
      cells: [
        { lat: 47.2, lon: 39.7, total: 10000, ours: 0, others: 10000, excluded: 0 },
        { lat: 48.9, lon: 40.4, total: 100, ours: 0, others: 100, excluded: 0 },
        { lat: 46.5, lon: 41.5, total: 0, ours: 0, others: 0, excluded: 0 },
      ],
    })
    expect(fc.features).toHaveLength(2)
    expect(fc.features[0].properties.w).toBe(1)
    expect(fc.features[0].geometry.coordinates).toEqual([39.7, 47.2])
    // 100 компаний при максимуме 10 000 — видно (≈0.25), а не 0.01, как при линейном весе
    expect(fc.features[1].properties.w).toBeGreaterThan(0.2)
    expect(fc.features[1].properties.w).toBeLessThan(0.3)
  })

  it('охват: нет наших — 0 (оранжевый), доля от 1% — 1 (фиолетовый), малые места сглажены', () => {
    const c = (total: number, ours: number) =>
      cellsToHeatGeoJson({ mode: 'cells', cellDeg: 0.08, total, cells: [{ lat: 47, lon: 39, total, ours, others: total - ours, excluded: 0 }] })
        .features[0].properties.c
    expect(c(5000, 0)).toBe(0)
    expect(c(5000, 100)).toBe(1)
    expect(c(5000, 20)).toBeCloseTo(0.38, 2) // 0,4% — средний охват по области
    expect(c(3, 1)).toBeLessThan(0.6) // 1 из 3 — не «33% охвата»
  })

  it('режим точек — каждая компания с весом 1; нет данных — пустая коллекция', () => {
    const fc = cellsToHeatGeoJson({
      mode: 'points',
      total: 2,
      points: [
        { id: 1, lat: 47, lon: 39, kind: 'ours' },
        { id: 2, lat: 47.1, lon: 39.1, kind: 'others' },
      ],
    })
    expect(fc.features.map((f) => f.properties.w)).toEqual([1, 1])
    expect(fc.features[0].properties.c).toBeGreaterThan(fc.features[1].properties.c)
    expect(cellsToHeatGeoJson(undefined).features).toEqual([])
  })
})
