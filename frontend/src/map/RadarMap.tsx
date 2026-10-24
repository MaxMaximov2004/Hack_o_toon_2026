import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../api/apiFetch'
import type { MapDataResponse } from '../api/types'
import { filterToQuery } from '../filters/filterToQuery'
import type { CompanyFilters } from '../filters/types'
import { createClusterMarker } from './clusterMarker'
import styles from './RadarMap.module.css'

interface RadarMapProps {
  filters: CompanyFilters
  selectedCompanyId?: number
  onBoundsChange: (bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }) => void
  onSelectCompany: (id: number) => void
  onMapReady?: (map: maplibregl.Map) => void
}

const ROSTOV_CENTER: [number, number] = [40.8, 47.6] // [lon, lat] для MapLibre
const INITIAL_ZOOM = 7

export function RadarMap({ filters, selectedCompanyId, onBoundsChange, onSelectCompany, onMapReady }: RadarMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [zoom, setZoom] = useState(INITIAL_ZOOM)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const boundsTimeoutRef = useRef<NodeJS.Timeout>()
  const lastBoundsRef = useRef<string>('') // Храним предыдущий bbox для сравнения

  // Запрос данных карты - используем ЦЕЛОЕ zoom
  const { data, isLoading } = useQuery({
    queryKey: ['map', filterToQuery(filters), Math.round(zoom)],
    queryFn: async () => {
      const query = filterToQuery(filters)
      const url = `/api/map/cells?${query}&zoom=${Math.round(zoom)}`
      return apiFetch<MapDataResponse>(url)
    },
    staleTime: 30000,
    placeholderData: (prev) => prev, // Показываем старые данные пока грузятся новые
  })

  // Инициализация карты - ОДИН РАЗ
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: ROSTOV_CENTER,
      zoom: INITIAL_ZOOM,
      // Явно включаем интерактивность
      scrollZoom: true,
      dragPan: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
    })

    map.current = mapInstance

    // Вызываем callback когда карта готова
    if (onMapReady) {
      onMapReady(mapInstance)
    }

    // ResizeObserver для реакции на изменение размера контейнера
    // (появление списка, вкладки на телефоне, открытие карточки)
    const resizeObserver = new ResizeObserver(() => {
      mapInstance.resize()
    })
    resizeObserver.observe(mapContainer.current)

    // Обновляем zoom при изменении
    mapInstance.on('zoom', () => {
      setZoom(mapInstance.getZoom())
    })

    // Обновляем bounds после moveend с дебаунсом (ТОЛЬКО запись в URL)
    // Только если bbox реально изменился
    mapInstance.on('moveend', () => {
      if (boundsTimeoutRef.current) {
        clearTimeout(boundsTimeoutRef.current)
      }
      boundsTimeoutRef.current = setTimeout(() => {
        const bounds = mapInstance.getBounds()
        const newBounds = {
          minLat: parseFloat(bounds.getSouth().toFixed(4)),
          maxLat: parseFloat(bounds.getNorth().toFixed(4)),
          minLon: parseFloat(bounds.getWest().toFixed(4)),
          maxLon: parseFloat(bounds.getEast().toFixed(4)),
        }

        // Сериализуем bbox для сравнения
        const boundsKey = `${newBounds.minLat},${newBounds.maxLat},${newBounds.minLon},${newBounds.maxLon}`

        // Обновляем URL только если bbox изменился
        if (lastBoundsRef.current !== boundsKey) {
          lastBoundsRef.current = boundsKey
          onBoundsChange(newBounds)
        }
      }, 400)
    })

    return () => {
      if (boundsTimeoutRef.current) {
        clearTimeout(boundsTimeoutRef.current)
      }
      resizeObserver.disconnect()
      mapInstance.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // ПУСТЫЕ зависимости - карта создаётся ОДИН РАЗ

  // Отрисовка маркеров
  useEffect(() => {
    if (!map.current || !data) return

    // Удаляем старые маркеры
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    if (data.mode === 'cells') {
      // Рисуем кластеры
      data.cells.forEach((cell) => {
        const element = createClusterMarker(cell, filters.client)

        // ВАЖНО: порядок [lon, lat] для MapLibre и anchor: 'center'
        const marker = new maplibregl.Marker({ element, anchor: 'center' })
          .setLngLat([cell.lon, cell.lat]) // [lon, lat]
          .addTo(map.current!)

        // Клик по кластеру - zoom +2 и центрирование
        element.addEventListener('click', () => {
          if (map.current) {
            map.current.flyTo({
              center: [cell.lon, cell.lat], // [lon, lat]
              zoom: map.current.getZoom() + 2,
              duration: 800,
            })
          }
        })

        markersRef.current.push(marker)
      })
    } else if (data.mode === 'points') {
      // Рисуем точки
      data.points.forEach((point) => {
        const isSelected = point.id === selectedCompanyId
        const color =
          point.kind === 'ours'
            ? 'var(--rt-purple)'
            : point.kind === 'others'
            ? 'var(--rt-orange)'
            : 'var(--rt-gray)'

        const el = document.createElement('div')
        el.className = `${styles.pointMarker} ${isSelected ? styles.selected : ''}`
        el.style.backgroundColor = color

        // Клик по точке - открыть карточку компании
        el.addEventListener('click', () => {
          onSelectCompany(point.id)
        })

        // ВАЖНО: порядок [lon, lat] для MapLibre и anchor: 'center'
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([point.lon, point.lat]) // [lon, lat]
          .addTo(map.current!)

        markersRef.current.push(marker)
      })
    }
  }, [data, filters.client, selectedCompanyId, onSelectCompany])

  return (
    <div className={styles.container}>
      <div ref={mapContainer} className={styles.map} />
      {isLoading && (
        <div className={styles.loader}>
          <div className={styles.spinner} />
        </div>
      )}
    </div>
  )
}
