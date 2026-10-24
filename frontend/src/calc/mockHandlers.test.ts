import { describe, it, expect, afterEach, vi } from 'vitest'
import { mockAnalogs } from './mockHandlers'
import { mockEstimate } from './mockEstimate'
import type { CalcCatalog, EstimateRequest } from './types'
import catalogFixture from '../mocks/fixtures/calc-catalog.json'

const catalog = catalogFixture as CalcCatalog
const body: EstimateRequest = {
  regionId: 3, level: 'basic', termMonths: 12, financing: 'prepay', stages: ['pir'],
  items: [{ componentId: 'el_01', qty: 10 }], customItems: [], urgent: false, uniqueSolution: false,
}

describe('мок аналогов: флаг calc-mock-analogs', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    sessionStorage.clear()
  })

  it('без режима моков флаг не читается — настоящие 63 аналога', () => {
    vi.stubEnv('VITE_USE_MOCKS', 'false')
    sessionStorage.setItem('calc-mock-analogs', 'off')
    expect(mockAnalogs()).toMatchObject({ available: true, count: 63 })
  })

  it('режим моков, флаг off — как analogs.py при недоступном core-api; минимум по запасному правилу', () => {
    vi.stubEnv('VITE_USE_MOCKS', 'true')
    sessionStorage.setItem('calc-mock-analogs', 'off')
    const analogs = mockAnalogs()
    expect(analogs).toEqual({ available: false, source: null, count: 0, percentile: null, distribution: {}, nearest: [] })
    const e = mockEstimate(body, catalog, analogs)
    expect(e.price.minBasis).toBe('fallback_0.9')
    expect(e.assumptions).toContain('Аналоги недоступны — расчёт минимума по запасному правилу')
  })

  it('режим моков, флаг few — 3 аналога (синтетика), минимум по запасному правилу, как в engine.py', () => {
    vi.stubEnv('VITE_USE_MOCKS', 'true')
    sessionStorage.setItem('calc-mock-analogs', 'few')
    const analogs = mockAnalogs()
    expect(analogs).toMatchObject({ available: true, count: 3 })
    expect(analogs.nearest).toHaveLength(3)
    expect(mockEstimate(body, catalog, analogs).price.minBasis).toBe('fallback_0.9')
  })

  it('неизвестное значение флага — настоящие аналоги', () => {
    vi.stubEnv('VITE_USE_MOCKS', 'true')
    sessionStorage.setItem('calc-mock-analogs', 'что-то')
    expect(mockAnalogs().count).toBe(63)
  })
})
