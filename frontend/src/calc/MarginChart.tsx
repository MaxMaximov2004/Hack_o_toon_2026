import { useState, type PointerEvent } from 'react'
import type { EstimateResponse, MarginPoint } from './types'
import { formatRub, formatPct } from '../utils/formatNumber'
import styles from './MarginChart.module.css'

// Координаты SVG: ширина ~ телефона, чтобы подписи не мельчали; на десктопе график просто растягивается
const W = 360
const H = 200
const PAD = { left: 40, right: 12, top: 24, bottom: 28 }

interface Scale {
  x: (price: number) => number
  y: (pct: number) => number
  minPct: number
  maxPct: number
}

export function buildScale(curve: MarginPoint[]): Scale {
  const prices = curve.map((p) => p.price)
  const pcts = curve.map((p) => p.marginPct)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  // Ось маржи всегда включает 0 — видно, где сделка уходит в минус
  const minPct = Math.min(0, ...pcts)
  const maxPct = Math.max(0, ...pcts)
  const spanPrice = maxPrice - minPrice || 1
  const spanPct = maxPct - minPct || 1
  return {
    x: (price) => PAD.left + ((price - minPrice) / spanPrice) * (W - PAD.left - PAD.right),
    y: (pct) => PAD.top + ((maxPct - pct) / spanPct) * (H - PAD.top - PAD.bottom),
    minPct,
    maxPct,
  }
}

/** Ближайшая точка кривой к цене (подсказка при наведении/касании) */
export function nearestPoint(curve: MarginPoint[], price: number): MarginPoint {
  return curve.reduce((best, p) => (Math.abs(p.price - price) < Math.abs(best.price - price) ? p : best), curve[0])
}

/** График маржинальности: маржа (%) в зависимости от цены сделки, отметки минимума, оптимума и максимума */
export function MarginChart({ estimate }: { estimate: EstimateResponse }) {
  const { curve } = estimate.margin
  const [active, setActive] = useState<MarginPoint | null>(null)

  if (curve.length < 2) {
    return <p className={styles.hint}>Недостаточно точек для графика</p>
  }

  const scale = buildScale(curve)
  const line = curve.map((p) => `${scale.x(p.price).toFixed(1)},${scale.y(p.marginPct).toFixed(1)}`).join(' ')
  const marks = [
    { key: 'min', label: 'мин', title: 'Минимум', price: estimate.price.min, pct: estimate.margin.minPct },
    { key: 'optimal', label: 'опт', title: 'Оптимум', price: estimate.price.optimal, pct: estimate.margin.optimalPct },
    { key: 'max', label: 'макс', title: 'Максимум', price: estimate.price.max, pct: estimate.margin.maxPct },
  ]
  const yTicks = [scale.maxPct, (scale.maxPct + scale.minPct) / 2, scale.minPct]
  const shown = active ?? { price: estimate.price.optimal, marginPct: estimate.margin.optimalPct }

  const handlePointer = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    const prices = curve.map((p) => p.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const price = minPrice + ((svgX - PAD.left) / (W - PAD.left - PAD.right)) * (maxPrice - minPrice)
    setActive(nearestPoint(curve, price))
  }

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label={`Маржа от ${formatPct(curve[0].marginPct)} до ${formatPct(curve[curve.length - 1].marginPct)} при цене от ${formatRub(curve[0].price)} до ${formatRub(curve[curve.length - 1].price)}`}
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={() => setActive(null)}
      >
        {yTicks.map((pct) => (
          <g key={pct}>
            <line className={styles.grid} x1={PAD.left} x2={W - PAD.right} y1={scale.y(pct)} y2={scale.y(pct)} />
            <text className={styles.axisText} x={PAD.left - 6} y={scale.y(pct) + 4} textAnchor="end">
              {Math.round(pct)}%
            </text>
          </g>
        ))}
        {scale.minPct < 0 && (
          <line className={styles.zero} x1={PAD.left} x2={W - PAD.right} y1={scale.y(0)} y2={scale.y(0)} />
        )}

        <polyline className={styles.curve} points={line} />

        {marks.map((m) => {
          const x = scale.x(m.price)
          const y = scale.y(m.pct)
          // Кривая идёт вверх вправо: мин и макс подписываем сверху слева, опт — снизу справа, чтобы не лечь на линию
          const anchor = m.key === 'optimal' ? 'start' : 'end'
          const dx = m.key === 'optimal' ? 8 : -8
          const dy = m.key === 'optimal' ? 18 : -10
          const select = () => setActive({ price: m.price, marginPct: m.pct })
          return (
            <g
              key={m.key}
              role="button"
              tabIndex={0}
              aria-label={`${m.title}: цена ${formatRub(m.price)}, маржа ${formatPct(m.pct)}`}
              className={styles.markGroup}
              onFocus={select}
              onPointerDown={(e) => {
                e.stopPropagation()
                select()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') select()
              }}
            >
              <line className={styles.markLine} x1={x} x2={x} y1={PAD.top} y2={H - PAD.bottom} />
              {/* Зона нажатия 48×48 в координатах графика — на телефоне не меньше 44 px */}
              <rect className={styles.hit} x={x - 24} y={y - 24} width={48} height={48} />
              <circle className={`${styles.mark} ${styles[m.key]}`} cx={x} cy={y} r={5} />
              <text className={styles.valueText} x={x + dx} y={y + dy} textAnchor={anchor}>
                {formatPct(m.pct)}
              </text>
              <text className={styles.axisText} x={x} y={H - PAD.bottom + 16} textAnchor="middle">
                {m.label}
              </text>
            </g>
          )
        })}

        {active && (
          <circle className={styles.activePoint} cx={scale.x(active.price)} cy={scale.y(active.marginPct)} r={4} />
        )}
      </svg>
      <figcaption className={styles.readout} aria-live="polite">
        При цене <strong>{formatRub(shown.price)}</strong> маржа <strong>{formatPct(shown.marginPct)}</strong>
      </figcaption>
      <table className={styles.visuallyHidden}>
        <caption>Маржа в зависимости от цены сделки</caption>
        <thead>
          <tr>
            <th scope="col">Цена</th>
            <th scope="col">Маржа</th>
          </tr>
        </thead>
        <tbody>
          {curve.map((p) => (
            <tr key={p.price}>
              <td>{formatRub(p.price)}</td>
              <td>{formatPct(p.marginPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
