import { http, HttpResponse } from 'msw'
import type {
  LoginResponse,
  TwoFactorVerifyResponse,
  User,
  MapCellsResponse,
  MapPointsResponse,
} from '../api/types'
import { mockDictionaries, generateMapCells } from './fixtures'

// Демо-пользователи
const DEMO_USER: User = {
  id: 1,
  email: 'demo@rt.ru',
  fullName: 'Демо Пользователь',
  roles: ['user'],
}

const ADMIN_USER: User = {
  id: 2,
  email: 'admin@rt.ru',
  fullName: 'Администратор',
  roles: ['user', 'admin'],
}

// Простое хранилище токенов (в памяти)
const validTokens = new Set<string>()

export const handlers = [
  // POST /api/auth/login
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string }

    // Проверяем демо-аккаунты
    if (
      (body.email === 'demo@rt.ru' && body.password === 'Demo2026!') ||
      (body.email === 'admin@rt.ru' && body.password === 'Admin2026!')
    ) {
      const response: LoginResponse = {
        mfaToken: 'mock-mfa-token-' + Date.now(),
        mfaSetupRequired: body.email === 'admin@rt.ru', // Админ показывает QR
        ...(body.email === 'admin@rt.ru' && {
          otpauthUrl: 'otpauth://totp/RadarRT:admin@rt.ru?secret=JBSWY3DPEHPK3PXP&issuer=RadarRT',
          qrPngBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // Заглушка, 1x1 пиксель
        }),
      }
      return HttpResponse.json(response)
    }

    // Неверные учётные данные
    return HttpResponse.json(
      {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Неверный email или пароль',
        },
      },
      { status: 401 }
    )
  }),

  // POST /api/auth/2fa/verify
  http.post('/api/auth/2fa/verify', async ({ request }) => {
    const body = await request.json() as { mfaToken: string; code: string }

    // Принимаем любой 6-значный код
    if (body.code.length === 6 && /^\d{6}$/.test(body.code)) {
      const token = 'mock-access-token-' + Date.now()
      validTokens.add(token)

      // Определяем пользователя по mfaToken (упрощённо)
      const user = body.mfaToken.includes('admin') ? ADMIN_USER : DEMO_USER

      const response: TwoFactorVerifyResponse = {
        accessToken: token,
        expiresIn: 3600,
        user,
      }
      return HttpResponse.json(response)
    }

    // Неверный код
    return HttpResponse.json(
      {
        error: {
          code: 'INVALID_CODE',
          message: 'Неверный код',
        },
      },
      { status: 401 }
    )
  }),

  // GET /api/auth/me
  http.get('/api/auth/me', ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (token && validTokens.has(token)) {
      // Упрощённо возвращаем демо-пользователя
      return HttpResponse.json(DEMO_USER)
    }

    return HttpResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Требуется авторизация',
        },
      },
      { status: 401 }
    )
  }),

  // GET /api/dictionaries
  http.get('/api/dictionaries', () => {
    return HttpResponse.json(mockDictionaries)
  }),

  // GET /api/map/cells
  http.get('/api/map/cells', ({ request }) => {
    const url = new URL(request.url)
    const zoom = parseInt(url.searchParams.get('zoom') || '7', 10)

    // Парсим bbox если есть
    const minLat = url.searchParams.get('minLat')
    const maxLat = url.searchParams.get('maxLat')
    const minLon = url.searchParams.get('minLon')
    const maxLon = url.searchParams.get('maxLon')

    const bbox =
      minLat && maxLat && minLon && maxLon
        ? {
            minLat: parseFloat(minLat),
            maxLat: parseFloat(maxLat),
            minLon: parseFloat(minLon),
            maxLon: parseFloat(maxLon),
          }
        : undefined

    // Генерируем данные
    const { cells, points } = generateMapCells(zoom, bbox)

    // Переключаемся в режим points при zoom >= 11
    if (zoom >= 11) {
      const response: MapPointsResponse = {
        mode: 'points',
        total: points.length,
        points,
      }
      return HttpResponse.json(response)
    }

    // Режим cells для низких зумов
    const total = cells.reduce((sum, cell) => sum + cell.total, 0)
    const cellDeg = 84 / Math.pow(2, zoom)

    const response: MapCellsResponse = {
      mode: 'cells',
      cellDeg,
      total,
      cells,
    }
    return HttpResponse.json(response)
  }),
]
