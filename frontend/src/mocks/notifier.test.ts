import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildMockNotifications,
  createSubscription,
  deleteSubscription,
  getNotifications,
  getProjectById,
  getSubscriptions,
  markAllNotificationsRead,
  markNotificationRead,
  resetNotifierMocks,
} from './fixtures'
import subscriptionsExample from '../../../contracts/examples/subscriptions.json'
import notificationsExample from '../../../contracts/examples/notifications.json'

const sortedKeys = (o: object) => Object.keys(o).sort()

describe('мок notifier: подписки', () => {
  beforeEach(resetNotifierMocks)

  it('стартует с contracts/examples/subscriptions.json, форма та же (Ростов 53 → 1 мокового справочника)', () => {
    const subs = getSubscriptions()
    expect(subs.map((s) => s.id)).toEqual(subscriptionsExample.map((s) => s.id))
    subs.forEach((s) => expect(sortedKeys(s)).toEqual(sortedKeys(subscriptionsExample[0])))
    expect(subs[0].municipalityId).toBe(1)
  })

  it('пустая подписка и неизвестный код → ошибка валидации', () => {
    expect(createSubscription({})).toMatchObject({ ok: false })
    expect(createSubscription({ industry: 'nope' })).toMatchObject({ ok: false, field: 'industry' })
    expect(createSubscription({ need: 'nope' })).toMatchObject({ ok: false, field: 'need' })
  })

  it('создание — новые сверху, форма как в контракте; удаление — 404 на повтор', () => {
    const result = createSubscription({ industry: 'logistics', municipalityId: 1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(sortedKeys(result.subscription)).toEqual(sortedKeys(subscriptionsExample[0]))
    expect(getSubscriptions()[0].id).toBe(result.subscription.id)

    expect(deleteSubscription(result.subscription.id)).toBe(true)
    expect(deleteSubscription(result.subscription.id)).toBe(false)
  })
})

describe('мок notifier: лента', () => {
  beforeEach(resetNotifierMocks)

  it('форма как в contracts/examples/notifications.json, проекты существуют', () => {
    const response = getNotifications()
    expect(sortedKeys(response)).toEqual(sortedKeys(notificationsExample))
    response.items.forEach((n) => {
      expect(sortedKeys(n)).toEqual(sortedKeys(notificationsExample.items[0]))
      expect(getProjectById(n.projectId)?.title).toBe(n.title)
    })
    expect(response.unreadCount).toBe(response.items.filter((n) => !n.isRead).length)
  })

  it('детерминирована (SeededRandom), новые сверху', () => {
    const now = new Date('2026-10-24T12:00:00Z')
    const a = buildMockNotifications(now)
    expect(buildMockNotifications(now)).toEqual(a)
    const times = a.map((n) => Date.parse(n.createdAt))
    expect([...times].sort((x, y) => y - x)).toEqual(times)
  })

  it('отметка прочитанным и «прочитать все»', () => {
    const before = getNotifications().unreadCount
    const firstUnread = getNotifications().items.find((n) => !n.isRead)!
    expect(markNotificationRead(firstUnread.id)).toBe(true)
    expect(getNotifications().unreadCount).toBe(before - 1)
    expect(markNotificationRead(999999)).toBe(false)
    markAllNotificationsRead()
    expect(getNotifications().unreadCount).toBe(0)
    expect(getNotifications(true).items).toEqual([])
  })

  it('новая подписка даёт «+1» в колокольчике (вместо demo-project)', () => {
    markAllNotificationsRead()
    createSubscription({ municipalityId: 1 })
    const { unreadCount, items } = getNotifications()
    expect(unreadCount).toBe(1)
    expect(getProjectById(items[0].projectId)?.municipalityId).toBe(1)
  })
})
