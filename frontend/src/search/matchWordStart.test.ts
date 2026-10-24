import { describe, it, expect } from 'vitest'
import { matchWordStart, normalize } from './matchWordStart'

describe('normalize', () => {
  it('converts to lowercase', () => {
    expect(normalize('ИТ')).toBe('ит')
    expect(normalize('Строительство')).toBe('строительство')
  })

  it('replaces ё with е', () => {
    expect(normalize('Алёшки')).toBe('алешки')
    expect(normalize('Чёрный')).toBe('черный')
  })

  it('handles combined case', () => {
    expect(normalize('Белая Калитва')).toBe('белая калитва')
  })
})

describe('matchWordStart', () => {
  describe('exact match', () => {
    it('matches exact same word', () => {
      expect(matchWordStart('ИТ', 'ит')).toBe('exact')
      expect(matchWordStart('ит', 'ИТ')).toBe('exact')
    })

    it('handles ё/е in exact match', () => {
      expect(matchWordStart('Алёшки', 'алешки')).toBe('exact')
    })
  })

  describe('start of first word', () => {
    it('matches beginning of first word', () => {
      expect(matchWordStart('Строительство', 'стро')).toBe('startFirst')
      expect(matchWordStart('ИТ', 'и')).toBe('startFirst')
    })

    it('matches full first word when there are multiple words', () => {
      expect(matchWordStart('Белая Калитва', 'белая')).toBe('startFirst')
    })
  })

  describe('start of other word', () => {
    it('matches beginning of second word', () => {
      expect(matchWordStart('Белая Калитва', 'кал')).toBe('startOther')
      expect(matchWordStart('г. Азов', 'азов')).toBe('startOther')
    })

    it('matches beginning of third word', () => {
      expect(matchWordStart('Город Ростов-на-Дону', 'ростов')).toBe('startOther')
    })
  })

  describe('no match', () => {
    it('returns null for substring in middle of word', () => {
      expect(matchWordStart('Строительство', 'ит')).toBe(null)
      expect(matchWordStart('Белая Калитва', 'ит')).toBe(null)
    })

    it('returns null for non-existent substring', () => {
      expect(matchWordStart('ИТ', 'логист')).toBe(null)
    })

    it('returns null for empty query', () => {
      expect(matchWordStart('ИТ', '')).toBe(null)
    })
  })

  describe('real-world cases from requirements', () => {
    it('"ит" should NOT match "Строительство"', () => {
      expect(matchWordStart('Строительство', 'ит')).toBe(null)
    })

    it('"ит" should NOT match "Белая Калитва"', () => {
      expect(matchWordStart('Белая Калитва', 'ит')).toBe(null)
    })

    it('"ит" should match "ИТ" exactly', () => {
      expect(matchWordStart('ИТ', 'ит')).toBe('exact')
    })

    it('"стро" should match "Строительство" at start', () => {
      expect(matchWordStart('Строительство', 'стро')).toBe('startFirst')
    })

    it('"кал" should match "Белая Калитва" at start of second word', () => {
      expect(matchWordStart('Белая Калитва', 'кал')).toBe('startOther')
    })

    it('"азов" should match "г. Азов" at start of second word', () => {
      expect(matchWordStart('г. Азов', 'азов')).toBe('startOther')
    })

    it('"азов" should match "Азовский р-н" at start of first word', () => {
      expect(matchWordStart('Азовский р-н', 'азов')).toBe('startFirst')
    })
  })

  describe('case insensitivity', () => {
    it('matches regardless of case', () => {
      expect(matchWordStart('СТРОИТЕЛЬСТВО', 'стро')).toBe('startFirst')
      expect(matchWordStart('строительство', 'СТРО')).toBe('startFirst')
      expect(matchWordStart('СтРоИтЕлЬсТвО', 'СтРо')).toBe('startFirst')
    })
  })
})
