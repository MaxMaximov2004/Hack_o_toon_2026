import styles from './MapLayerToggles.module.css'

export type MapLayer = 'none' | 'potential' | 'whiteSpots'

interface MapLayerTogglesProps {
  activeLayer: MapLayer
  onChange: (layer: MapLayer) => void
}

export function MapLayerToggles({ activeLayer, onChange }: MapLayerTogglesProps) {
  return (
    <div className={styles.container}>
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
