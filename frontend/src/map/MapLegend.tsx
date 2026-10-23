import styles from './MapLegend.module.css'

export function MapLegend() {
  return (
    <div className={styles.legend}>
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
  )
}
