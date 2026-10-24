import { useAuth } from '../auth/AuthProvider'
import { useFilter } from '../filters/useFilter'
import { ClientToggle } from '../filters/ClientToggle'
import { FilterPanel } from '../filters/FilterPanel'
import { RadarMap } from '../map/RadarMap'
import { MapLegend } from '../map/MapLegend'
import { CompanyList } from '../list/CompanyList'
import { CompanyCard } from '../company/CompanyCard'
import { Tabs } from '../ui/Tabs'
import { useCallback, useState, useRef } from 'react'
import type { Map } from 'maplibre-gl'
import styles from './RadarPage.module.css'

export function RadarPage() {
  const { user, logout } = useAuth()
  const { filters, updateFilters, resetFilters } = useFilter()
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>()
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
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

  return (
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
          <RadarMap
            filters={filters}
            selectedCompanyId={selectedCompanyId}
            onBoundsChange={handleBoundsChange}
            onSelectCompany={handleSelectCompany}
            onMapReady={handleMapReady}
          />
          <MapLegend />
        </div>

        <div className={`${styles.listContainer} ${activeTab === 'list' ? styles.active : ''}`}>
          <CompanyList
            filters={filters}
            selectedId={selectedCompanyId}
            onSelectCompany={handleSelectCompany}
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
  )
}
