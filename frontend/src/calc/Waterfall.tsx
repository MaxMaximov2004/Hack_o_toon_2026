import type { BreakdownStep } from './types'
import { formatRub } from '../utils/formatNumber'
import styles from './Waterfall.module.css'

export interface WaterfallBar {
  key: string
  label: string
  amount: number
  start: number // откуда начинается полоса, ₽
  end: number
  kind: 'base' | 'up' | 'down' | 'total'
}

/**
 * «Водопад» из breakdown: себестоимость, затем шаги (регион, уровень, срочность…) накопительно, в конце — оптимум.
 * Нулевые шаги не рисуем. Итог берём из price.optimal, а не из суммы шагов — показываем ответ сервиса как есть.
 */
export function buildWaterfall(breakdown: BreakdownStep[], optimal: number): WaterfallBar[] {
  const bars: WaterfallBar[] = []
  let level = 0
  for (const step of breakdown) {
    if (step.key !== 'direct' && step.amount === 0) continue
    const start = step.key === 'direct' ? 0 : level
    const end = start + step.amount
    bars.push({
      key: step.key,
      label: step.label,
      amount: step.amount,
      start,
      end,
      kind: step.key === 'direct' ? 'base' : step.amount < 0 ? 'down' : 'up',
    })
    level = end
  }
  bars.push({ key: 'optimal', label: 'Оптимальная цена', amount: optimal, start: 0, end: optimal, kind: 'total' })
  return bars
}

export function Waterfall({ breakdown, optimal }: { breakdown: BreakdownStep[]; optimal: number }) {
  const bars = buildWaterfall(breakdown, optimal)
  const scale = Math.max(...bars.map((b) => Math.max(b.start, b.end)), 1)

  return (
    <ol className={styles.waterfall} aria-label="Из чего складывается цена">
      {bars.map((bar) => {
        const left = (Math.min(bar.start, bar.end) / scale) * 100
        const width = Math.max((Math.abs(bar.end - bar.start) / scale) * 100, 0.5)
        return (
          <li key={bar.key} className={`${styles.row} ${bar.kind === 'total' ? styles.rowTotal : ''}`}>
            <div className={styles.text}>
              <span className={styles.label}>{bar.label}</span>
              <span className={styles.amount}>
                {bar.kind === 'up' ? '+' : ''}
                {formatRub(bar.amount)}
              </span>
            </div>
            <div className={styles.track} aria-hidden="true">
              <span className={`${styles.bar} ${styles[bar.kind]}`} style={{ left: `${left}%`, width: `${width}%` }} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
