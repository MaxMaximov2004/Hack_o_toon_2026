/**
 * Форматирование сумм в миллионах/миллиардах рублей
 * ≥ 1000 млн → «17,1 млрд ₽»
 * < 1000 млн → «850 млн ₽»
 */

const ruNumberFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export function formatMoney(amountMln: number | null | undefined): string {
  if (amountMln === null || amountMln === undefined) return '—'
  if (amountMln >= 1000) {
    const amountBln = amountMln / 1000
    return `${ruNumberFormat.format(amountBln)} млрд ₽`
  }
  return `${ruNumberFormat.format(amountMln)} млн ₽`
}

/** Годы проекта: «2024–2028», «с 2024», «до 2028», «—» (годы в данных бывают пустыми) */
export function formatYears(startYear: number | null, launchYear: number | null): string {
  if (startYear && launchYear) return `${startYear}–${launchYear}`
  if (startYear) return `с ${startYear}`
  if (launchYear) return `до ${launchYear}`
  return '—'
}
