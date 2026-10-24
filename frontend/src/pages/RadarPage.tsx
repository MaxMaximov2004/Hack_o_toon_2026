import { useAuth } from '../auth/AuthProvider'
import { useFilter } from '../filters/useFilter'
import { ClientToggle } from '../filters/ClientToggle'
import { FilterPanel } from '../filters/FilterPanel'
import { RadarMap } from '../map/RadarMap'
import { MapLegend } from '../map/MapLegend'
import { MapLayerToggles, type MapLayer } from '../map/MapLayerToggles'
import { DistrictPanel } from '../map/DistrictPanel'
import { WhiteSpotsList } from '../map/WhiteSpotsList'
import { MapErrorBoundary } from '../map/MapErrorBoundary'
import { CompanyList } from '../list/CompanyList'
import { CompanyCard } from '../company/CompanyCard'
import { Tabs } from '../ui/Tabs'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { useCallback, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMunicipalityStats, getWhiteSpots } from '../api/endpoints'
import type { Map } from 'maplibre-gl'
import type { MunicipalityStats } from '../api/types'
import styles from './RadarPage.module.css'

export function RadarPage() {
  const { user, logout } = useAuth()
  const { filters, updateFilters, resetFilters } = useFilter()
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>()
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [activeLayer, setActiveLayer] = useState<MapLayer>('none')
  const [selectedDistrict, setSelectedDistrict] = useState<MunicipalityStats | null>(null)
  const mapRef = useRef<Map | null>(null)

  // Ref для updateFilters чтобы moveend всегда вызывал актуальную версию
  const updateFiltersRef = useRef(updateFilters)
  updateFiltersRef.current = updateFilters

  const handleBoundsChange = useCallback((bounds: {
    minLat: number
    maxLat: number
    minLon: number
    maxLon: number
  }) => {
    updateFiltersRef.current(bounds)
  }, [])

  const handleSelectCompany = useCallback((id: number) => {
    setSelectedCompanyId(id)
  }, [])

  const handleCloseCard = useCallback(() => {
    setSelectedCompanyId(undefined)
  }, [])

  const handleMapReady = useCallback((map: Map) => {
    mapRef.current = map
  }, [])

  // Определяем industry для аналитики
  const industryParam = filters.industry && filters.industry.length > 0
    ? filters.industry.length === 1
      ? filters.industry[0]
      : 'all'
    : 'all'

  // Запрос статистики районов для слоя "Потенциал"
  const { data: municipalityStats } = useQuery({
    queryKey: ['municipality-stats', industryParam],
    queryFn: () => getMunicipalityStats(industryParam),
    enabled: activeLayer === 'potential',
    staleTime: 60000,
  })

  // Запрос белых пятен
  const { data: whiteSpots } = useQuery({
    queryKey: ['white-spots', industryParam],
    queryFn: () => getWhiteSpots(industryParam, 10),
    enabled: activeLayer === 'whiteSpots',
    staleTime: 60000,
  })

  const handleLayerChange = useCallback((layer: MapLayer) => {
    setActiveLayer(layer)
    setSelectedDistrict(null)
  }, [])

  const handleDistrictClick = useCallback((stats: MunicipalityStats) => {
    setSelectedDistrict(stats)
  }, [])

  const handleShowDistrictCompanies = useCallback((municipalityId: number) => {
    // Найти район в справочнике
    const municipality = municipalityStats?.find((s) => s.municipalityId === municipalityId)
    if (municipality && mapRef.current) {
      // Перелететь к району
      mapRef.current.flyTo({
        center: [municipality.lon, municipality.lat],
        zoom: 11,
      })
      // Установить фильтр по району
      updateFilters({ municipalityId: [municipalityId] })
      setSelectedDistrict(null)
    }
  }, [municipalityStats, updateFilters])

  const handleWhiteSpotClick = useCallback((lat: number, lon: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [lon, lat],
        zoom: 11,
      })
    }
  }, [])

  return (
    <ErrorBoundary>
      <div className={styles.container}>
        <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logoSection}>
            <div className={styles.logo}>Ростелеком</div>
            <h1 className={styles.title}>Радар присутствия</h1>
          </div>
          <div className={styles.filterSection}>
            <ClientToggle
              value={filters.client}
              onChange={(client) => updateFilters({ client })}
            />
          </div>
          <div className={styles.userSection}>
            <span className={styles.userName}>{user?.fullName}</span>
            <button onClick={logout} className={styles.logoutButton}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <div className={styles.mobileTabs}>
        <Tabs
          tabs={[
            { id: 'map', label: 'Карта' },
            { id: 'list', label: 'Список' },
          ]}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as 'map' | 'list')}
        />
      </div>

      <main className={styles.main}>
        {/* Фильтры — десктоп слева, мобайл — нижняя панель */}
        <div className={styles.filterContainer}>
          <FilterPanel
            filters={filters}
            onFiltersChange={updateFilters}
            onReset={resetFilters}
            mapRef={mapRef}
          />
        </div>

        {/* Кнопка фильтров на мобайле */}
        <button
          className={styles.mobileFilterButton}
          onClick={() => setMobileFiltersOpen(true)}
        >
          Фильтры
        </button>

        <div className={`${styles.mapContainer} ${activeTab === 'map' ? styles.active : ''}`}>
          <div className={styles.mapControls}>
            <MapLayerToggles activeLayer={activeLayer} onChange={handleLayerChange} />
          </div>
          <MapErrorBoundary>
            <RadarMap
              filters={filters}
              selectedCompanyId={selectedCompanyId}
              onBoundsChange={handleBoundsChange}
              onSelectCompany={handleSelectCompany}
              onMapReady={handleMapReady}
              potentialStats={activeLayer === 'potential' ? municipalityStats : undefined}
              whiteSpots={activeLayer === 'whiteSpots' ? whiteSpots : undefined}
              onDistrictClick={handleDistrictClick}
            />
          </MapErrorBoundary>
          {/* Легенда - скрывается когда показаны белые пятна */}
          {activeLayer !== 'whiteSpots' && <MapLegend />}

          {/* Панель района при клике на кружок потенциала */}
          {selectedDistrict && (
            <DistrictPanel
              stats={selectedDistrict}
              onShowCompanies={handleShowDistrictCompanies}
              onClose={() => setSelectedDistrict(null)}
            />
          )}

          {/* Список белых пятен - заменяет легенду */}
          {activeLayer === 'whiteSpots' && whiteSpots && (
            <WhiteSpotsList spots={whiteSpots} onSelectSpot={handleWhiteSpotClick} />
          )}
        </div>

        <div className={`${styles.listContainer} ${activeTab === 'list' ? styles.active : ''}`}>
          <CompanyList
            filters={filters}
            selectedId={selectedCompanyId}
            onSelectCompany={handleSelectCompany}
            onFiltersChange={updateFilters}
            onResetFilters={resetFilters}
          />
        </div>
      </main>

      {/* Мобильная панель фильтров */}
      {mobileFiltersOpen && (
        <div className={styles.mobileFilterOverlay} onClick={() => setMobileFiltersOpen(false)}>
          <div className={styles.mobileFilterPanel} onClick={(e) => e.stopPropagation()}>
            <FilterPanel
              filters={filters}
              onFiltersChange={updateFilters}
              onReset={resetFilters}
              mapRef={mapRef}
            />
            <button
              className={styles.mobileFilterClose}
              onClick={() => setMobileFiltersOpen(false)}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {selectedCompanyId && (
        <CompanyCard companyId={selectedCompanyId} onClose={handleCloseCard} />
      )}
    </div>
    </ErrorBoundary>
  )
}
