import type { EstimateResponse } from './types'
import { KpiStrip } from './KpiStrip'
import { MarginChart } from './MarginChart'
import { AnalogsBlock } from './AnalogsBlock'
import { Waterfall } from './Waterfall'
import { ItemsTable, Assumptions } from './EstimateDetails'
import { insightText } from './insights'
import styles from './Dashboard.module.css'

/**
 * Дашборд расчёта — за 10 секунд: цена, маржа, место среди аналогов.
 * Сверху KPI и вывод, ниже сетка 2×2: маржа | аналоги, водопад | позиции (на < 1280 — колонкой).
 */
export function Dashboard({ estimate }: { estimate: EstimateResponse }) {
  return (
    <div className={styles.dashboard}>
      <section className={styles.card}>
        <KpiStrip estimate={estimate} />
        <p className={styles.insight}>{insightText(estimate)}</p>
      </section>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Маржинальность</h3>
          <MarginChart estimate={estimate} />
        </section>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Сравнение с аналогами</h3>
          <AnalogsBlock estimate={estimate} />
        </section>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Из чего складывается цена</h3>
          <Waterfall breakdown={estimate.breakdown} optimal={estimate.price.optimal} />
        </section>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Позиции</h3>
          <ItemsTable estimate={estimate} />
          <div className={styles.assumptions}>
            <Assumptions estimate={estimate} />
          </div>
        </section>
      </div>
    </div>
  )
}
