import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getDictionaries } from '../api/endpoints'
import type { OpenProjectState } from '../notifications/NotificationBell'
import type { AnalogDistribution, AnalogProject, EstimateResponse } from './types'
import { analogTier, analogsCaption, analogsUnavailableText, compareWithBudget, isDistribution, tierText } from './insights'
import { formatRub } from '../utils/formatNumber'
import { formatMoney } from '../utils/formatMoney'
import styles from './AnalogsBlock.module.css'

/** Позиция на логарифмической шкале, 0..100 % — бюджеты аналогов отличаются в сотни раз */
export function logPosition(value: number, min: number, max: number): number {
  const lo = Math.log10(Math.max(min, 1))
  const hi = Math.log10(Math.max(max, 1))
  if (hi === lo) return 50
  const pos = ((Math.log10(Math.max(value, 1)) - lo) / (hi - lo)) * 100
  return Math.min(Math.max(pos, 0), 100)
}

/** Сравнение с аналогами: шкала ИТ-бюджетов p10…p90 с нашей оптимальной ценой и ближайшие по масштабу проекты */
export function AnalogsBlock({ estimate }: { estimate: EstimateResponse }) {
  const { analogs, price } = estimate

  if (!analogs.available) {
    return <p className={styles.hint}>{analogsUnavailableText(price.minBasis)}</p>
  }

  return (
    <div className={styles.container}>
      <p className={styles.caption}>{analogsCaption(analogs.count)}</p>
      {isDistribution(analogs.distribution) && <DistributionScale dist={analogs.distribution} price={price.optimal} />}
      {price.minBasis !== 'analogs_p25' && (
        <p className={styles.hint}>Аналогов меньше пяти — минимум посчитан по запасному правилу: оптимум × 0,9.</p>
      )}
      {analogs.nearest.length > 0 && <NearestCompare nearest={analogs.nearest} price={price.optimal} />}
    </div>
  )
}

// Координаты шкалы — по ширине телефона, как у графика маржи
const W = 360
const H = 96
const X0 = 16
const X1 = W - 16
const BAR_Y = 40

/**
 * Подпись у точки x, не вылезающая за края шкалы: у левого края — от точки вправо, у правого — влево.
 * prefer — желаемое выравнивание, если места хватает.
 */
export function labelAt(x: number, prefer: 'start' | 'middle' | 'end' = 'middle'): { x: number; textAnchor: 'start' | 'middle' | 'end' } {
  const room = 90 // примерно половина самой длинной подписи в координатах шкалы
  if (x - X0 < room && prefer !== 'start') return { x: Math.max(x, X0), textAnchor: 'start' }
  if (X1 - x < room && prefer !== 'end') return { x: Math.min(x, X1), textAnchor: 'end' }
  if (prefer === 'start' && X1 - x < room * 2) return { x: Math.min(x, X1), textAnchor: 'end' }
  if (prefer === 'end' && x - X0 < room * 2) return { x: Math.max(x, X0), textAnchor: 'start' }
  return { x, textAnchor: prefer }
}

function DistributionScale({ dist, price }: { dist: AnalogDistribution; price: number }) {
  const lo = Math.min(dist.p10, price)
  const hi = Math.max(dist.p90, price)
  const x = (v: number) => X0 + (logPosition(v, lo, hi) / 100) * (X1 - X0)
  const tier = tierText(analogTier(price, dist))
  const rows: [string, number][] = [
    ['10-й перцентиль', dist.p10],
    ['25-й перцентиль', dist.p25],
    ['медиана', dist.p50],
    ['75-й перцентиль', dist.p75],
    ['90-й перцентиль', dist.p90],
    ['наша оптимальная цена', price],
  ]
  const priceX = x(price)

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Оптимальная цена ${formatRub(price)} — ${tier}. Половина ИТ-бюджетов от ${formatRub(dist.p25)} до ${formatRub(dist.p75)}.`}
      >
        <line className={styles.whisker} x1={x(dist.p10)} x2={x(dist.p90)} y1={BAR_Y} y2={BAR_Y} />
        <rect className={styles.box} x={x(dist.p25)} y={BAR_Y - 9} width={Math.max(x(dist.p75) - x(dist.p25), 1)} height={18} rx={4} />
        <line className={styles.median} x1={x(dist.p50)} x2={x(dist.p50)} y1={BAR_Y - 12} y2={BAR_Y + 12} />
        {[dist.p10, dist.p90].map((v) => (
          <line key={v} className={styles.whisker} x1={x(v)} x2={x(v)} y1={BAR_Y - 6} y2={BAR_Y + 6} />
        ))}

        {/* Подписи — только p10, медиана и p90 (p25/p75 на телефоне налезают — они в таблице ниже).
            Узкое распределение (p10 и p90 рядом) — одна подпись диапазона */}
        {x(dist.p90) - x(dist.p10) < 140 ? (
          <text className={styles.axisText} {...labelAt((x(dist.p10) + x(dist.p90)) / 2)} y={BAR_Y + 30}>
            10–90 % · {formatMoney(dist.p10 / 1e6)} – {formatMoney(dist.p90 / 1e6)}
          </text>
        ) : (
          <>
            <text className={styles.axisText} {...labelAt(x(dist.p10), 'start')} y={BAR_Y + 30}>
              10 % · {formatMoney(dist.p10 / 1e6)}
            </text>
            <text className={styles.axisText} {...labelAt(x(dist.p90), 'end')} y={BAR_Y + 30}>
              90 % · {formatMoney(dist.p90 / 1e6)}
            </text>
          </>
        )}
        <text className={styles.axisText} {...labelAt(x(dist.p50))} y={BAR_Y + 46}>
          медиана · {formatMoney(dist.p50 / 1e6)}
        </text>

        <circle className={styles.marker} cx={priceX} cy={BAR_Y} r={7} />
        <text className={styles.markerText} {...labelAt(priceX)} y={BAR_Y - 18}>
          наша цена · {formatMoney(price / 1e6)}
        </text>
      </svg>
      <figcaption className={styles.tier}>
        Оптимум <strong>{tier}</strong>
      </figcaption>
      <table className={styles.visuallyHidden}>
        <caption>ИТ-бюджеты инвестпроектов области и наша цена</caption>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{formatRub(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/** Ближайшие по масштабу проекты: ИТ-бюджет полосой, наша цена — отметкой на той же шкале, разница в рублях и % */
function NearestCompare({ nearest, price }: { nearest: AnalogProject[]; price: number }) {
  const navigate = useNavigate()
  const { data: dict } = useQuery({ queryKey: ['dictionaries'], queryFn: getDictionaries, staleTime: Infinity })
  const industryName = (code: string) => dict?.industries.find((i) => i.code === code)?.name ?? code
  const scale = Math.max(price, ...nearest.map((a) => a.itBudget), 1)
  const pricePos = `${(price / scale) * 100}%`

  return (
    <>
      <h4 className={styles.subtitle}>Ближайшие по масштабу</h4>
      <p className={styles.legend}>
        <span className={styles.legendBar} aria-hidden="true" /> ИТ-бюджет проекта
        <span className={styles.legendMark} aria-hidden="true" /> наша оптимальная цена {formatRub(price)}
      </p>
      <ul className={styles.list}>
        {nearest.map((a, i) => {
          const cmp = compareWithBudget(price, a.itBudget)
          return (
            <li key={a.id ?? `n${i}`} className={styles.row}>
              <div className={styles.rowHead}>
                <span className={styles.rowTitle}>{a.title ?? 'Без названия'}</span>
                <span className={styles.rowMeta}>
                  {industryName(a.industry)} · ИТ-бюджет {formatRub(a.itBudget)}
                </span>
              </div>
              <div className={styles.track} aria-hidden="true">
                <span className={styles.bar} style={{ width: `${(a.itBudget / scale) * 100}%` }} />
                <span className={styles.priceMark} style={{ left: pricePos }} />
              </div>
              <div className={styles.rowFoot}>
                <span className={cmp.diff > 0 ? styles.diffUp : styles.diffDown}>{cmp.text}</span>
                {a.id !== null && (
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => {
                      const state: OpenProjectState = { openProjectId: a.id! }
                      navigate('/navigator', { state })
                    }}
                  >
                    Открыть в Навигаторе
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
