import type { WhiteSpot } from '../api/types'
import { plural } from '../utils/plural'

const ruInt = new Intl.NumberFormat('ru-RU')
const percent = (value: number) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} %`

/**
 * Тексты карточки белого пятна. Охват РТ = клиенты РТ / действующие компании района.
 * Средний охват по области есть только в reason от core-api («… при среднем по области 0.40%») — берём оттуда;
 * формат поменяется — покажем reason как есть.
 */
export function whiteSpotText(spot: WhiteSpot) {
  const coverage = spot.companies > 0 ? (spot.clients / spot.companies) * 100 : 0
  const regional = spot.reason?.match(/среднем по области\s+([\d.,]+)\s*%/)
  return {
    potential: `Потенциал ${Math.round(spot.potentialScore)} из 100`,
    counts: `${ruInt.format(spot.companies)} ${plural(spot.companies, ['компания', 'компании', 'компаний'])} · клиентов РТ ${ruInt.format(spot.clients)}`,
    coverage: regional
      ? `Охват РТ ${percent(coverage)} при среднем по области ${percent(Number(regional[1].replace(',', '.')))}`
      : spot.reason ?? `Охват РТ ${percent(coverage)}`,
  }
}
