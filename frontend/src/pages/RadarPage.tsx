import { useAuth } from '../auth/AuthProvider'
import { useFilter } from '../filters/useFilter'
import { ClientToggle } from '../filters/ClientToggle'
import { RadarMap } from '../map/RadarMap'
import { MapLegend } from '../map/MapLegend'
import { CompanyList } from '../list/CompanyList'
import { CompanyCard } from '../company/CompanyCard'
import { Tabs } from '../ui/Tabs'
import { useCallback, useState } from 'react'
import styles from './RadarPage.module.css'

export function RadarPage() {
  const { user, logout } = useAuth()
  const { filters, updateFilters } = useFilter()
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>()
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map')

  const handleBoundsChange = useCallback((bounds: {
    minLat: number
    maxLat: number
    minLon: number
    maxLon: number
  }) => {
    updateFilters(bounds)
  }, [updateFilters])

  const handleSelectCompany = useCallback((id: number) => {
    setSelectedCompanyId(id)
  }, [])

  const handleCloseCard = useCallback(() => {
    setSelectedCompanyId(undefined)
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
        <div className={`${styles.mapContainer} ${activeTab === 'map' ? styles.active : ''}`}>
          <RadarMap
            filters={filters}
            selectedCompanyId={selectedCompanyId}
            onBoundsChange={handleBoundsChange}
            onSelectCompany={handleSelectCompany}
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

      {selectedCompanyId && (
        <CompanyCard companyId={selectedCompanyId} onClose={handleCloseCard} />
      )}
    </div>
  )
}
