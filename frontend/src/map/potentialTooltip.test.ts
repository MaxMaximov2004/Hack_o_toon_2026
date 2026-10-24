import { describe, it, expect } from 'vitest'
import { potentialTooltip } from './potentialTooltip'
import type { MunicipalityStats } from '../api/types'

const base: MunicipalityStats = {
  municipalityId: 1, name: 'Пролетарский р-н', kind: 'district', lat: 46.7, lon: 41.7, industry: 'all',
  companies: 1204, clients: 9, excludedClients: 0, coverage: 0.0075, newShare: 0.1, revenueEstSum: null,
  potentialScore: 0, isWhiteSpot: false, reason: null,
}

describe('potentialTooltip', () => {
  it('0 — объясняем, что охват уже выше среднего', () => {
    expect(potentialTooltip(base)).toBe('Пролетарский р-н · потенциал 0 из 100 — охват РТ выше среднего по области (0,75 %)')
  })

  it('иначе — потенциал из 100, охват и число компаний', () => {
    expect(potentialTooltip({ ...base, potentialScore: 63.4, coverage: 0.003 }).replace(/\u00a0/g, ' ')).toBe(
      'Пролетарский р-н · потенциал 63 из 100 · охват 0,3 % · 1 204 компании'
    )
  })
})
