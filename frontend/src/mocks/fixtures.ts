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
  Notification,
} from '../api/types'
import projectsFixture from './fixtures/projects.json'
import subscriptionsExample from '../../../contracts/examples/subscriptions.json'
import notificationsExample from '../../../contracts/examples/notifications.json'

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
      coverage,
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
    result = result.filter((p) => filters.industry!.includes(p.industry))
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
    result = result.filter((p) => {
      // Проект попадает в диапазон, если он идёт в эти годы (между startYear и launchYear)
      return p.startYear <= yearTo && p.launchYear >= yearFrom
    })
  }

  if (filters.isKey) {
    result = result.filter((p) => p.isKey)
  }

  if (filters.amountMin !== undefined) {
    result = result.filter((p) => p.amountMln >= filters.amountMin!)
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

  filtered.forEach((project) => {
    events.push({
      year: project.startYear,
      type: 'start',
      projectId: project.id,
      title: project.title,
    })
    events.push({
      year: project.launchYear,
      type: 'launch',
      projectId: project.id,
      title: project.title,
    })
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

  const minYear = Math.min(...filtered.map((p) => Math.min(p.startYear, p.launchYear)))
  const maxYear = Math.max(...filtered.map((p) => Math.max(p.startYear, p.launchYear)))

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
    industry: project.industry,
    industryName: project.industryName,
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

// Подписки (из примера)
const baseSubscriptions: Subscription[] = subscriptionsExample.map((sub: any) => ({
  id: sub.id,
  userId: 1, // demo user
  industry: sub.industry,
  industryName: sub.industry
    ? mockDictionaries.industries.find((i) => i.code === sub.industry)?.name || null
    : null,
  municipalityId: sub.municipalityId,
  municipalityName: sub.municipalityId
    ? mockDictionaries.municipalities.find((m) => m.id === sub.municipalityId)?.name || null
    : null,
  need: sub.need,
  needName: sub.need ? mockDictionaries.needs.find((n) => n.code === sub.need)?.name || null : null,
  stage: sub.stage,
  stageName: sub.stage
    ? mockDictionaries.stages.find((s) => s.code === sub.stage)?.name || null
    : null,
  createdAt: sub.createdAt,
}))

let subscriptions: Subscription[] = [...baseSubscriptions]
let nextSubscriptionId = Math.max(...subscriptions.map((s) => s.id), 0) + 1

export function getSubscriptions(): Subscription[] {
  return subscriptions
}

export function createSubscription(data: {
  industry?: string
  municipalityId?: number
  need?: string
  stage?: string
}): Subscription {
  const newSub: Subscription = {
    id: nextSubscriptionId++,
    userId: 1,
    industry: data.industry || null,
    industryName: data.industry
      ? mockDictionaries.industries.find((i) => i.code === data.industry)?.name || null
      : null,
    municipalityId: data.municipalityId || null,
    municipalityName: data.municipalityId
      ? mockDictionaries.municipalities.find((m) => m.id === data.municipalityId)?.name || null
      : null,
    need: data.need || null,
    needName: data.need
      ? mockDictionaries.needs.find((n) => n.code === data.need)?.name || null
      : null,
    stage: data.stage ? (data.stage as 'design' | 'construction' | 'launch') : null,
    stageName: data.stage
      ? mockDictionaries.stages.find((s) => s.code === data.stage)?.name || null
      : null,
    createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
  }
  subscriptions.push(newSub)
  return newSub
}

export function deleteSubscription(id: number): void {
  subscriptions = subscriptions.filter((s) => s.id !== id)
}

// Уведомления (из примера)
const baseNotifications: Notification[] = notificationsExample.items.map((notif: any) => ({
  id: notif.id,
  userId: 1,
  projectId: notif.projectId,
  projectTitle: notif.title, // title из JSON -> projectTitle в типе
  municipalityName: notif.municipalityName,
  read: notif.isRead,
  createdAt: notif.createdAt,
}))

let notifications: Notification[] = [...baseNotifications]

export function getNotifications(): { items: Notification[]; unreadCount: number } {
  const unreadCount = notifications.filter((n) => !n.read).length
  return { items: notifications, unreadCount }
}

export function markNotificationRead(id: number): void {
  const notif = notifications.find((n) => n.id === id)
  if (notif) {
    notif.read = true
  }
}

export function markAllNotificationsRead(): void {
  notifications.forEach((n) => {
    n.read = true
  })
}
