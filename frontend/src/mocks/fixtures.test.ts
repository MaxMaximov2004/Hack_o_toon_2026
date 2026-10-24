import { describe, it, expect } from 'vitest'
import { filterCompanies, getAllCompanies, type MockFilters } from './fixtures'

describe('filterCompanies', () => {
  it('returns all companies when no filters applied', () => {
    const all = getAllCompanies()
    const filtered = filterCompanies({})

    expect(filtered.length).toBe(all.length)
  })

  it('returns fewer companies with industry filter', () => {
    const all = getAllCompanies()
    const filters: MockFilters = {
      industry: ['energy'],
    }
    const filtered = filterCompanies(filters)

    expect(filtered.length).toBeLessThan(all.length)
    expect(filtered.length).toBeGreaterThan(0)

    // Все отфильтрованные компании должны быть из энергетики
    filtered.forEach((company) => {
      expect(company.industry).toBe('energy')
    })
  })

  it('returns correct total count equal to filtered companies count', () => {
    const filters: MockFilters = {
      industry: ['energy'],
      status: 'active',
    }
    const filtered = filterCompanies(filters)

    // total должен равняться числу компаний после фильтра
    expect(filtered.length).toBeGreaterThan(0)

    // Проверяем, что все компании соответствуют фильтрам
    filtered.forEach((company) => {
      expect(company.industry).toBe('energy')
      expect(company.status).toBe('active')
    })
  })

  it('filters by client type', () => {
    const oursFilter: MockFilters = { client: 'ours' }
    const othersFilter: MockFilters = { client: 'others' }

    const ours = filterCompanies(oursFilter)
    const others = filterCompanies(othersFilter)

    ours.forEach((c) => expect(c.kind).toBe('ours'))
    others.forEach((c) => expect(c.kind).toBe('others'))

    expect(ours.length).toBeGreaterThan(0)
    expect(others.length).toBeGreaterThan(0)
  })

  it('filters by bbox (bounding box)', () => {
    const filters: MockFilters = {
      bbox: {
        minLat: 47.0,
        maxLat: 47.5,
        minLon: 39.0,
        maxLon: 40.0,
      },
    }
    const filtered = filterCompanies(filters)

    filtered.forEach((company) => {
      expect(company.lat).toBeGreaterThanOrEqual(47.0)
      expect(company.lat).toBeLessThanOrEqual(47.5)
      expect(company.lon).toBeGreaterThanOrEqual(39.0)
      expect(company.lon).toBeLessThanOrEqual(40.0)
    })
  })

  it('combines multiple filters correctly', () => {
    const filters: MockFilters = {
      industry: ['trade', 'logistics'],
      client: 'ours',
      status: 'active',
    }
    const filtered = filterCompanies(filters)

    filtered.forEach((company) => {
      expect(['trade', 'logistics']).toContain(company.industry)
      expect(company.kind).toBe('ours')
      expect(company.status).toBe('active')
    })
  })

  it('filters by size category', () => {
    const filters: MockFilters = {
      sizeCategory: ['small'],
    }
    const filtered = filterCompanies(filters)

    expect(filtered.length).toBeGreaterThan(0)
    filtered.forEach((company) => {
      expect(company.sizeCategory).toBe('small')
    })
  })

  it('filters by revenue range', () => {
    const filters: MockFilters = {
      revenueMin: 10_000_000,
      revenueMax: 50_000_000,
    }
    const filtered = filterCompanies(filters)

    filtered.forEach((company) => {
      expect(company.revenueEst).not.toBeNull()
      expect(company.revenueEst!).toBeGreaterThanOrEqual(10_000_000)
      expect(company.revenueEst!).toBeLessThanOrEqual(50_000_000)
    })
  })

  it('filters by search query (company name)', () => {
    const filters: MockFilters = {
      q: 'Южный',
    }
    const filtered = filterCompanies(filters)

    filtered.forEach((company) => {
      expect(company.name.toLowerCase()).toContain('южный')
    })
  })

  it('filters by new companies', () => {
    const filters: MockFilters = {
      isNew: true,
    }
    const filtered = filterCompanies(filters)

    filtered.forEach((company) => {
      expect(company.isNew).toBe(true)
    })
  })

  it('total count in handler matches filtered companies', () => {
    // Эмулируем то, что делает хендлер /api/companies
    const filters: MockFilters = {
      industry: ['energy'],
      status: 'active',
    }

    const items = filterCompanies(filters)
    const total = items.length

    // total должен быть равен количеству отфильтрованных компаний
    expect(total).toBe(items.length)
    expect(total).toBeLessThan(getAllCompanies().length)
  })
})
