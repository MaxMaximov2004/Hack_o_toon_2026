import { useAuth } from '../auth/AuthProvider'
import { useFilter } from '../filters/useFilter'
import { ClientToggle } from '../filters/ClientToggle'
import { RadarMap } from '../map/RadarMap'
import { MapLegend } from '../map/MapLegend'
import { useCallback } from 'react'
import styles from './RadarPage.module.css'

export function RadarPage() {
  const { user, logout } = useAuth()
  const { filters, updateFilters } = useFilter()

  // Стабильная функция - не пересоздаётся при каждом рендере
  const handleBoundsChange = useCallback((bounds: {
    minLat: number
    maxLat: number
    minLon: number
    maxLon: number
  }) => {
    updateFilters(bounds)
  }, [updateFilters])

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

      <main className={styles.main}>
        <div className={styles.mapContainer}>
          <RadarMap filters={filters} onBoundsChange={handleBoundsChange} />
          <MapLegend />
        </div>
      </main>
    </div>
  )
}
