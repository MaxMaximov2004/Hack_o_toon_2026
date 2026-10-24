/**
 * Форматирование сумм в миллионах/миллиардах рублей
 * ≥ 1000 млн → «17,1 млрд ₽»
 * < 1000 млн → «850 млн ₽»
 */

const ruNumberFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export function formatMoney(amountMln: number): string {
  if (amountMln >= 1000) {
    const amountBln = amountMln / 1000
    return `${ruNumberFormat.format(amountBln)} млрд ₽`
  }
  return `${ruNumberFormat.format(amountMln)} млн ₽`
}
