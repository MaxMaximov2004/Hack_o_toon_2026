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
  SubscriptionInput,
  LocationInput,
  ImportMode,
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
  getCompanyLocations,
  addCompanyLocation,
  deleteCompanyLocation,
  importClientsCsv,
  importLocationsCsv,
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

function isAdminRequest(request: Request): boolean {
  return (request.headers.get('Authorization') ?? '').startsWith('Bearer mock-access-token-admin-')
}

function notFound(message: string) {
  return HttpResponse.json({ error: { code: 'NOT_FOUND', message } }, { status: 404 })
}

function validation(field: string, message: string) {
  return HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message, details: { field } } }, { status: 400 })
}

function forbidden() {
  return HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Нужна роль admin' } }, { status: 403 })
}

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
        // Роль зашита в моковый токен: дальше по нему отличаем админа (verify, /me, импорт)
        mfaToken: `mock-mfa-token-${body.email === 'admin@rt.ru' ? 'admin-' : ''}${Date.now()}`,
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

    // Принимаем любой 6-значный код, кроме 000000 — им проверяем «Неверный код»
    if (/^\d{6}$/.test(body.code) && body.code !== '000000') {
      const isAdmin = body.mfaToken.includes('admin')
      const token = `mock-access-token-${isAdmin ? 'admin-' : ''}${Date.now()}`
      validTokens.add(token)
      const user = isAdmin ? ADMIN_USER : DEMO_USER

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
      return HttpResponse.json(token.includes('admin') ? ADMIN_USER : DEMO_USER)
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
      relocated: url.searchParams.get('relocated') === 'true',
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
      relocated: url.searchParams.get('relocated') === 'true',
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

  // ============ «Где работает» и импорт CSV (ТЗ 07) ============

  // GET /api/companies/:id/locations
  http.get('/api/companies/:id/locations', ({ params }) => {
    const result = getCompanyLocations(Number(params.id))
    if (!result) return notFound('Компания не найдена')
    return HttpResponse.json(result)
  }),

  // POST /api/companies/:id/locations — 201 ActualLocation
  http.post('/api/companies/:id/locations', async ({ params, request }) => {
    const result = addCompanyLocation(Number(params.id), (await request.json()) as LocationInput)
    if (!result.ok) {
      return result.status === 404 ? notFound(result.message) : validation(result.field ?? 'municipalityName', result.message)
    }
    return HttpResponse.json(result.location, { status: 201 })
  }),

  // DELETE /api/companies/:id/locations/:locationId — 204; чужое (не manager) — 403
  http.delete('/api/companies/:id/locations/:locationId', ({ params }) => {
    const status = deleteCompanyLocation(Number(params.id), Number(params.locationId))
    if (status === 404) return notFound('Место не найдено')
    if (status === 403) {
      return HttpResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Менеджер может удалить только место, введённое вручную' } },
        { status: 403 }
      )
    }
    return new HttpResponse(null, { status: 204 })
  }),

  // POST /api/clients/import (admin) — multipart: file, mode
  http.post('/api/clients/import', async ({ request }) => {
    if (!isAdminRequest(request)) return forbidden()
    const form = await request.formData()
    const file = form.get('file')
    const mode = String(form.get('mode') || 'append') as ImportMode
    if (!(file instanceof File)) return validation('file', 'Не выбран файл')
    if (mode !== 'append' && mode !== 'replace') return validation('mode', 'mode: append или replace')
    if (file.size > 10 * 1024 * 1024) {
      return HttpResponse.json({ error: { code: 'TOO_LARGE', message: 'Файл больше 10 МБ' } }, { status: 413 })
    }
    return HttpResponse.json(importClientsCsv(await file.text(), mode))
  }),

  // POST /api/locations/import (admin) — multipart: file
  http.post('/api/locations/import', async ({ request }) => {
    if (!isAdminRequest(request)) return forbidden()
    const file = (await request.formData()).get('file')
    if (!(file instanceof File)) return validation('file', 'Не выбран файл')
    return HttpResponse.json(importLocationsCsv(await file.text()))
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
      relocated: url.searchParams.get('relocated') === 'true',
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

  // POST /api/subscriptions — 201 или 400 VALIDATION_ERROR (как notifier)
  http.post('/api/subscriptions', async ({ request }) => {
    const result = createSubscription((await request.json()) as SubscriptionInput)
    if (!result.ok) {
      return HttpResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: result.message, details: { field: result.field } } },
        { status: 400 }
      )
    }
    return HttpResponse.json(result.subscription, { status: 201 })
  }),

  // DELETE /api/subscriptions/:id — 204, нет такой → 404
  http.delete('/api/subscriptions/:id', ({ params }) => {
    if (!deleteSubscription(Number(params.id))) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Подписка не найдена' } },
        { status: 404 }
      )
    }
    return new HttpResponse(null, { status: 204 })
  }),

  // GET /api/notifications?unread=true
  http.get('/api/notifications', ({ request }) => {
    const unreadOnly = new URL(request.url).searchParams.get('unread') === 'true'
    const response: NotificationsResponse = getNotifications(unreadOnly)
    return HttpResponse.json(response)
  }),

  // POST /api/notifications/read-all
  http.post('/api/notifications/read-all', () => {
    markAllNotificationsRead()
    return new HttpResponse(null, { status: 204 })
  }),

  // POST /api/notifications/:id/read
  http.post('/api/notifications/:id/read', ({ params }) => {
    if (!markNotificationRead(Number(params.id))) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Уведомление не найдено' } },
        { status: 404 }
      )
    }
    return new HttpResponse(null, { status: 204 })
  }),

  // GET /api/notifications/telegram-link
  http.get('/api/notifications/telegram-link', () => {
    const response: TelegramLinkResponse = telegramLinkExample as TelegramLinkResponse
    return HttpResponse.json(response)
  }),

]
