/**
 * Рубли и проценты для калькулятора сделок (суммы приходят в рублях, не в миллионах — для них formatMoney)
 * formatRub(578978.4) → «578 979 ₽», formatPct(33.4) → «33,4 %»
 */

const rubFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

const pctFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export function formatRub(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return `${rubFormat.format(amount)} ₽`
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${pctFormat.format(value)} %`
}
