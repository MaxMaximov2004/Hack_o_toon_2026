import { describe, it, expect } from 'vitest'
import { whiteSpotText } from './whiteSpotText'

const nbsp = (s: string) => s.replace(/ /g, ' ')

describe('whiteSpotText', () => {
  it('как на карточке Целинского района', () => {
    const t = whiteSpotText({
      municipalityId: 1, name: 'Целинский р-н', lat: 46.5, lon: 41, potentialScore: 55.37, companies: 1157, clients: 0,
      reason: '1157 компаний, охват РТ 0.00% при среднем по области 0.40%',
    })
    expect(t.potential).toBe('Потенциал 55 из 100')
    expect(nbsp(t.counts)).toBe('1 157 компаний · клиентов РТ 0')
    expect(t.coverage).toBe('Охват РТ 0 % при среднем по области 0,4 %')
  })

  it('г. Донецк: 2 клиента из 1406', () => {
    const t = whiteSpotText({
      municipalityId: 2, name: 'г. Донецк', lat: 48, lon: 39.9, potentialScore: 38.01, companies: 1406, clients: 2,
      reason: '1406 компаний, охват РТ 0.14% при среднем по области 0.40%',
    })
    expect(nbsp(t.counts)).toBe('1 406 компаний · клиентов РТ 2')
    expect(t.coverage).toBe('Охват РТ 0,14 % при среднем по области 0,4 %')
  })

  it('незнакомый формат reason — показываем как есть', () => {
    const t = whiteSpotText({
      municipalityId: 3, name: 'X', lat: 0, lon: 0, potentialScore: 60, companies: 31, clients: 0, reason: 'мало клиентов',
    })
    expect(t.coverage).toBe('мало клиентов')
    expect(t.counts.endsWith('компания · клиентов РТ 0')).toBe(true)
  })
})
