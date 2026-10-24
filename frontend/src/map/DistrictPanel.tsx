import type { MunicipalityStats } from '../api/types'
import styles from './DistrictPanel.module.css'

interface DistrictPanelProps {
  stats: MunicipalityStats
  onShowCompanies: (municipalityId: number) => void
  onClose: () => void
}

export function DistrictPanel({ stats, onShowCompanies, onClose }: DistrictPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>{stats.name}</h3>
        <button className={styles.closeButton} onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.row}>
          <span className={styles.label}>Действующих компаний:</span>
          <span className={styles.value}>{stats.companies}</span>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Наших клиентов:</span>
          <span className={styles.value}>{stats.clients}</span>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Доля охвата:</span>
          <span className={styles.value}>{stats.coverage.toFixed(1)}%</span>
        </div>

        {stats.excludedClients > 0 && (
          <div className={styles.row}>
            <span className={styles.label}>Исключённых клиентов:</span>
            <span className={styles.value}>{stats.excludedClients}</span>
          </div>
        )}

        <div className={styles.row}>
          <span className={styles.label}>Суммарная выручка:</span>
          <span className={styles.value}>
            {(stats.revenueEstSum / 1_000_000).toFixed(1)} млн ₽
          </span>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Потенциал:</span>
          <span className={styles.value}>
            <span className={styles.potential}>{stats.potentialScore}/100</span>
          </span>
        </div>

        <button
          className={styles.showButton}
          onClick={() => onShowCompanies(stats.municipalityId)}
        >
          Показать компании района
        </button>
      </div>
    </div>
  )
}
