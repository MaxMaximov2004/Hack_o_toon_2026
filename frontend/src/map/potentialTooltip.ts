import type { MunicipalityStats } from '../api/types'
import { plural } from '../utils/plural'

const ruInt = new Intl.NumberFormat('ru-RU')

/**
 * Подсказка слоя «Потенциал». potentialScore = привлекательность района × недоохват (core.refresh_municipality_stats):
 * 0 — не «пустой район», а охват РТ здесь уже не ниже среднего по области.
 */
export function potentialTooltip(stats: MunicipalityStats): string {
  const score = Math.round(stats.potentialScore)
  const coverage = (stats.coverage * 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
  if (score === 0) {
    return `${stats.name} · потенциал 0 из 100 — охват РТ выше среднего по области (${coverage} %)`
  }
  const companies = `${ruInt.format(stats.companies)} ${plural(stats.companies, ['компания', 'компании', 'компаний'])}`
  return `${stats.name} · потенциал ${score} из 100 · охват ${coverage} % · ${companies}`
}
