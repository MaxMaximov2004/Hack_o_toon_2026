import styles from './MapLayerToggles.module.css'

export type MapLayer = 'none' | 'heat' | 'potential' | 'whiteSpots'

interface MapLayerTogglesProps {
  activeLayer: MapLayer
  onChange: (layer: MapLayer) => void
}

export function MapLayerToggles({ activeLayer, onChange }: MapLayerTogglesProps) {
  return (
    <div className={styles.container}>
      <button
        className={`${styles.button} ${activeLayer === 'heat' ? styles.active : ''}`}
        onClick={() => onChange(activeLayer === 'heat' ? 'none' : 'heat')}
      >
        Тепловая карта
      </button>
      <button
        className={`${styles.button} ${activeLayer === 'potential' ? styles.active : ''}`}
        onClick={() => onChange(activeLayer === 'potential' ? 'none' : 'potential')}
      >
        Потенциал
      </button>
      <button
        className={`${styles.button} ${activeLayer === 'whiteSpots' ? styles.active : ''}`}
        onClick={() => onChange(activeLayer === 'whiteSpots' ? 'none' : 'whiteSpots')}
      >
        Белые пятна
      </button>
    </div>
  )
}
