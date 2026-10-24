import type {
  Dictionaries,
  MapCell,
  MapPoint,
  CompanyShort,
  Company as ApiCompany,
  ProjectShort,
  ProjectRelatedCompany,
  ProjectRelatedCompaniesResponse,
  TimelineResponse,
  Subscription,
  SubscriptionInput,
  Notification,
  CompanyLocations,
  ActualLocation,
  LocationInput,
  ImportClientsResponse,
  ImportMode,
  LocationImportResponse,
  NotificationsResponse,
} from '../api/types'
import projectsFixture from './fixtures/projects.json'
import subscriptionsExample from '../../../contracts/examples/subscriptions.json'

// Справочники с реальными данными Ростовской области
export const mockDictionaries: Dictionaries = {
  industries: [
    { code: 'agro', name: 'Сельское хозяйство' },
    { code: 'energy', name: 'Энергетика' },
    { code: 'manufacturing', name: 'Производство' },
    { code: 'construction', name: 'Строительство' },
    { code: 'trade', name: 'Торговля' },
    { code: 'logistics', name: 'Логистика' },
    { code: 'hospitality', name: 'Гостиничный бизнес' },
    { code: 'it', name: 'ИТ' },
    { code: 'realestate', name: 'Недвижимость' },
    { code: 'services', name: 'Услуги' },
    { code: 'other', name: 'Прочее' },
  ],

  municipalities: [
    // Города (ИСПРАВЛЕННЫЕ координаты)
    { id: 1, name: 'Ростов-на-Дону', kind: 'city', lat: 47.2357, lon: 39.7015 },
    { id: 2, name: 'Таганрог', kind: 'city', lat: 47.2362, lon: 38.8969 },
    { id: 3, name: 'Шахты', kind: 'city', lat: 47.7085, lon: 40.2160 },
    { id: 4, name: 'Новочеркасск', kind: 'city', lat: 47.4220, lon: 40.0939 },
    { id: 5, name: 'Волгодонск', kind: 'city', lat: 47.5136, lon: 42.1514 },
    { id: 6, name: 'Азов', kind: 'city', lat: 47.1121, lon: 39.4232 },
    { id: 7, name: 'Батайск', kind: 'city', lat: 47.1383, lon: 39.7507 },
    { id: 8, name: 'Новошахтинск', kind: 'city', lat: 47.7579, lon: 39.9364 },
    { id: 9, name: 'Сальск', kind: 'city', lat: 46.4752, lon: 41.5416 },
    { id: 10, name: 'Каменск-Шахтинский', kind: 'city', lat: 48.3178, lon: 40.2595 },
    { id: 11, name: 'Белая Калитва', kind: 'city', lat: 48.1769, lon: 40.7894 },
    { id: 12, name: 'Миллерово', kind: 'city', lat: 48.9226, lon: 40.3984 },

    // Районы
    { id: 21, name: 'Аксайский район', kind: 'district', lat: 47.2667, lon: 39.8667 },
    { id: 22, name: 'Азовский район', kind: 'district', lat: 47.1167, lon: 39.4167 },
  ],

  sizeCategories: [
    { code: 'micro', name: 'Микропредприятие' },
    { code: 'small', name: 'Малое' },
    { code: 'medium', name: 'Среднее' },
  ],

  stages: [
    { code: 'design', name: 'Проектирование' },
    { code: 'construction', name: 'Строительство' },
    { code: 'launch', name: 'Запуск' },
  ],

  needs: [
    { code: 'it_infra', name: 'ИТ-инфраструктура и связь' },
    { code: 'apcs', name: 'АСУ ТП и промышленный интернет вещей' },
    { code: 'phys_security', name: 'Физическая безопасность' },
    { code: 'info_security', name: 'Информационная безопасность' },
  ],
}

// Города с количеством компаний
const CITIES = [
  { name: 'Ростов-на-Дону', lat: 47.2357, lon: 39.7015, companies: 2500, oursRatio: 0.18 },
  { name: 'Таганрог', lat: 47.2362, lon: 38.8969, companies: 450, oursRatio: 0.15 },
  { name: 'Шахты', lat: 47.7085, lon: 40.2160, companies: 380, oursRatio: 0.14 },
  { name: 'Новочеркасск', lat: 47.4220, lon: 40.0939, companies: 320, oursRatio: 0.16 },
  { name: 'Батайск', lat: 47.1383, lon: 39.7507, companies: 280, oursRatio: 0.15 },
  { name: 'Волгодонск', lat: 47.5136, lon: 42.1514, companies: 250, oursRatio: 0.13 },
  { name: 'Азов', lat: 47.1121, lon: 39.4232, companies: 180, oursRatio: 0.12 },
  { name: 'Новошахтинск', lat: 47.7579, lon: 39.9364, companies: 150, oursRatio: 0.11 },
  { name: 'Каменск-Шахтинский', lat: 48.3178, lon: 40.2595, companies: 140, oursRatio: 0.10 },
  { name: 'Сальск', lat: 46.4752, lon: 41.5416, companies: 120, oursRatio: 0.09 },
  { name: 'Белая Калитва', lat: 48.1769, lon: 40.7894, companies: 100, oursRatio: 0.08 },
  { name: 'Миллерово', lat: 48.9226, lon: 40.3984, companies: 80, oursRatio: 0.07 },
]

// Названия компаний для генерации
const COMPANY_NAMES = [
  'ООО "Ростовский торговый дом"',
  'ИП Иванов А.В.',
  'ООО "Азовское предприятие"',
  'ООО "Южная логистика"',
  'ООО "ДонСтрой"',
  'ООО "РостовПродукт"',
  'ИП Петров С.И.',
  'ООО "ТехноСервис"',
  'ООО "ДонТранс"',
  'ООО "Южный ветер"',
]

// Простой генератор псевдослучайных чисел с seed
class SeededRandom {
  private seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }
}

// Генерируем ОДИН РАЗ все компании с полными данными (CompanyShort)
let allCompanies: CompanyShort[] | null = null

export function getAllCompanies(): CompanyShort[] {
  if (allCompanies) return allCompanies

  const companies: CompanyShort[] = []
  let id = 1
  const rng = new SeededRandom(12345) // Фиксированный seed для воспроизводимости

  CITIES.forEach((city) => {
    const totalCompanies = city.companies
    const oursCount = Math.floor(totalCompanies * city.oursRatio)
    const othersCount = totalCompanies - oursCount

    // Из наших клиентов ~15% будут исключены из реестра МСП
    const excludedCount = Math.floor(oursCount * 0.15)
    const activeOursCount = oursCount - excludedCount

    // Генерируем "наши активные" компании
    for (let i = 0; i < activeOursCount; i++) {
      const lat = city.lat + rng.range(-0.02, 0.02)
      const lon = city.lon + rng.range(-0.02, 0.02)
      companies.push(createCompanyShort(id++, 'ours', lat, lon, city.name, rng))
    }

    // Генерируем "исключённые" компании (наши клиенты, но исключены из реестра)
    for (let i = 0; i < excludedCount; i++) {
      const lat = city.lat + rng.range(-0.02, 0.02)
      const lon = city.lon + rng.range(-0.02, 0.02)
      companies.push(createCompanyShort(id++, 'excluded', lat, lon, city.name, rng))
    }

    // Генерируем "не наши" компании
    for (let i = 0; i < othersCount; i++) {
      const lat = city.lat + rng.range(-0.02, 0.02)
      const lon = city.lon + rng.range(-0.02, 0.02)
      companies.push(createCompanyShort(id++, 'others', lat, lon, city.name, rng))
    }
  })

  allCompanies = companies
  return companies
}

function createCompanyShort(
  id: number,
  kind: 'ours' | 'others' | 'excluded',
  lat: number,
  lon: number,
  cityName: string,
  rng: SeededRandom
): CompanyShort {
  const industry = mockDictionaries.industries[Math.floor(rng.next() * mockDictionaries.industries.length)]
  const municipality = mockDictionaries.municipalities.find(m => m.name === cityName) || mockDictionaries.municipalities[0]
  const sizeCategory = mockDictionaries.sizeCategories[Math.floor(rng.next() * 3)]

  // Исключённые компании — это НАШИ клиенты, но исключённые из реестра МСП
  const isClient = kind === 'ours' || kind === 'excluded'
  const status: 'active' | 'excluded' = kind === 'excluded' ? 'excluded' : 'active'
  const isEstimated = rng.next() > 0.3
  const isNew = rng.next() > 0.9

  return {
    id,
    inn: String(6100000000 + id).padStart(12, '0'),
    name: COMPANY_NAMES[id % COMPANY_NAMES.length] + ` №${id}`,
    industry: industry.code,
    industryName: industry.name,
    okvedCode: '47.11',
    okvedName: 'Торговля розничная преимущественно пищевыми продуктами',
    municipalityId: municipality.id,
    municipalityName: municipality.name,
    settlement: rng.next() > 0.5 ? 'пос. Южный' : null,
    lat,
    lon,
    sizeCategory: sizeCategory.code as 'micro' | 'small' | 'medium',
    employees: Math.floor(rng.range(5, 200)),
    revenueEst: Math.floor(rng.range(1_000_000, 100_000_000)),
    revenueGrowthEst: rng.next() > 0.5 ? Math.floor(rng.range(-10, 50)) : null,
    revenueSource: isEstimated ? 'model' : 'fns',
    isEstimated,
    isClient,
    status,
    kind,
    excludedAt: kind === 'excluded' ? '2025-09-15T00:00:00Z' : null,
    isNew,
    registeredAt: `202${Math.floor(rng.range(0, 5))}-01-01T00:00:00Z`,
    relocated: false,
  }
}

// ОБЩАЯ функция фильтрации для всех хендлеров
export interface MockFilters {
  client?: string
  status?: string
  bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number }
  industry?: string[]
  municipalityId?: number[]
  sizeCategory?: string[]
  revenueMin?: number
  revenueMax?: number
  growthMin?: number
  isNew?: boolean
  q?: string
  relocated?: boolean
}

export function filterCompanies(filters: MockFilters): CompanyShort[] {
  let companies = getAllCompanies()

  // Фильтр по client и status вместе
  if (filters.client === 'ours') {
    companies = companies.filter((c) => c.isClient)
    // Дополнительно фильтруем по status
    if (filters.status === 'active') {
      companies = companies.filter((c) => c.status === 'active')
    } else if (filters.status === 'excluded') {
      companies = companies.filter((c) => c.status === 'excluded')
    }
  } else if (filters.client === 'others') {
    companies = companies.filter((c) => !c.isClient && c.status === 'active')
  } else {
    // client === 'all'
    if (filters.status === 'active') {
      companies = companies.filter((c) => c.status === 'active')
    } else if (filters.status === 'excluded') {
      companies = companies.filter((c) => c.status === 'excluded')
    } else {
      // status === 'all' - показываем всё
    }
  }

  // Фильтр по bbox
  if (filters.bbox) {
    const { minLat, maxLat, minLon, maxLon } = filters.bbox
    companies = companies.filter(
      (c) => c.lat >= minLat && c.lat <= maxLat && c.lon >= minLon && c.lon <= maxLon
    )
  }

  // Фильтр по отрасли
  if (filters.industry && filters.industry.length > 0) {
    companies = companies.filter((c) => filters.industry!.includes(c.industry))
  }

  // Фильтр по району
  if (filters.municipalityId && filters.municipalityId.length > 0) {
    companies = companies.filter((c) => filters.municipalityId!.includes(c.municipalityId))
  }

  // Фильтр по размеру
  if (filters.sizeCategory && filters.sizeCategory.length > 0) {
    companies = companies.filter((c) => filters.sizeCategory!.includes(c.sizeCategory))
  }

  // Фильтр по выручке
  if (filters.revenueMin !== undefined && filters.revenueMin !== null) {
    companies = companies.filter((c) => c.revenueEst !== null && c.revenueEst >= filters.revenueMin!)
  }
  if (filters.revenueMax !== undefined && filters.revenueMax !== null) {
    companies = companies.filter((c) => c.revenueEst !== null && c.revenueEst <= filters.revenueMax!)
  }

  // Фильтр по росту
  if (filters.growthMin !== undefined && filters.growthMin !== null) {
    companies = companies.filter(
      (c) => c.revenueGrowthEst !== null && c.revenueGrowthEst >= filters.growthMin!
    )
  }

  // «Работает не там, где зарегистрирован»
  if (filters.relocated) {
    companies = companies.filter((c) => c.relocated)
  }

  // Фильтр по новизне
  if (filters.isNew) {
    companies = companies.filter((c) => c.isNew)
  }

  // Фильтр по поиску
  if (filters.q && filters.q.length >= 2) {
    const query = filters.q.toLowerCase()
    companies = companies.filter(
      (c) => c.name.toLowerCase().includes(query) || c.inn.startsWith(query)
    )
  }

  return companies
}

// Генерация кластеров из отфильтрованных компаний
export function generateMapCells(
  zoom: number,
  filters: MockFilters
): { cells: MapCell[]; points: MapPoint[]; total: number } {
  const filtered = filterCompanies(filters)
  const total = filtered.length

  // Если zoom >= 11 ИЛИ компаний мало (≤ 1500), возвращаем точки
  if (zoom >= 11 || total <= 1500) {
    const points: MapPoint[] = filtered.map((c) => ({
      id: c.id,
      lat: c.lat,
      lon: c.lon,
      kind: c.kind,
    }))
    return { cells: [], points, total }
  }

  // Группируем в кластеры
  const cellDeg = 84 / Math.pow(2, zoom)

  // Группируем компании по ячейкам
  const cellMap = new Map<string, CompanyShort[]>()

  filtered.forEach((company) => {
    const cellLat = Math.floor(company.lat / cellDeg)
    const cellLon = Math.floor(company.lon / cellDeg)
    const key = `${cellLat},${cellLon}`

    if (!cellMap.has(key)) {
      cellMap.set(key, [])
    }
    cellMap.get(key)!.push(company)
  })

  // Создаём кластеры - центр = среднее lat/lon компаний в ячейке
  const cells: MapCell[] = []

  cellMap.forEach((companies) => {
    const avgLat = companies.reduce((sum, c) => sum + c.lat, 0) / companies.length
    const avgLon = companies.reduce((sum, c) => sum + c.lon, 0) / companies.length

    const ours = companies.filter((c) => c.kind === 'ours').length
    const others = companies.filter((c) => c.kind === 'others').length
    const excluded = companies.filter((c) => c.kind === 'excluded').length

    cells.push({
      lat: avgLat,
      lon: avgLon,
      total: companies.length,
      ours,
      others,
      excluded,
    })
  })

  return { cells, points: [], total }
}

// Получение детальной компании по ID
export function getCompanyById(id: number): ApiCompany {
  const company = getAllCompanies().find((c) => c.id === id) ?? findRelatedSyntheticCompany(id)

  if (!company) {
    throw new Error(`Company ${id} not found`)
  }

  const rng = new SeededRandom(id + 1000)

  return {
    ...company,
    ogrn: String(1026100000000 + id),
    subjectType: rng.next() > 0.3 ? 'legal' : 'ip',
    phone: rng.next() > 0.2 ? '+7 (863) 123-45-67' : null,
    email: rng.next() > 0.3 ? `company${id}@example.com` : null,
    website: rng.next() > 0.5 ? `https://company${id}.ru` : null,
    hasLicenses: rng.next() > 0.7,
    isInnovative: rng.next() > 0.85,
    isSocial: rng.next() > 0.9,
  }
}

// Генерация статистики по районам
export function generateMunicipalityStats(industryFilter: string) {
  const allComps = getAllCompanies()
  const rng = new SeededRandom(54321)

  return mockDictionaries.municipalities.map((muni) => {
    // Фильтруем компании этого района
    let muniCompanies = allComps.filter((c) => c.municipalityId === muni.id)

    // Если указана отрасль и это не 'all', фильтруем по отрасли
    if (industryFilter !== 'all') {
      muniCompanies = muniCompanies.filter((c) => c.industry === industryFilter)
    }

    const companies = muniCompanies.filter((c) => c.status === 'active').length
    const clients = muniCompanies.filter((c) => c.isClient && c.status === 'active').length
    const excludedClients = muniCompanies.filter((c) => c.isClient && c.status === 'excluded').length
    const coverage = companies > 0 ? (clients / companies) * 100 : 0
    const newCompanies = muniCompanies.filter((c) => c.isNew).length
    const newShare = companies > 0 ? (newCompanies / companies) * 100 : 0
    const revenueEstSum = muniCompanies.reduce((sum, c) => sum + (c.revenueEst || 0), 0)

    // Потенциал: от 0 до 100, зависит от количества компаний, охвата и выручки
    const basePotential = Math.min(100, companies / 10) // Больше компаний = больше потенциал
    const coverageFactor = 100 - coverage // Меньше охват = больше потенциал
    const potentialScore = Math.min(100, Math.max(0, (basePotential + coverageFactor) / 2 + rng.range(-10, 10)))

    // Белое пятно: потенциал > 60 и охват < 15%
    const isWhiteSpot = potentialScore > 60 && coverage < 15
    const reason = isWhiteSpot
      ? `Низкий охват (${coverage.toFixed(1)}%), ${companies} потенциальных клиентов`
      : ''

    return {
      municipalityId: muni.id,
      name: muni.name,
      kind: muni.kind,
      lat: muni.lat,
      lon: muni.lon,
      industry: industryFilter,
      companies,
      clients,
      excludedClients,
      coverage: coverage / 100, // в контракте — доля 0..1 (stats.json: 0.0044)
      newShare,
      revenueEstSum,
      potentialScore: Math.round(potentialScore),
      isWhiteSpot,
      reason,
    }
  })
}

// Генерация белых пятен
export function generateWhiteSpots(industryFilter: string, limit: number) {
  const stats = generateMunicipalityStats(industryFilter)

  // Фильтруем белые пятна и сортируем по потенциалу
  const whiteSpots = stats
    .filter((s) => s.isWhiteSpot)
    .sort((a, b) => b.potentialScore - a.potentialScore)
    .slice(0, limit)
    .map((s) => ({
      municipalityId: s.municipalityId,
      name: s.name,
      lat: s.lat,
      lon: s.lon,
      potentialScore: s.potentialScore,
      companies: s.companies,
      clients: s.clients,
      reason: s.reason,
    }))

  return whiteSpots
}

// Продукт 2 - Проекты
// Базовые данные проектов из fixtures/projects.json (сгенерировано из SQL)
export const mockProjects: ProjectShort[] = projectsFixture as ProjectShort[]

export function getAllProjects(): ProjectShort[] {
  return mockProjects
}

export function getProjectById(id: number): ProjectShort | undefined {
  return mockProjects.find((p) => p.id === id)
}

// Фильтрация проектов
export interface ProjectMockFilters {
  stage?: string[]
  industry?: string[]
  need?: string[]
  municipalityId?: number[]
  yearFrom?: number
  yearTo?: number
  isKey?: boolean
  amountMin?: number
  q?: string
}

export function filterProjects(filters: ProjectMockFilters): ProjectShort[] {
  let result = [...mockProjects]

  if (filters.stage && filters.stage.length > 0) {
    result = result.filter((p) => filters.stage!.includes(p.stage))
  }

  if (filters.industry && filters.industry.length > 0) {
    result = result.filter((p) => p.industry !== null && filters.industry!.includes(p.industry))
  }

  if (filters.need && filters.need.length > 0) {
    result = result.filter((p) => p.needs.some((n) => filters.need!.includes(n)))
  }

  if (filters.municipalityId && filters.municipalityId.length > 0) {
    result = result.filter((p) => filters.municipalityId!.includes(p.municipalityId))
  }

  if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
    const yearFrom = filters.yearFrom || 0
    const yearTo = filters.yearTo || 9999
    // Как ProjectFilterSql: проект идёт в эти годы; пустой год условию не мешает
    result = result.filter(
      (p) => (p.startYear === null || p.startYear <= yearTo) && (p.launchYear === null || p.launchYear >= yearFrom)
    )
  }

  if (filters.isKey) {
    result = result.filter((p) => p.isKey)
  }

  if (filters.amountMin !== undefined) {
    result = result.filter((p) => p.amountMln !== null && p.amountMln >= filters.amountMin!)
  }

  if (filters.q && filters.q.length >= 2) {
    const query = filters.q.toLowerCase()
    result = result.filter(
      (p) => p.title.toLowerCase().includes(query) || p.initiator.toLowerCase().includes(query)
    )
  }

  return result
}

// Таймлайн
export function getProjectTimeline(filters: ProjectMockFilters): TimelineResponse {
  const filtered = filterProjects(filters)

  if (filtered.length === 0) {
    return {
      minYear: 2020,
      maxYear: 2030,
      total: 0,
      years: [],
    }
  }

  // Собираем все события (старты и запуски)
  const events: { year: number; type: 'start' | 'launch'; projectId: number; title: string }[] = []

  // Как Timeline.java: событие есть, если год известен; при yearFrom/yearTo — только внутри периода
  const inPeriod = (year: number) =>
    (filters.yearFrom === undefined || year >= filters.yearFrom) &&
    (filters.yearTo === undefined || year <= filters.yearTo)
  filtered.forEach((project) => {
    if (project.startYear !== null && inPeriod(project.startYear)) {
      events.push({ year: project.startYear, type: 'start', projectId: project.id, title: project.title })
    }
    if (project.launchYear !== null && inPeriod(project.launchYear)) {
      events.push({ year: project.launchYear, type: 'launch', projectId: project.id, title: project.title })
    }
  })

  // Группируем по годам
  const yearMap = new Map<number, typeof events>()
  events.forEach((event) => {
    if (!yearMap.has(event.year)) {
      yearMap.set(event.year, [])
    }
    yearMap.get(event.year)!.push(event)
  })

  // Формируем years
  const years = Array.from(yearMap.entries())
    .map(([year, yearEvents]) => ({
      year,
      events: yearEvents.map((e) => {
        const project = filtered.find((p) => p.id === e.projectId)!
        return {
          projectId: e.projectId,
          title: e.title,
          type: e.type,
          municipalityId: project.municipalityId,
          municipalityName: project.municipalityName,
          stage: project.stage,
          amountMln: project.amountMln,
        }
      }),
    }))
    .sort((a, b) => a.year - b.year)

  const minYear = years.length > 0 ? years[0].year : null
  const maxYear = years.length > 0 ? years[years.length - 1].year : null

  return {
    minYear,
    maxYear,
    total: filtered.length,
    years,
  }
}

// Компании вокруг проекта (GET /api/projects/:id/related-companies)
//
// Моковые компании радара есть только в городах, а проекты — ещё и в районах. Поэтому: если в районе
// проекта есть компании той же отрасли — берём их (клик откроет ту же карточку, что в радаре), иначе
// досоздаём синтетические тем же SeededRandom. Синтетические id = RELATED_ID_BASE + projectId * 100 + n,
// по id однозначно восстанавливается проект, так что GET /api/companies/:id их тоже находит.
// Инициатор «находится в реестре» примерно у 60% проектов (на реальных данных 38 из 63) и никогда не клиент.
const RELATED_ID_BASE = 1_000_000
const RELATED_LIMIT = 20

function syntheticRelatedCompany(
  project: ProjectShort,
  n: number,
  kind: 'ours' | 'others',
  rng: SeededRandom
): CompanyShort {
  const lat = project.lat + rng.range(-0.03, 0.03)
  const lon = project.lon + rng.range(-0.03, 0.03)
  const base = createCompanyShort(RELATED_ID_BASE + project.id * 100 + n, kind, lat, lon, '', rng)
  return {
    ...base,
    industry: project.industry ?? 'other',
    industryName: project.industryName ?? 'Прочее',
    municipalityId: project.municipalityId,
    municipalityName: project.municipalityName,
    settlement: null,
  }
}

export function getProjectRelatedCompanies(projectId: number): ProjectRelatedCompaniesResponse | undefined {
  const project = getProjectById(projectId)
  if (!project) return undefined

  const rng = new SeededRandom(projectId + 7000)
  const items: ProjectRelatedCompany[] = []

  if (rng.next() < 0.6) {
    const initiator = syntheticRelatedCompany(project, 0, 'others', rng)
    items.push({ ...initiator, name: project.initiator, relation: 'initiator' })
  }

  let pool = getAllCompanies().filter(
    (c) =>
      c.industry === project.industry &&
      c.municipalityId === project.municipalityId &&
      c.status === 'active'
  )
  if (pool.length === 0) {
    const count = Math.floor(rng.range(3, 15))
    pool = Array.from({ length: count }, (_, i) =>
      syntheticRelatedCompany(project, i + 1, rng.next() < 0.2 ? 'ours' : 'others', rng)
    )
  }

  // Сначала не клиенты (потенциальные), затем клиенты; внутри — по выручке убыв.
  const sorted = [...pool].sort(
    (a, b) => Number(a.isClient) - Number(b.isClient) || (b.revenueEst ?? 0) - (a.revenueEst ?? 0)
  )
  sorted.slice(0, RELATED_LIMIT).forEach((c) => items.push({ ...c, relation: 'same_area_industry' }))

  return {
    projectId,
    items,
    sameAreaIndustryTotal: pool.length,
    radarQuery: `industry=${project.industry}&municipalityId=${project.municipalityId}`,
  }
}

function findRelatedSyntheticCompany(id: number): CompanyShort | undefined {
  if (id < RELATED_ID_BASE) return undefined
  const projectId = Math.floor((id - RELATED_ID_BASE) / 100)
  const found = getProjectRelatedCompanies(projectId)?.items.find((c) => c.id === id)
  if (!found) return undefined
  const company: CompanyShort & { relation?: unknown } = { ...found }
  delete company.relation
  return company
}

// Группировка проектов по районам для карты

// Подписки и уведомления (notifier). Формы — contracts/examples/subscriptions.json и notifications.json.
// Подписки стартуют с примера контракта; ленту уведомлений строим тем же SeededRandom по проектам фикстуры,
// чтобы клик по уведомлению открывал существующую карточку проекта.

export type MockSubscriptionResult =
  | { ok: true; subscription: Subscription }
  | { ok: false; field: string; message: string }

// В настоящем справочнике г. Ростов-на-Дону — id 53 (так в примере контракта), в моковом — id 1
const EXAMPLE_TO_MOCK_MUNICIPALITY: Record<number, number> = { 53: 1 }

function exampleSubscriptions(): Subscription[] {
  return subscriptionsExample.map((sub) => ({
    ...sub,
    municipalityId:
      sub.municipalityId === null ? null : EXAMPLE_TO_MOCK_MUNICIPALITY[sub.municipalityId] ?? sub.municipalityId,
    stage: sub.stage as Subscription['stage'],
  }))
}

let subscriptions: Subscription[] = exampleSubscriptions()
let nextSubscriptionId = Math.max(...subscriptions.map((s) => s.id), 0) + 1

export function getSubscriptions(): Subscription[] {
  return subscriptions
}

/** Валидация как в notifier: хотя бы одно поле, известные коды; иначе 400 VALIDATION_ERROR */
export function createSubscription(data: SubscriptionInput): MockSubscriptionResult {
  if (!data.industry && !data.municipalityId && !data.need && !data.stage) {
    return { ok: false, field: 'industry', message: 'Укажите хотя бы одно условие подписки' }
  }
  if (data.industry && !mockDictionaries.industries.some((i) => i.code === data.industry)) {
    return { ok: false, field: 'industry', message: `Неизвестная отрасль: ${data.industry}` }
  }
  if (data.need && !mockDictionaries.needs.some((n) => n.code === data.need)) {
    return { ok: false, field: 'need', message: `Неизвестная потребность: ${data.need}` }
  }
  if (data.stage && !mockDictionaries.stages.some((st) => st.code === data.stage)) {
    return { ok: false, field: 'stage', message: `Неизвестная стадия: ${data.stage}` }
  }

  const subscription: Subscription = {
    id: nextSubscriptionId++,
    industry: data.industry ?? null,
    municipalityId: data.municipalityId ?? null,
    need: data.need ?? null,
    stage: data.stage ?? null,
    createdAt: new Date().toISOString(),
  }
  subscriptions = [subscription, ...subscriptions]
  simulateNewProjectFor(subscription)
  return { ok: true, subscription }
}

export function deleteSubscription(id: number): boolean {
  const before = subscriptions.length
  subscriptions = subscriptions.filter((s) => s.id !== id)
  return subscriptions.length < before
}

function projectMatches(project: ProjectShort, sub: Subscription): boolean {
  return (
    (sub.industry === null || project.industry === sub.industry) &&
    (sub.municipalityId === null || project.municipalityId === sub.municipalityId) &&
    (sub.need === null || project.needs.includes(sub.need)) &&
    (sub.stage === null || project.stage === sub.stage)
  )
}

function notificationFor(project: ProjectShort, id: number, sub: Subscription | null, createdAt: Date): Notification {
  return {
    id,
    projectId: project.id,
    title: project.title,
    municipalityName: project.municipalityName,
    subscriptionId: sub?.id ?? null,
    isRead: false,
    sentToTelegram: false,
    createdAt: createdAt.toISOString(),
  }
}

/** Стартовая лента: 6 проектов фикстуры (seeded), новые сверху, непрочитано два самых свежих */
export function buildMockNotifications(now: Date = new Date()): Notification[] {
  const rng = new SeededRandom(2026)
  const projects = getAllProjects()
  const picked = new Set<number>()
  while (picked.size < Math.min(6, projects.length)) {
    picked.add(projects[Math.floor(rng.next() * projects.length)].id)
  }

  let minutesAgo = 0
  return [...picked].map((projectId, i) => {
    minutesAgo += Math.floor(rng.range(5, 600))
    const project = getProjectById(projectId)!
    const sub = subscriptions.find((s) => projectMatches(project, s)) ?? null
    const notification = notificationFor(project, 100 - i, sub, new Date(now.getTime() - minutesAgo * 60_000))
    notification.isRead = i >= 2
    notification.sentToTelegram = rng.next() > 0.5
    return notification
  })
}

let notifications: Notification[] = buildMockNotifications()
let nextNotificationId = 101

/**
 * Вместо `etl demo-project` на моках: новая подписка сразу получает уведомление о самом свежем подходящем
 * проекте, которого ещё нет в ленте, — колокольчик показывает «+1».
 */
function simulateNewProjectFor(sub: Subscription): void {
  const project = getAllProjects().find(
    (p) => projectMatches(p, sub) && !notifications.some((n) => n.projectId === p.id)
  )
  if (!project) return
  notifications = [notificationFor(project, nextNotificationId++, sub, new Date()), ...notifications]
}

export function getNotifications(unreadOnly = false): NotificationsResponse {
  const unreadCount = notifications.filter((n) => !n.isRead).length
  const items = (unreadOnly ? notifications.filter((n) => !n.isRead) : notifications).slice(0, 50)
  return { items, unreadCount }
}

export function markNotificationRead(id: number): boolean {
  const found = notifications.find((n) => n.id === id)
  if (!found) return false
  notifications = notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n))
  return true
}

export function markAllNotificationsRead(): void {
  notifications = notifications.map((n) => ({ ...n, isRead: true }))
}

/** Для тестов: вернуть подписки и ленту к стартовому состоянию */
export function resetNotifierMocks(): void {
  subscriptions = exampleSubscriptions()
  nextSubscriptionId = Math.max(...subscriptions.map((s) => s.id), 0) + 1
  notifications = buildMockNotifications()
  nextNotificationId = 101
}

// ============ «Где работает» и импорт CSV (ТЗ 07, роль admin) ============
// Состояние в памяти страницы, как у подписок. Фактические места не выдумываем: стартово их нет,
// демо — ввод менеджера в карточке («ИП из Сальска → фактически Азов») и импорт CSV из CRM.

const CONFIDENCE: Record<string, number> = { crm: 0.9, manager: 0.8, egrul: 0.7 }
let locations = new Map<number, ActualLocation[]>()
let nextLocationId = 1

function findMunicipalityByName(name: string) {
  const n = name.trim().toLowerCase()
  return mockDictionaries.municipalities.find((m) => m.name.toLowerCase() === n)
}

function recomputeRelocated(company: CompanyShort): void {
  const actual = locations.get(company.id) ?? []
  // Как CompanyFilterSql.RELOCATED: другой регион или другой муниципалитет, чем при регистрации
  company.relocated = actual.some(
    (a) => a.regionName !== null || (a.municipalityName !== null && a.municipalityName !== company.municipalityName)
  )
}

export function getCompanyLocations(companyId: number): CompanyLocations | undefined {
  const company = getAllCompanies().find((c) => c.id === companyId)
  if (!company) return undefined
  return {
    registered: {
      municipalityName: company.municipalityName,
      settlement: company.settlement,
      lat: company.lat,
      lon: company.lon,
    },
    actual: [...(locations.get(companyId) ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id),
    relocated: !!company.relocated,
  }
}

export type MockLocationResult =
  | { ok: true; location: ActualLocation }
  | { ok: false; status: 400 | 404; field?: string; message: string }

function addLocation(company: CompanyShort, input: LocationInput, source: string): MockLocationResult {
  const municipalityName = input.municipalityName?.trim() || null
  const regionName = input.regionName?.trim() || null
  if ((municipalityName === null) === (regionName === null)) {
    return { ok: false, status: 400, field: 'municipalityName', message: 'Укажите район/город области или другой регион — одно из двух' }
  }
  let lat: number | null = null
  let lon: number | null = null
  if (municipalityName !== null) {
    const muni = findMunicipalityByName(municipalityName)
    if (!muni) {
      return { ok: false, status: 400, field: 'municipalityName', message: `Неизвестный район или город: ${municipalityName}` }
    }
    lat = muni.lat
    lon = muni.lon
  }
  const location: ActualLocation = {
    id: nextLocationId++,
    municipalityName,
    regionName,
    address: input.address?.trim() || null,
    lat,
    lon,
    source,
    confidence: CONFIDENCE[source] ?? 0.5,
    note: input.note?.trim() || null,
    createdAt: new Date().toISOString(),
  }
  locations.set(company.id, [location, ...(locations.get(company.id) ?? [])])
  recomputeRelocated(company)
  return { ok: true, location }
}

export function addCompanyLocation(companyId: number, input: LocationInput): MockLocationResult {
  const company = getAllCompanies().find((c) => c.id === companyId)
  if (!company) return { ok: false, status: 404, message: `Компания ${companyId} не найдена` }
  return addLocation(company, input, 'manager')
}

/** Менеджер удаляет только своё (source = manager) — как LocationService; 403 для остального */
export function deleteCompanyLocation(companyId: number, locationId: number): 204 | 403 | 404 {
  const company = getAllCompanies().find((c) => c.id === companyId)
  const list = locations.get(companyId) ?? []
  const found = list.find((l) => l.id === locationId)
  if (!company || !found) return 404
  if (found.source !== 'manager') return 403
  locations.set(companyId, list.filter((l) => l.id !== locationId))
  recomputeRelocated(company)
  return 204
}

/** CSV: «;» или «,», с BOM или без; заголовок пропускаем, если первая ячейка не похожа на ИНН */
function parseCsv(text: string): string[][] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  const delimiter = lines[0]?.includes(';') ? ';' : ','
  const rows = lines.map((l) => l.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, '')))
  return rows.length > 0 && !/^\d{10,12}$/.test(rows[0][0]) ? rows.slice(1) : rows
}

export function importClientsCsv(text: string, mode: ImportMode): ImportClientsResponse {
  const rows = parseCsv(text)
  const byInn = new Map(getAllCompanies().map((c) => [c.inn, c]))
  const matchedInns = new Set<string>()
  const notFound: string[] = []
  rows.forEach(([inn]) => {
    if (byInn.has(inn)) matchedInns.add(inn)
    else if (notFound.length < 100) notFound.push(inn)
  })

  getAllCompanies().forEach((c) => {
    const isClient = matchedInns.has(c.inn) || (mode === 'append' && c.isClient)
    // Меняется только признак клиента, статус в реестре — нет (ClientImportService)
    c.isClient = isClient
    c.kind = c.status === 'excluded' ? (isClient ? 'excluded' : 'others') : isClient ? 'ours' : 'others'
  })

  return {
    rows: rows.length,
    matched: matchedInns.size,
    notFound,
    mode,
    whiteSpots: generateWhiteSpots('all', 1000).length,
  }
}

export function importLocationsCsv(text: string): LocationImportResponse {
  const rows = parseCsv(text)
  const byInn = new Map(getAllCompanies().map((c) => [c.inn, c]))
  let matched = 0
  const notFound: string[] = []
  const invalid: string[] = []
  rows.forEach(([inn, municipality = '', region = '', address = '', source = ''], i) => {
    const company = byInn.get(inn)
    if (!company) {
      if (notFound.length < 100) notFound.push(inn)
      return
    }
    const result = addLocation(
      company,
      { municipalityName: municipality || undefined, regionName: region || undefined, address },
      source || 'crm'
    )
    if (result.ok) matched++
    else if (invalid.length < 100) invalid.push(`строка ${i + 1}: ${result.message}`)
  })
  return { rows: rows.length, matched, notFound, invalid }
}

/** Для тестов */
export function resetLocationMocks(): void {
  locations = new Map()
  nextLocationId = 1
  getAllCompanies().forEach((c) => (c.relocated = false))
}
