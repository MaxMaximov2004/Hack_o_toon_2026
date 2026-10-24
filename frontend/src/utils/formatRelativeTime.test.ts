import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from './formatRelativeTime'

const now = new Date('2026-10-24T12:00:00Z')
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString()

describe('formatRelativeTime', () => {
  it('минуты, часы, дни', () => {
    expect(formatRelativeTime(ago(0), now)).toBe('только что')
    expect(formatRelativeTime(ago(5), now)).toBe('5 мин назад')
    expect(formatRelativeTime(ago(180), now)).toBe('3 ч назад')
    expect(formatRelativeTime(ago(26 * 60), now)).toBe('вчера')
    expect(formatRelativeTime(ago(4 * 24 * 60), now)).toBe('4 дн назад')
  })

  it('старше недели — дата', () => {
    expect(formatRelativeTime('2026-10-01T10:00:00Z', now)).toBe('01.10.2026')
  })
})
