import type { Dictionaries, MapCell, MapPoint, CompanyShort, Company as ApiCompany } from '../api/types'

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
    { code: 'micro', name: 'Микро (до 15 человек)' },
    { code: 'small', name: 'Малый (15-100 человек)' },
    { code: 'medium', name: 'Средний (100-250 человек)' },
  ],

  stages: [],
  needs: [],
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

    // Генерируем "наши" компании
    for (let i = 0; i < oursCount; i++) {
      const lat = city.lat + rng.range(-0.02, 0.02)
      const lon = city.lon + rng.range(-0.02, 0.02)
      companies.push(createCompanyShort(id++, 'ours', lat, lon, city.name, rng))
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

  const isClient = kind === 'ours'
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

  // Фильтр по client
  if (filters.client === 'ours') {
    companies = companies.filter((c) => c.kind === 'ours')
  } else if (filters.client === 'others') {
    companies = companies.filter((c) => c.kind === 'others')
  }

  // Фильтр по status
  if (filters.status === 'active') {
    companies = companies.filter((c) => c.status === 'active')
  } else if (filters.status === 'excluded') {
    companies = companies.filter((c) => c.status === 'excluded')
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
  const company = getAllCompanies().find((c) => c.id === id)

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
