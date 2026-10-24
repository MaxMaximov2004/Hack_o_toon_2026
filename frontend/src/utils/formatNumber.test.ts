import { describe, it, expect } from 'vitest'
import { formatRub, formatPct } from './formatNumber'

// Intl разделяет тысячи неразрывным пробелом — сравниваем с обычным
const plain = (s: string) => s.replace(/\s/g, ' ')

describe('formatRub', () => {
  it('целые рубли с разделителем тысяч', () => {
    expect(plain(formatRub(578978.4))).toBe('578 978 ₽')
    expect(plain(formatRub(1234567))).toBe('1 234 567 ₽')
    expect(formatRub(850)).toBe('850 ₽')
    expect(formatRub(0)).toBe('0 ₽')
  })

  it('копейки округляются до рубля', () => {
    expect(plain(formatRub(459879.5))).toBe('459 880 ₽')
  })

  it('отрицательные — со знаком (скидка за объём)', () => {
    expect(plain(formatRub(-5610))).toBe('-5 610 ₽')
  })

  it('null → прочерк', () => {
    expect(formatRub(null)).toBe('—')
    expect(formatRub(undefined)).toBe('—')
  })
})

describe('formatPct', () => {
  it('до одного знака, десятичная запятая', () => {
    expect(formatPct(33.4)).toBe('33,4 %')
    expect(formatPct(29.89)).toBe('29,9 %')
    expect(formatPct(20)).toBe('20 %')
    expect(formatPct(-5.82)).toBe('-5,8 %')
  })

  it('null → прочерк', () => {
    expect(formatPct(null)).toBe('—')
  })
})
