import { useState } from 'react'
import type { WhiteSpot } from '../api/types'
import { whiteSpotText } from './whiteSpotText'
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
              <SpotBody spot={spot} />
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
                <SpotBody spot={spot} />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function SpotBody({ spot }: { spot: WhiteSpot }) {
  const text = whiteSpotText(spot)
  return (
    <>
      <div className={styles.name}>{spot.name}</div>
      <div className={styles.meta}>
        <span className={styles.potential}>{text.potential}</span>
        <span className={styles.companies}>{text.counts}</span>
      </div>
      <div className={styles.reason}>{text.coverage}</div>
    </>
  )
}
