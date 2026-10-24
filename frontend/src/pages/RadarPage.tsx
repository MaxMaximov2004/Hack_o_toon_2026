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
import { ProfileMenu } from '../ui/ProfileMenu'
import { useCallback, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMunicipalityStats, getWhiteSpots, getCompanies } from '../api/endpoints'
import { filterToQuery } from '../filters/filterToQuery'
import type { Map } from 'maplibre-gl'
import type { MunicipalityStats } from '../api/types'
import type { CompanyFilters } from '../filters/types'
import styles from './RadarPage.module.css'

export function RadarPage() {
  const { user, logout } = useAuth()
  const { filters, updateFilters, resetFilters } = useFilter()
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>()
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [activeLayer, setActiveLayer] = useState<MapLayer>('none')
  const [selectedDistrict, setSelectedDistrict] = useState<MunicipalityStats | null>(null)
  const [pendingFilters, setPendingFilters] = useState<CompanyFilters>(filters)
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

  // Обработчик применения пресета "Исключённые клиенты"
  const handleExcludedPresetApply = useCallback(() => {
    // Применить фильтры пресета в URL сразу
    updateFilters({
      client: 'ours',
      status: 'excluded',
      minLat: undefined,
      maxLat: undefined,
      minLon: undefined,
      maxLon: undefined
    })
    // Обновить pendingFilters для синхронизации (на случай повторного открытия панели)
    setPendingFilters(prev => ({
      ...prev,
      client: 'ours',
      status: 'excluded',
      minLat: undefined,
      maxLat: undefined,
      minLon: undefined,
      maxLon: undefined
    }))
    // Закрыть мобильную панель фильтров
    setMobileFiltersOpen(false)
    // Переключить на вкладку "Список" на мобильных
    setActiveTab('list')
    // FitBounds на Ростовскую область
    if (mapRef.current) {
      mapRef.current.fitBounds(
        [
          [38.8, 46.0], // [lon, lat] юго-запад
          [43.5, 49.5]  // [lon, lat] северо-восток
        ],
        { duration: 800, padding: 50 }
      )
    }
  }, [updateFilters])

  // Обработчики мобильных фильтров
  const handleOpenMobileFilters = useCallback(() => {
    setPendingFilters(filters)
    setMobileFiltersOpen(true)
  }, [filters])

  const handleApplyMobileFilters = useCallback(() => {
    // Применяем все изменения из pendingFilters
    Object.keys(pendingFilters).forEach((key) => {
      const filterKey = key as keyof CompanyFilters
      if (pendingFilters[filterKey] !== filters[filterKey]) {
        updateFilters({ [filterKey]: pendingFilters[filterKey] })
      }
    })
    setMobileFiltersOpen(false)
  }, [pendingFilters, filters, updateFilters])

  const handleCancelMobileFilters = useCallback(() => {
    setPendingFilters(filters)
    setMobileFiltersOpen(false)
  }, [filters])

  const handlePendingFiltersChange = useCallback((updates: Partial<CompanyFilters>) => {
    setPendingFilters((prev) => ({ ...prev, ...updates }))
  }, [])

  // Подсчёт активных фильтров
  const activeFiltersCount = () => {
    let count = 0
    if (filters.client !== 'all') count++
    if (filters.status !== 'active') count++
    if (filters.industry && filters.industry.length > 0) count++
    if (filters.revenueMin || filters.revenueMax) count++
    if (filters.municipalityId && filters.municipalityId.length > 0) count++
    if (filters.sizeCategory && filters.sizeCategory.length > 0) count++
    if (filters.growthMin) count++
    if (filters.isNew) count++
    if (filters.q) count++
    return count
  }

  // Запрос для подсчёта результатов в мобильной панели - используем примененные фильтры
  const { data: mobileFilterCount } = useQuery({
    queryKey: ['companies-count', filterToQuery(filters)],
    queryFn: async () => {
      const result = await getCompanies(filterToQuery(filters) + '&page=0&size=1')
      return result.total
    },
    enabled: mobileFiltersOpen,
  })

  return (
    <ErrorBoundary>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.logo}>Ростелеком</div>
            <h1 className={styles.titleMobile}>Радар присутствия</h1>
            <div className={styles.headerActions}>
              <span className={styles.userNameDesktop}>{user?.fullName}</span>
              <button onClick={logout} className={styles.logoutButtonDesktop}>
                Выйти
              </button>
              <div className={styles.profileMenuMobile}>
                <ProfileMenu userName={user?.fullName || ''} onLogout={logout} />
              </div>
            </div>
          </div>
          <div className={styles.headerBottom}>
            <ClientToggle
              value={filters.client}
              onChange={(client) => updateFilters({ client })}
            />
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
            onExcludedPresetApply={handleExcludedPresetApply}
          />
        </div>

        {/* Кнопка фильтров на мобайле */}
        <button
          className={styles.mobileFilterButton}
          onClick={handleOpenMobileFilters}
        >
          Фильтры{activeFiltersCount() > 0 && ` · ${activeFiltersCount()}`}
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
        <div className={styles.mobileFilterOverlay} onClick={handleCancelMobileFilters}>
          <div className={styles.mobileFilterPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.mobileFilterHeader}>
              <h3 className={styles.mobileFilterTitle}>Фильтры</h3>
              <button
                className={styles.mobileFilterCloseIcon}
                onClick={handleCancelMobileFilters}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className={styles.mobileFilterContent}>
              <FilterPanel
                filters={pendingFilters}
                onFiltersChange={handlePendingFiltersChange}
                onReset={resetFilters}
                mapRef={mapRef}
                hideHeader={true}
                onExcludedPresetApply={handleExcludedPresetApply}
              />
            </div>
            <div className={styles.mobileFilterFooter}>
              <div className={styles.mobileFilterCount}>
                {mobileFilterCount !== undefined
                  ? `Найдено: ${mobileFilterCount}`
                  : 'Загрузка...'}
              </div>
              <button
                className={styles.mobileFilterApply}
                onClick={handleApplyMobileFilters}
              >
                Применить
              </button>
            </div>
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
