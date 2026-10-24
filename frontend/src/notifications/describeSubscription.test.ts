import { describe, it, expect } from 'vitest'
import { describeSubscription } from './describeSubscription'
import { mockDictionaries } from '../mocks/fixtures'

describe('describeSubscription', () => {
  const base = { id: 1, industry: null, municipalityId: null, need: null, stage: null, createdAt: '' }

  it('отрасль · район', () => {
    expect(describeSubscription({ ...base, industry: 'logistics', municipalityId: 1 }, mockDictionaries)).toBe(
      'Логистика · Ростов-на-Дону'
    )
  })

  it('потребность · стадия', () => {
    expect(
      describeSubscription({ ...base, need: 'phys_security', stage: 'construction' }, mockDictionaries)
    ).toBe('Физическая безопасность · стадия Строительство')
  })

  it('без справочника — коды, неизвестный район — номер', () => {
    expect(describeSubscription({ ...base, industry: 'it', municipalityId: 777 }, undefined)).toBe(
      'it · район №777'
    )
  })
})
