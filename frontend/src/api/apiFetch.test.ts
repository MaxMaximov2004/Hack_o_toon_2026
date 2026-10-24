import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, setToken, getToken } from './apiFetch'

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('apiFetch: 401', () => {
  const originalLocation = window.location

  beforeEach(() => {
    // jsdom не даёт присвоить location.href — подменяем объект целиком
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/navigator', search: '?stage=launch', href: '' },
    })
    setToken('old-token')
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    vi.unstubAllGlobals()
  })

  it('неверный код на 2FA — настоящая ошибка из тела, без редиректа', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respond(401, { error: { code: 'INVALID_CODE', message: 'Неверный код' } })
    ))
    await expect(apiFetch('/api/auth/2fa/verify', { method: 'POST', body: '{}' })).rejects.toEqual({
      code: 'INVALID_CODE',
      message: 'Неверный код',
    })
    expect(window.location.href).toBe('')
  })

  it('неверный пароль — INVALID_CREDENTIALS', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respond(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Неверный email или пароль' } })
    ))
    await expect(apiFetch('/api/auth/login', { method: 'POST', body: '{}' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
  })

  it('протухший токен на /api/... — стираем токен, на вход с next вместе с фильтром', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respond(401, { error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' } })
    ))
    await expect(apiFetch('/api/projects')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(getToken()).toBeNull()
    expect(window.location.href).toBe(`/login?next=${encodeURIComponent('/navigator?stage=launch')}`)
  })
})
