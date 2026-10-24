import { ErrorBoundary } from '../ui/ErrorBoundary'
import styles from './MapErrorBoundary.module.css'

interface MapErrorBoundaryProps {
  children: React.ReactNode
}

export function MapErrorBoundary({ children }: MapErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={() => (
        <div className={styles.container}>
          <div className={styles.content}>
            <h3 className={styles.title}>Не удалось отобразить карту</h3>
            <p className={styles.message}>
              Произошла ошибка при загрузке карты. Попробуйте обновить страницу.
            </p>
            <button className={styles.button} onClick={() => window.location.reload()}>
              Обновить
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
