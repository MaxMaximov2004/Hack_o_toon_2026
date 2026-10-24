import { http, HttpResponse } from 'msw'
import type {
  LoginResponse,
  TwoFactorVerifyResponse,
  User,
  MapCellsResponse,
  MapPointsResponse,
  CompaniesResponse,
  CompanyShort,
  ProjectsResponse,
  Project,
  ProjectRelatedCompaniesResponse,
  SubscriptionsResponse,
  NotificationsResponse,
  TelegramLinkResponse,
} from '../api/types'
import {
  mockDictionaries,
  generateMapCells,
  filterCompanies,
  getCompanyById,
  generateMunicipalityStats,
  generateWhiteSpots,
  filterProjects,
  getProjectById,
  getProjectTimeline,
  getProjectRelatedCompanies,
  getSubscriptions,
  createSubscription,
  deleteSubscription,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type MockFilters,
  type ProjectMockFilters,
} from './fixtures'
import telegramLinkExample from '../../../contracts/examples/telegram-link.json'

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

    // Принимаем любой токен с префиксом 'mock-access-token-'
    if (token && token.startsWith('mock-access-token-')) {
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

  // GET /api/map/cells - использует ОБЩУЮ функцию фильтрации
  http.get('/api/map/cells', ({ request }) => {
    const url = new URL(request.url)
    const zoom = parseInt(url.searchParams.get('zoom') || '7', 10)

    // Парсим ВСЕ фильтры из URL (те же, что у списка)
    const filters: MockFilters = {
      client: url.searchParams.get('client') || 'all',
      status: url.searchParams.get('status') || 'active',
    }

    // bbox
    const minLat = url.searchParams.get('minLat')
    const maxLat = url.searchParams.get('maxLat')
    const minLon = url.searchParams.get('minLon')
    const maxLon = url.searchParams.get('maxLon')

    if (minLat && maxLat && minLon && maxLon) {
      filters.bbox = {
        minLat: parseFloat(minLat),
        maxLat: parseFloat(maxLat),
        minLon: parseFloat(minLon),
        maxLon: parseFloat(maxLon),
      }
    }

    // Другие фильтры
    const industries = url.searchParams.getAll('industry')
    if (industries.length > 0) filters.industry = industries

    const municipalities = url.searchParams.getAll('municipalityId').map(Number)
    if (municipalities.length > 0) filters.municipalityId = municipalities

    const sizeCategories = url.searchParams.getAll('sizeCategory')
    if (sizeCategories.length > 0) filters.sizeCategory = sizeCategories

    const revenueMin = url.searchParams.get('revenueMin')
    if (revenueMin) filters.revenueMin = parseFloat(revenueMin)

    const revenueMax = url.searchParams.get('revenueMax')
    if (revenueMax) filters.revenueMax = parseFloat(revenueMax)

    const growthMin = url.searchParams.get('growthMin')
    if (growthMin) filters.growthMin = parseFloat(growthMin)

    if (url.searchParams.get('isNew') === 'true') filters.isNew = true

    const q = url.searchParams.get('q')
    if (q) filters.q = q

    // Генерируем данные через ОБЩУЮ функцию
    const { cells, points, total } = generateMapCells(zoom, filters)

    // Переключаемся в режим points при zoom >= 11 ИЛИ total <= 1500
    if (points.length > 0) {
      const response: MapPointsResponse = {
        mode: 'points',
        total,
        points,
      }
      return HttpResponse.json(response)
    }

    // Режим cells
    const cellDeg = 84 / Math.pow(2, zoom)

    const response: MapCellsResponse = {
      mode: 'cells',
      cellDeg,
      total,
      cells,
    }
    return HttpResponse.json(response)
  }),

  // GET /api/companies - использует ОБЩУЮ функцию фильтрации
  http.get('/api/companies', ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '0', 10)
    const size = parseInt(url.searchParams.get('size') || '50', 10)
    const sort = url.searchParams.get('sort') || 'revenueEst,desc'

    // Парсим ВСЕ фильтры из URL (те же, что у карты)
    const filters: MockFilters = {
      client: url.searchParams.get('client') || 'all',
      status: url.searchParams.get('status') || 'active',
    }

    // bbox - ОБЯЗАТЕЛЬНО должен быть в запросе списка!
    const minLat = url.searchParams.get('minLat')
    const maxLat = url.searchParams.get('maxLat')
    const minLon = url.searchParams.get('minLon')
    const maxLon = url.searchParams.get('maxLon')

    if (minLat && maxLat && minLon && maxLon) {
      filters.bbox = {
        minLat: parseFloat(minLat),
        maxLat: parseFloat(maxLat),
        minLon: parseFloat(minLon),
        maxLon: parseFloat(maxLon),
      }
    }

    // Другие фильтры
    const industries = url.searchParams.getAll('industry')
    if (industries.length > 0) filters.industry = industries

    const municipalities = url.searchParams.getAll('municipalityId').map(Number)
    if (municipalities.length > 0) filters.municipalityId = municipalities

    const sizeCategories = url.searchParams.getAll('sizeCategory')
    if (sizeCategories.length > 0) filters.sizeCategory = sizeCategories

    const revenueMin = url.searchParams.get('revenueMin')
    if (revenueMin) filters.revenueMin = parseFloat(revenueMin)

    const revenueMax = url.searchParams.get('revenueMax')
    if (revenueMax) filters.revenueMax = parseFloat(revenueMax)

    const growthMin = url.searchParams.get('growthMin')
    if (growthMin) filters.growthMin = parseFloat(growthMin)

    if (url.searchParams.get('isNew') === 'true') filters.isNew = true

    const q = url.searchParams.get('q')
    if (q) filters.q = q

    // Фильтруем через ОБЩУЮ функцию - те же данные, что у карты!
    let items = filterCompanies(filters)
    const total = items.length

    // Сортировка
    const [sortField, sortDir] = sort.split(',')
    items.sort((a, b) => {
      let aVal: any = a[sortField as keyof CompanyShort]
      let bVal: any = b[sortField as keyof CompanyShort]

      // Обработка null значений
      if (aVal === null) aVal = sortDir === 'desc' ? -Infinity : Infinity
      if (bVal === null) bVal = sortDir === 'desc' ? -Infinity : Infinity

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    // Пагинация
    const start = page * size
    const end = start + size
    const pageItems = items.slice(start, end)

    const response: CompaniesResponse = {
      items: pageItems,
      page,
      size,
      total,
    }

    return HttpResponse.json(response)
  }),

  // GET /api/companies/{id}
  http.get('/api/companies/:id', ({ params }) => {
    const id = parseInt(params.id as string, 10)

    if (isNaN(id)) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Компания не найдена',
          },
        },
        { status: 404 }
      )
    }

    try {
      const company = getCompanyById(id)
      return HttpResponse.json(company)
    } catch {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Компания не найдена',
          },
        },
        { status: 404 }
      )
    }
  }),

  // GET /api/export/companies
  http.get('/api/export/companies', ({ request }) => {
    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'csv'

    // Парсим фильтры так же, как в /api/companies
    const filters: MockFilters = {
      client: url.searchParams.get('client') || 'all',
      status: url.searchParams.get('status') || 'active',
    }

    const minLat = url.searchParams.get('minLat')
    const maxLat = url.searchParams.get('maxLat')
    const minLon = url.searchParams.get('minLon')
    const maxLon = url.searchParams.get('maxLon')

    if (minLat && maxLat && minLon && maxLon) {
      filters.bbox = {
        minLat: parseFloat(minLat),
        maxLat: parseFloat(maxLat),
        minLon: parseFloat(minLon),
        maxLon: parseFloat(maxLon),
      }
    }

    const industries = url.searchParams.getAll('industry')
    if (industries.length > 0) filters.industry = industries

    const municipalities = url.searchParams.getAll('municipalityId').map(Number)
    if (municipalities.length > 0) filters.municipalityId = municipalities

    const sizeCategories = url.searchParams.getAll('sizeCategory')
    if (sizeCategories.length > 0) filters.sizeCategory = sizeCategories

    const revenueMin = url.searchParams.get('revenueMin')
    if (revenueMin) filters.revenueMin = parseFloat(revenueMin)

    const revenueMax = url.searchParams.get('revenueMax')
    if (revenueMax) filters.revenueMax = parseFloat(revenueMax)

    const growthMin = url.searchParams.get('growthMin')
    if (growthMin) filters.growthMin = parseFloat(growthMin)

    if (url.searchParams.get('isNew') === 'true') filters.isNew = true

    const q = url.searchParams.get('q')
    if (q) filters.q = q

    const companies = filterCompanies(filters)

    // Проверка лимита (максимум 10000 для экспорта)
    if (companies.length > 10000) {
      return HttpResponse.json(
        {
          error: {
            code: 'TOO_LARGE',
            message: 'Слишком много компаний для экспорта',
            details: { total: companies.length },
          },
        },
        { status: 413 }
      )
    }

    // Генерируем CSV с UTF-8 BOM и разделителем ;
    const BOM = '\uFEFF'
    const headers = [
      'ID',
      'ИНН',
      'Название',
      'Отрасль',
      'Муниципалитет',
      'Категория',
      'Выручка (руб)',
      'Рост выручки (%)',
      'Статус',
    ].join(';')

    const rows = companies.map((c) =>
      [
        c.id,
        c.inn,
        `"${c.name.replace(/"/g, '""')}"`, // Экранирование кавычек
        c.industryName,
        c.municipalityName,
        c.sizeCategory,
        c.revenueEst || '',
        c.revenueGrowthEst || '',
        c.status,
      ].join(';')
    )

    const csv = BOM + headers + '\n' + rows.join('\n')

    // Фиксированная дата для детерминированности
    const filename =
      format === 'bitrix'
        ? 'export_bitrix_2026-01-01.csv'
        : 'export_2026-01-01.csv'

    return new HttpResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  }),

  // GET /api/municipalities/stats
  http.get('/api/municipalities/stats', ({ request }) => {
    const url = new URL(request.url)
    const industry = url.searchParams.get('industry') || 'all'

    const stats = generateMunicipalityStats(industry)
    return HttpResponse.json(stats)
  }),

  // GET /api/white-spots
  http.get('/api/white-spots', ({ request }) => {
    const url = new URL(request.url)
    const industry = url.searchParams.get('industry') || 'all'
    const limit = parseInt(url.searchParams.get('limit') || '10', 10)

    const whiteSpots = generateWhiteSpots(industry, limit)
    return HttpResponse.json(whiteSpots)
  }),

  // ============ Продукт 2 - Навигатор ============

  // GET /api/projects
  http.get('/api/projects', ({ request }) => {
    const url = new URL(request.url)

    const filters: ProjectMockFilters = {
      stage: url.searchParams.getAll('stage'),
      industry: url.searchParams.getAll('industry'),
      need: url.searchParams.getAll('need'),
      municipalityId: url.searchParams.getAll('municipalityId').map(Number),
      yearFrom: url.searchParams.get('yearFrom') ? Number(url.searchParams.get('yearFrom')) : undefined,
      yearTo: url.searchParams.get('yearTo') ? Number(url.searchParams.get('yearTo')) : undefined,
      isKey: url.searchParams.get('isKey') === 'true',
      amountMin: url.searchParams.get('amountMin') ? Number(url.searchParams.get('amountMin')) : undefined,
      q: url.searchParams.get('q') || undefined,
    }

    const page = parseInt(url.searchParams.get('page') || '0', 10)
    const size = parseInt(url.searchParams.get('size') || '50', 10)
    const sort = url.searchParams.get('sort') || 'amountMln,desc'

    let filtered = filterProjects(filters)

    // Сортировка
    const [sortField, sortDir] = sort.split(',')
    const desc = sortDir === 'desc'
    filtered.sort((a, b) => {
      let aVal: any
      let bVal: any
      if (sortField === 'amountMln') {
        aVal = a.amountMln
        bVal = b.amountMln
      } else if (sortField === 'jobs') {
        aVal = a.jobs
        bVal = b.jobs
      } else if (sortField === 'startYear') {
        aVal = a.startYear
        bVal = b.startYear
      } else if (sortField === 'launchYear') {
        aVal = a.launchYear
        bVal = b.launchYear
      } else if (sortField === 'title') {
        aVal = a.title
        bVal = b.title
      } else {
        aVal = a.amountMln
        bVal = b.amountMln
      }

      if (aVal < bVal) return desc ? 1 : -1
      if (aVal > bVal) return desc ? -1 : 1
      return 0
    })

    const total = filtered.length
    const items = filtered.slice(page * size, (page + 1) * size)

    const response: ProjectsResponse = { items, page, size, total }
    return HttpResponse.json(response)
  }),

  // GET /api/projects/timeline — до /api/projects/:id, иначе MSW примет «timeline» за id
  http.get('/api/projects/timeline', ({ request }) => {
    const url = new URL(request.url)

    const filters: ProjectMockFilters = {
      stage: url.searchParams.getAll('stage'),
      industry: url.searchParams.getAll('industry'),
      need: url.searchParams.getAll('need'),
      municipalityId: url.searchParams.getAll('municipalityId').map(Number),
      yearFrom: url.searchParams.get('yearFrom') ? Number(url.searchParams.get('yearFrom')) : undefined,
      yearTo: url.searchParams.get('yearTo') ? Number(url.searchParams.get('yearTo')) : undefined,
      isKey: url.searchParams.get('isKey') === 'true',
      amountMin: url.searchParams.get('amountMin') ? Number(url.searchParams.get('amountMin')) : undefined,
      q: url.searchParams.get('q') || undefined,
    }

    const timeline = getProjectTimeline(filters)
    return HttpResponse.json(timeline)
  }),

  // GET /api/projects/:id
  http.get('/api/projects/:id', ({ params }) => {
    const id = Number(params.id)
    const project = getProjectById(id)

    if (!project) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Проект не найден' } },
        { status: 404 }
      )
    }

    const response: Project = project
    return HttpResponse.json(response)
  }),

  // GET /api/projects/:id/related-companies
  http.get('/api/projects/:id/related-companies', ({ params }) => {
    const response: ProjectRelatedCompaniesResponse | undefined = getProjectRelatedCompanies(Number(params.id))
    if (!response) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Проект не найден' } },
        { status: 404 }
      )
    }
    return HttpResponse.json(response)
  }),

  // GET /api/subscriptions
  http.get('/api/subscriptions', () => {
    const response: SubscriptionsResponse = getSubscriptions()
    return HttpResponse.json(response)
  }),

  // POST /api/subscriptions
  http.post('/api/subscriptions', async ({ request }) => {
    const body = (await request.json()) as {
      industry?: string
      municipalityId?: number
      need?: string
      stage?: string
    }

    // Валидация: хотя бы одно поле должно быть заполнено
    if (!body.industry && !body.municipalityId && !body.need && !body.stage) {
      return HttpResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Укажите хотя бы одно условие подписки' } },
        { status: 400 }
      )
    }

    const newSub = createSubscription(body)
    return HttpResponse.json(newSub, { status: 201 })
  }),

  // DELETE /api/subscriptions/:id
  http.delete('/api/subscriptions/:id', ({ params }) => {
    const id = Number(params.id)
    deleteSubscription(id)
    return new HttpResponse(null, { status: 204 })
  }),

  // GET /api/notifications
  http.get('/api/notifications', () => {
    const result = getNotifications()
    const response: NotificationsResponse = result
    return HttpResponse.json(response)
  }),

  // POST /api/notifications/:id/read
  http.post('/api/notifications/:id/read', ({ params }) => {
    const id = Number(params.id)
    markNotificationRead(id)
    return new HttpResponse(null, { status: 204 })
  }),

  // POST /api/notifications/read-all
  http.post('/api/notifications/read-all', () => {
    markAllNotificationsRead()
    return new HttpResponse(null, { status: 204 })
  }),

  // GET /api/notifications/telegram-link
  http.get('/api/notifications/telegram-link', () => {
    const response: TelegramLinkResponse = telegramLinkExample as TelegramLinkResponse
    return HttpResponse.json(response)
  }),

]
