import { describe, it, expect } from 'vitest'
import {
  analogTier,
  analogsCaption,
  analogsUnavailableText,
  compareWithBudget,
  insightText,
  minBasisText,
  tierKpi,
  tierText,
} from './insights'
import type { AnalogDistribution, EstimateResponse } from './types'
import estimateFixture from '../mocks/fixtures/calc-estimate.json'

const estimate = estimateFixture as EstimateResponse
const dist: AnalogDistribution = { p10: 100, p25: 200, p50: 300, p75: 400, p90: 500 }
const plain = (s: string) => s.replace(/\s/g, ' ')

describe('analogTier / tierText', () => {
  it('ниже p10 — «ниже 10 % аналогов»', () => {
    expect(tierText(analogTier(99, dist))).toBe('ниже 10 % аналогов')
    expect(tierKpi(analogTier(99, dist))).toEqual({ value: 'ниже 10 %', note: 'аналогов' })
  })

  it('p90 и выше — «выше 90 % аналогов»', () => {
    expect(tierText(analogTier(500, dist))).toBe('выше 90 % аналогов')
    expect(tierText(analogTier(10_000, dist))).toBe('выше 90 % аналогов')
    expect(tierKpi(analogTier(600, dist)).value).toBe('выше 90 %')
  })

  it('между перцентилями; ровно на границе — «выше» этой границы', () => {
    expect(tierText(analogTier(100, dist))).toBe('выше 10 % и ниже 25 % аналогов')
    expect(tierText(analogTier(250, dist))).toBe('выше 25 % и ниже 50 % аналогов')
    expect(tierText(analogTier(300, dist))).toBe('выше 50 % и ниже 75 % аналогов')
    expect(tierText(analogTier(499, dist))).toBe('выше 75 % и ниже 90 % аналогов')
    expect(tierKpi(analogTier(250, dist))).toEqual({ value: 'выше 25 %', note: 'и ниже 50 % аналогов' })
  })

  it('на реальном ответе: оптимум 578 978 ₽ между p10 (504 000) и p25 (1 548 000)', () => {
    const d = estimate.analogs.distribution as AnalogDistribution
    expect(tierText(analogTier(estimate.price.optimal, d))).toBe('выше 10 % и ниже 25 % аналогов')
  })
})

describe('подписи', () => {
  it('сравнение с N инвестпроектами — склонение, без «вашей отрасли»', () => {
    expect(analogsCaption(63)).toBe('Сравнение с 63 инвестпроектами области (ориентир по ИТ-бюджетам)')
    expect(analogsCaption(1)).toBe('Сравнение с 1 инвестпроектом области (ориентир по ИТ-бюджетам)')
    expect(analogsCaption(3)).not.toMatch(/отрасл/)
  })

  it('источник минимума', () => {
    expect(minBasisText('analogs_p25')).toBe('Минимум — по 25-му перцентилю бюджетов аналогов')
    expect(minBasisText('fallback_0.9')).toBe('Минимум — оптимум × 0,9: запасное правило (аналогов нет или меньше пяти)')
    expect(analogsUnavailableText('fallback_0.9')).toBe('Аналоги недоступны — минимум посчитан по запасному правилу: оптимум × 0,9.')
  })

  it('наша цена против ИТ-бюджета: выше / ниже / равна', () => {
    expect(plain(compareWithBudget(578978.4, 472000).text)).toBe('наша цена выше на 106 978 ₽ (+22,7 %)')
    expect(plain(compareWithBudget(400000, 500000).text)).toBe('наша цена ниже на 100 000 ₽ (−20 %)')
    expect(compareWithBudget(500000.2, 500000).text).toBe('наша цена равна ИТ-бюджету')
    expect(compareWithBudget(100, 0).pct).toBeNull()
  })
})

describe('insightText', () => {
  it('реальный ответ: маржа на оптимуме и минимуме, запас для торга, ступень среди 63 проектов', () => {
    expect(plain(insightText(estimate))).toBe(
      'Оптимум 578 978 ₽ даёт маржу 13,4 %; на минимуме 550 029 ₽ — 8,9 %, запас для торга 28 949 ₽. ' +
        'Оптимум выше 10 % и ниже 25 % аналогов по ИТ-бюджетам 63 инвестпроектов области.'
    )
  })

  it('отрицательная маржа на минимуме — «в убытке»', () => {
    const loss = { ...estimate, margin: { ...estimate.margin, minPct: -5.82 } }
    expect(insightText(loss)).toMatch(/сделка в убытке \(маржа -5,8 %\)/)
  })

  it('аналоги недоступны — без ступени, с правилом минимума', () => {
    const off = {
      ...estimate,
      price: { ...estimate.price, minBasis: 'fallback_0.9' },
      analogs: { available: false, source: null, count: 0, percentile: null, distribution: {}, nearest: [] },
    } as EstimateResponse
    const text = insightText(off)
    expect(text).toMatch(/Аналоги недоступны — минимум посчитан по запасному правилу: оптимум × 0,9\.$/)
    expect(text).not.toMatch(/аналогов по ИТ-бюджетам/)
  })
})
