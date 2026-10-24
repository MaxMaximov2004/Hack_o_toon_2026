import { useState } from 'react'
import styles from './MapLegend.module.css'

export function MapLegend() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <>
      {/* Десктоп - всегда развёрнута */}
      <div className={styles.legendDesktop}>
        <div className={styles.title}>Легенда</div>
        <div className={styles.items}>
          <div className={styles.item}>
            <div className={styles.dot} style={{ backgroundColor: 'var(--rt-purple)' }} />
            <span>Наши клиенты</span>
          </div>
          <div className={styles.item}>
            <div className={styles.dot} style={{ backgroundColor: 'var(--rt-orange)' }} />
            <span>Не наши (потенциальные)</span>
          </div>
          <div className={styles.item}>
            <div className={styles.dot} style={{ backgroundColor: 'var(--rt-gray)' }} />
            <span>Исключены из реестра МСП</span>
          </div>
        </div>
      </div>

      {/* Мобильный - сворачиваемая */}
      <div className={styles.legendMobile}>
        {isExpanded ? (
          <div className={styles.legendExpanded}>
            <div className={styles.items}>
              <div className={styles.item}>
                <div className={styles.dot} style={{ backgroundColor: 'var(--rt-purple)' }} />
                <span>Наши</span>
              </div>
              <div className={styles.item}>
                <div className={styles.dot} style={{ backgroundColor: 'var(--rt-orange)' }} />
                <span>Не наши</span>
              </div>
              <div className={styles.item}>
                <div className={styles.dot} style={{ backgroundColor: 'var(--rt-gray)' }} />
                <span>Исключены</span>
              </div>
            </div>
            <button
              className={styles.closeButton}
              onClick={() => setIsExpanded(false)}
              aria-label="Свернуть легенду"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            className={styles.legendButton}
            onClick={() => setIsExpanded(true)}
            aria-label="Показать легенду"
          >
            i
          </button>
        )}
      </div>
    </>
  )
}
