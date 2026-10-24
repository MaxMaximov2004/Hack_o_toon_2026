import { describe, it, expect } from 'vitest'
import { mockEstimate, MockValidationError } from './mockEstimate'
import type { CalcCatalog, EstimateRequest, EstimateResponse } from './types'
import catalogFixture from '../mocks/fixtures/calc-catalog.json'
import estimateFixture from '../mocks/fixtures/calc-estimate.json'

const catalog = catalogFixture as CalcCatalog
const real = estimateFixture as EstimateResponse

// Тело, на котором снят calc-estimate.json со стенда (POST /api/calc/estimate, 25.10.2026)
const fixtureBody: EstimateRequest = {
  regionId: 3, level: 'basic', termMonths: 12, financing: 'prepay', stages: ['pir', 'pnr', 'shef'],
  urgent: false, uniqueSolution: false,
  items: [{ componentId: 'el_01', qty: 10 }, { componentId: 'ht_01', qty: 2 }, { componentId: 'vn_02', qty: 6, nonStandard: true }],
  customItems: [{ name: 'ПО диспетчеризации', unit: 'лиц.', unitPrice: 150000, qty: 1, complexity: 1 }],
}

describe('mockEstimate = calc-service', () => {
  it('на теле фикстуры ответ совпадает с настоящим до копейки', () => {
    expect(mockEstimate(fixtureBody, catalog, real.analogs)).toEqual(real)
  })

  it('без позиций — нули, как у сервиса', () => {
    const e = mockEstimate({ ...fixtureBody, items: [], customItems: [] }, catalog, real.analogs)
    expect(e.price).toMatchObject({ min: 0, optimal: 0, max: 0 })
  })

  it('срочность и уникальность растят цену, шаги водопада есть', () => {
    const e = mockEstimate({ ...fixtureBody, urgent: true, uniqueSolution: true }, catalog, real.analogs)
    expect(e.price.optimal).toBeGreaterThan(real.price.optimal)
    expect(e.breakdown.find((b) => b.key === 'urgent')!.amount).toBeGreaterThan(0)
    expect(e.price.urgent).not.toBeNull()
  })

  it('ошибки — как у сервиса: неизвестный регион, дубликат, qty вне границ', () => {
    expect(() => mockEstimate({ ...fixtureBody, regionId: 99 }, catalog, real.analogs)).toThrow('Неизвестный регион: 99')
    expect(() =>
      mockEstimate({ ...fixtureBody, items: [{ componentId: 'el_01', qty: 1 }, { componentId: 'el_01', qty: 2 }] }, catalog, real.analogs)
    ).toThrow('Дубликат позиции [1]: el_01')
    try {
      mockEstimate({ ...fixtureBody, items: [{ componentId: 'el_01', qty: 0 }] }, catalog, real.analogs)
    } catch (e) {
      expect(e).toBeInstanceOf(MockValidationError)
      expect((e as MockValidationError).field).toBe('items.0.qty')
    }
  })
})
