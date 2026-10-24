import { describe, it, expect } from 'vitest'
import { formatMoney } from './formatMoney'

describe('formatMoney', () => {
  it('форматирует суммы < 1000 млн', () => {
    expect(formatMoney(850)).toBe('850 млн ₽')
    expect(formatMoney(1)).toBe('1 млн ₽')
    expect(formatMoney(999)).toBe('999 млн ₽')
  })

  it('форматирует суммы ≥ 1000 млн в млрд', () => {
    expect(formatMoney(1000)).toBe('1 млрд ₽')
    expect(formatMoney(17142.1)).toBe('17,1 млрд ₽')
    expect(formatMoney(150458.84)).toBe('150,5 млрд ₽')
    expect(formatMoney(230000)).toBe('230 млрд ₽')
  })

  it('использует русскую локаль с запятой', () => {
    expect(formatMoney(1234.5)).toBe('1,2 млрд ₽')
    expect(formatMoney(500.7)).toBe('500,7 млн ₽')
  })

  it('округляет до 1 знака после запятой', () => {
    expect(formatMoney(1234.56)).toBe('1,2 млрд ₽')
    expect(formatMoney(1235)).toBe('1,2 млрд ₽')
  })

  it('не показывает дробную часть для целых чисел', () => {
    expect(formatMoney(1000)).toBe('1 млрд ₽')
    expect(formatMoney(500)).toBe('500 млн ₽')
  })
})
