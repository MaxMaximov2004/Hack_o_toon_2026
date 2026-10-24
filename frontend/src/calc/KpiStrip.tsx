import type { EstimateResponse } from './types'
import { analogTier, isDistribution, minBasisText, tierKpi } from './insights'
import { formatRub, formatPct } from '../utils/formatNumber'
import { plural } from '../utils/plural'
import styles from './KpiStrip.module.css'

/** Верхняя полоса дашборда: цены min/opt/max с маржой и место оптимума среди аналогов */
export function KpiStrip({ estimate }: { estimate: EstimateResponse }) {
  const { price, margin, costs, analogs } = estimate
  const tiles = [
    { key: 'min', label: 'Минимум', value: price.min, pct: margin.minPct },
    { key: 'optimal', label: 'Оптимум', value: price.optimal, pct: margin.optimalPct },
    { key: 'max', label: 'Максимум', value: price.max, pct: margin.maxPct },
  ]
  const tier =
    analogs.available && analogs.count > 0 && isDistribution(analogs.distribution)
      ? tierKpi(analogTier(price.optimal, analogs.distribution))
      : null

  return (
    <section className={styles.strip} aria-label="Цена, маржа и место среди аналогов">
      <div className={styles.tiles}>
        {tiles.map((t) => (
          <div key={t.key} className={`${styles.tile} ${styles[t.key]}`}>
            <span className={styles.label}>{t.label}</span>
            <span className={styles.value}>{formatRub(t.value)}</span>
            <span className={`${styles.note} ${t.pct < 0 ? styles.negative : ''}`}>маржа {formatPct(t.pct)}</span>
          </div>
        ))}
        <div className={`${styles.tile} ${styles.analogs}`}>
          <span className={styles.label}>Оптимум среди аналогов</span>
          {tier ? (
            <>
              <span className={styles.value}>{tier.value}</span>
              <span className={styles.note}>
                {tier.note}, из {analogs.count} {plural(analogs.count, ['проекта', 'проектов', 'проектов'])}
              </span>
            </>
          ) : (
            <>
              <span className={styles.value}>—</span>
              <span className={styles.note}>аналоги недоступны</span>
            </>
          )}
        </div>
      </div>
      <p className={styles.basis}>{minBasisText(price.minBasis)}</p>
      <dl className={styles.costs}>
        <div>
          <dt>Оборудование</dt>
          <dd>{formatRub(costs.equipment)}</dd>
        </div>
        <div>
          <dt>Работы</dt>
          <dd>{formatRub(costs.works)}</dd>
        </div>
        <div>
          <dt>Себестоимость</dt>
          <dd>{formatRub(costs.direct)}</dd>
        </div>
      </dl>
    </section>
  )
}
