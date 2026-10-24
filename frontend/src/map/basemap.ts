import type { Map as MaplibreMap, MapSourceDataEvent } from 'maplibre-gl'
import type { StyleSpecification, RasterSourceSpecification } from 'maplibre-gl'

/**
 * Подложка карт радара и Навигатора: светлая CARTO Positron → OSM → без подложки (только фон).
 * На площадке тайлы могут резать или интернета не будет вовсе — карта с кластерами должна работать всё равно,
 * без потока красных ошибок в консоли.
 */
const BASEMAPS: RasterSourceSpecification[] = [
  {
    type: 'raster',
    tiles: ['a', 'b', 'c', 'd'].map((s) => `https://${s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`),
    tileSize: 256,
    maxzoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    type: 'raster',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
]

const SOURCE_ID = 'basemap'
const LAYER_ID = 'basemap'
/** Столько ошибок тайлов подряд до первого удачного — и переключаемся на следующую подложку */
const FAILURES_TO_SWITCH = 3
/** Фон без подложки — светло-серый, как просит гайдлайн */
const BACKGROUND = '#F3F5F7'

/** Стартовый стиль — только фон: подложку добавит attachBasemapFallback, когда проба тайла пройдёт */
export function createBaseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': BACKGROUND } }],
  }
}

/** Тайл с Ростовской областью (z=7) — для пробы доступности подложки */
const PROBE_TILE = { z: 7, x: 78, y: 45 }
const PROBE_TIMEOUT_MS = 4000

function probeTile(source: RasterSourceSpecification): Promise<boolean> {
  const url = (source.tiles ?? [])[0]
    .replace('{z}', String(PROBE_TILE.z))
    .replace('{x}', String(PROBE_TILE.x))
    .replace('{y}', String(PROBE_TILE.y))
  return new Promise((resolve) => {
    const img = new Image()
    const timer = setTimeout(() => resolve(false), PROBE_TIMEOUT_MS)
    img.onload = () => {
      clearTimeout(timer)
      resolve(true)
    }
    img.onerror = () => {
      clearTimeout(timer)
      resolve(false)
    }
    img.src = url
  })
}

let probe: Promise<number> | null = null

/** Первая доступная подложка (индекс в BASEMAPS) или BASEMAPS.length — без подложки. Одна проба на вкладку */
function firstAvailableBasemap(): Promise<number> {
  probe ??= (async () => {
    for (let i = 0; i < BASEMAPS.length; i++) {
      if (await probeTile(BASEMAPS[i])) return i
    }
    return BASEMAPS.length
  })()
  return probe
}

/**
 * Следит за ошибками тайлов подложки и переключает CARTO → OSM → без подложки. Ошибки самой подложки
 * не пишет в консоль (их видно по фолбэку); остальные ошибки карты — пишет, как MapLibre по умолчанию.
 * Возвращает отписку.
 */
export function attachBasemapFallback(map: MaplibreMap): () => void {
  let index = 0
  let failures = 0
  let hasTiles = false
  let detached = false

  const isCurrentBasemapUrl = (url: string) => {
    const host = (pattern: string) => new URL(pattern.replace(/\{[xyz]\}/g, '0')).host
    return (BASEMAPS[index].tiles ?? []).some((t) => host(t) === new URL(url).host)
  }

  const show = (next: number) => {
    index = next
    failures = 0
    try {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      if (index >= BASEMAPS.length) return // офлайн: только фон и наши слои
      map.addSource(SOURCE_ID, BASEMAPS[index])
      // Подложка — сразу над фоном, под всеми слоями данных
      const firstDataLayer = map.getStyle().layers.find((l) => l.id !== 'background')?.id
      map.addLayer({ id: LAYER_ID, type: 'raster', source: SOURCE_ID }, firstDataLayer)
    } catch {
      // карта уже уничтожена
    }
  }

  const switchToNext = () => show(index + 1)

  firstAvailableBasemap().then((available) => {
    if (detached) return
    const apply = () => !detached && show(available)
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  })

  const onError = (e: { error: Error; sourceId?: string }) => {
    if (e.sourceId !== SOURCE_ID) {
      console.error(e.error)
      return
    }
    // Подложка уже грузилась — единичные сбои тайлов не повод её менять
    if (hasTiles || index >= BASEMAPS.length) return
    // Опоздавшие ошибки тайлов предыдущей подложки новой не засчитываем (AJAXError несёт url)
    const url = (e.error as { url?: string } | undefined)?.url
    if (url && !isCurrentBasemapUrl(url)) return
    failures += 1
    if (failures >= FAILURES_TO_SWITCH) switchToNext()
  }

  const onData = (e: MapSourceDataEvent) => {
    if (e.sourceId === SOURCE_ID && e.tile && e.sourceDataType !== 'metadata') hasTiles = true
  }

  map.on('error', onError)
  map.on('sourcedata', onData)
  return () => {
    detached = true
    map.off('error', onError)
    map.off('sourcedata', onData)
  }
}

/** Для тестов и диагностики: какая подложка сейчас */
export function basemapName(map: MaplibreMap): 'carto' | 'osm' | 'none' {
  const source = map.getSource(SOURCE_ID) as { tiles?: string[] } | undefined
  if (!source?.tiles) return 'none'
  return source.tiles[0].includes('cartocdn') ? 'carto' : 'osm'
}
