import { useState } from 'react'
import type { WhiteSpot } from '../api/types'
import styles from './WhiteSpotsList.module.css'

interface WhiteSpotsListProps {
  spots: WhiteSpot[]
  onSelectSpot: (lat: number, lon: number) => void
}

export function WhiteSpotsList({ spots, onSelectSpot }: WhiteSpotsListProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (spots.length === 0) {
    return null
  }

  return (
    <>
      {/* Десктоп - всегда развёрнуто */}
      <div className={styles.containerDesktop}>
        <h3 className={styles.title}>Топ белых пятен</h3>
        <div className={styles.list}>
          {spots.map((spot) => (
            <button
              key={spot.municipalityId}
              className={styles.item}
              onClick={() => onSelectSpot(spot.lat, spot.lon)}
            >
              <div className={styles.name}>{spot.name}</div>
              <div className={styles.meta}>
                <span className={styles.potential}>
                  Потенциал: {spot.potentialScore}
                </span>
                <span className={styles.companies}>
                  {spot.companies} компаний, {spot.clients} клиентов
                </span>
              </div>
              <div className={styles.reason}>{spot.reason}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Мобильный - сворачиваемая плашка */}
      <div className={styles.containerMobile}>
        <button
          className={styles.mobileToggle}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          Белые пятна ({spots.length})
        </button>
        {isExpanded && (
          <div className={styles.mobileList}>
            {spots.map((spot) => (
              <button
                key={spot.municipalityId}
                className={styles.item}
                onClick={() => {
                  onSelectSpot(spot.lat, spot.lon)
                  setIsExpanded(false)
                }}
              >
                <div className={styles.name}>{spot.name}</div>
                <div className={styles.meta}>
                  <span className={styles.potential}>
                    Потенциал: {spot.potentialScore}
                  </span>
                  <span className={styles.companies}>
                    {spot.companies} компаний, {spot.clients} клиентов
                  </span>
                </div>
                <div className={styles.reason}>{spot.reason}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
