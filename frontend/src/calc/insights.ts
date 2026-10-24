import type { AnalogDistribution, EstimateResponse } from './types'
import { formatRub, formatPct } from '../utils/formatNumber'
import { plural } from '../utils/plural'

/**
 * Тексты дашборда — только из чисел ответа calc-service.
 * Аналоги — ИТ-бюджеты всех инвестпроектов области (analogs.py): без отрасли и без учёта цены сделки,
 * поэтому никаких «аналогов вашей отрасли»; сырых бюджетов в ответе нет — только перцентили p10…p90.
 */

export const PERCENTILE_LEVELS = [10, 25, 50, 75, 90] as const

/** Откуда минимум (minBasis в ответе calc-service) */
export function minBasisText(minBasis: string): string {
  if (minBasis === 'analogs_p25') return 'Минимум — по 25-му перцентилю бюджетов аналогов'
  if (minBasis === 'fallback_0.9') return 'Минимум — оптимум × 0,9: запасное правило (аналогов нет или меньше пяти)'
  return minBasis
}

/** analogs.available=false: честно, по какому правилу посчитан минимум */
export function analogsUnavailableText(minBasis: string): string {
  return minBasis === 'fallback_0.9'
    ? 'Аналоги недоступны — минимум посчитан по запасному правилу: оптимум × 0,9.'
    : `Аналоги недоступны. ${minBasisText(minBasis)}.`
}

export function isDistribution(d: EstimateResponse['analogs']['distribution']): d is AnalogDistribution {
  return PERCENTILE_LEVELS.every((l) => typeof (d as Partial<AnalogDistribution>)[`p${l}`] === 'number')
}

/** Ступень цены среди аналогов: below10 / above90 / между двумя перцентилями (цена ≥ pN считается «выше N %») */
export type AnalogTier =
  | { kind: 'below10' }
  | { kind: 'above90' }
  | { kind: 'between'; above: number; below: number }

export function analogTier(price: number, dist: AnalogDistribution): AnalogTier {
  if (price < dist.p10) return { kind: 'below10' }
  if (price >= dist.p90) return { kind: 'above90' }
  let above: number = PERCENTILE_LEVELS[0]
  for (const level of PERCENTILE_LEVELS) {
    if (price >= dist[`p${level}`]) above = level
  }
  const below = PERCENTILE_LEVELS[PERCENTILE_LEVELS.indexOf(above as (typeof PERCENTILE_LEVELS)[number]) + 1]
  return { kind: 'between', above, below }
}

/** «ниже 10 % аналогов», «выше 90 % аналогов», «выше 10 % и ниже 25 % аналогов» */
export function tierText(tier: AnalogTier): string {
  if (tier.kind === 'below10') return 'ниже 10 % аналогов'
  if (tier.kind === 'above90') return 'выше 90 % аналогов'
  return `выше ${tier.above} % и ниже ${tier.below} % аналогов`
}

/** Короткая подпись для плитки KPI: значение и уточнение */
export function tierKpi(tier: AnalogTier): { value: string; note: string } {
  if (tier.kind === 'below10') return { value: 'ниже 10 %', note: 'аналогов' }
  if (tier.kind === 'above90') return { value: 'выше 90 %', note: 'аналогов' }
  return { value: `выше ${tier.above} %`, note: `и ниже ${tier.below} % аналогов` }
}

/** «Сравнение с 63 инвестпроектами области (ориентир по ИТ-бюджетам)» */
export function analogsCaption(count: number): string {
  const word = plural(count, ['инвестпроектом', 'инвестпроектами', 'инвестпроектами'])
  return `Сравнение с ${count} ${word} области (ориентир по ИТ-бюджетам)`
}

/** Наша оптимальная цена против ИТ-бюджета проекта: разница в рублях и процентах от бюджета */
export function compareWithBudget(price: number, itBudget: number): { diff: number; pct: number | null; text: string } {
  const diff = price - itBudget
  const pct = itBudget > 0 ? (diff / itBudget) * 100 : null
  if (Math.round(diff) === 0) return { diff, pct, text: 'наша цена равна ИТ-бюджету' }
  const sign = diff > 0 ? '+' : '−'
  const pctText = pct === null ? '' : ` (${sign}${formatPct(Math.abs(pct))})`
  return {
    diff,
    pct,
    text: `наша цена ${diff > 0 ? 'выше' : 'ниже'} на ${formatRub(Math.abs(diff))}${pctText}`,
  }
}

/** Строка вывода: 1–2 предложения из реальных чисел (маржа в точках min/opt и ступень среди аналогов) */
export function insightText(estimate: EstimateResponse): string {
  const { price, margin, analogs } = estimate
  const head = `Оптимум ${formatRub(price.optimal)} даёт маржу ${formatPct(margin.optimalPct)}`
  const minPart =
    margin.minPct < 0
      ? `на минимуме ${formatRub(price.min)} сделка в убытке (маржа ${formatPct(margin.minPct)})`
      : `на минимуме ${formatRub(price.min)} — ${formatPct(margin.minPct)}, запас для торга ${formatRub(price.optimal - price.min)}`
  const first = `${head}; ${minPart}.`

  if (!analogs.available) {
    return `${first} ${analogsUnavailableText(price.minBasis)}`
  }
  if (!isDistribution(analogs.distribution) || analogs.count === 0) return first

  const projects = plural(analogs.count, ['инвестпроекта', 'инвестпроектов', 'инвестпроектов'])
  return `${first} Оптимум ${tierText(analogTier(price.optimal, analogs.distribution))} по ИТ-бюджетам ${analogs.count} ${projects} области.`
}
