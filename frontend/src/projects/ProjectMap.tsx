import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getProjectClusters } from '../api/endpoints'
import type { ProjectMunicipalityCluster } from './groupByMunicipality'
import { projectFilterToQuery } from './projectFilterToQuery'
import { formatMoney } from '../utils/formatMoney'
import type { ProjectFilters } from './types'
import styles from './ProjectMap.module.css'

interface ProjectMapProps {
  filters: ProjectFilters
  selectedProjectId?: number
  onSelectMunicipality: (municipalityId: number) => void
}

export function ProjectMap({ filters, onSelectMunicipality }: ProjectMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)

  const queryString = projectFilterToQuery(filters)

  const { data: clusters } = useQuery({
    queryKey: ['project-clusters', queryString],
    queryFn: () => getProjectClusters(queryString),
    staleTime: 30000,
  })

  // Инициализация карты
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
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
            source: 'osm',
          },
        ],
      },
      center: [40.8, 47.6], // Ростовская область (lon, lat) - как в Радаре
      zoom: 7, // Показываем всю область
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Отрисовка маркеров
  useEffect(() => {
    if (!map.current || !clusters) return

    // Удаляем старые маркеры
    const existingMarkers = document.querySelectorAll('.project-cluster-marker')
    existingMarkers.forEach((marker) => marker.remove())

    // Добавляем новые маркеры
    clusters.forEach((cluster: ProjectMunicipalityCluster) => {
      // Определяем преобладающую стадию
      const maxCount = Math.max(cluster.design, cluster.construction, cluster.launch)
      let dominantStage = 'construction'
      if (cluster.design === maxCount) dominantStage = 'design'
      else if (cluster.launch === maxCount) dominantStage = 'launch'

      // Считаем средний объём инвестиций кластера
      const totalAmount = cluster.projects.reduce((sum, p) => sum + (p.amountMln ?? 0), 0)
      const avgAmount = cluster.total > 0 ? totalAmount / cluster.total : 0

      // Размер маркера по объёму инвестиций: 24-48px
      // Минимум 24px для маленьких проектов, 48px для крупных (>10 млрд)
      const size = Math.min(Math.max(24, 24 + (avgAmount / 10000) * 24), 48)

      // Проверяем, есть ли ключевые проекты в кластере
      const hasKeyProjects = cluster.projects.some((p) => p.isKey)

      // Создаём HTML-элемент маркера
      const el = document.createElement('div')
      const keyClass = hasKeyProjects ? styles.isKey : ''
      el.className = `project-cluster-marker ${styles.clusterMarker} ${styles[`stage${dominantStage.charAt(0).toUpperCase()}${dominantStage.slice(1)}`]} ${keyClass}`
      el.innerHTML = `<span class="${styles.clusterCount}">${cluster.total}</span>`
      el.style.width = `${size}px`
      el.style.height = `${size}px`

      el.addEventListener('click', () => {
        // Фильтруем по району
        onSelectMunicipality(cluster.municipalityId)
        // Приближаем карту
        map.current?.flyTo({
          center: [cluster.lon, cluster.lat],
          zoom: 11,
        })
      })

      // Добавляем маркер на карту
      new maplibregl.Marker({ element: el })
        .setLngLat([cluster.lon, cluster.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(
            `<div class="${styles.popup}">
              <div class="${styles.popupTitle}">${cluster.municipalityName}</div>
              <div class="${styles.popupStats}">
                Проектов: ${cluster.total}<br/>
                Объём: ${formatMoney(totalAmount)}<br/>
                Проектирование: ${cluster.design}<br/>
                Строительство: ${cluster.construction}<br/>
                Запуск: ${cluster.launch}${hasKeyProjects ? '<br/><strong style="color: var(--rt-orange);">Ключевые проекты</strong>' : ''}
              </div>
            </div>`
          )
        )
        .addTo(map.current!)
    })
  }, [clusters, onSelectMunicipality])

  return (
    <div className={styles.container}>
      <div ref={mapContainer} className={styles.map} />
      <ProjectMapLegend />
    </div>
  )
}

function ProjectMapLegend() {
  return (
    <div className={styles.legend}>
      <div className={styles.legendTitle}>Стадии проектов</div>
      <div className={styles.legendItem}>
        <span className={`${styles.legendDot} ${styles.stageDesign}`}></span>
        Проектирование
      </div>
      <div className={styles.legendItem}>
        <span className={`${styles.legendDot} ${styles.stageConstruction}`}></span>
        Строительство
      </div>
      <div className={styles.legendItem}>
        <span className={`${styles.legendDot} ${styles.stageLaunch}`}></span>
        Запуск
      </div>
    </div>
  )
}
