import type { Dictionaries, MapCell, MapPoint } from '../api/types'

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

// Тип компании
type Company = {
  id: number
  lat: number
  lon: number
  kind: 'ours' | 'others'
}

// Генерируем компании один раз с фиксированным seed
let generatedCompanies: Company[] | null = null

function generateCompanies(): Company[] {
  if (generatedCompanies) return generatedCompanies

  const companies: Company[] = []
  let id = 1
  const rng = new SeededRandom(12345) // Фиксированный seed

  CITIES.forEach((city) => {
    const totalCompanies = city.companies
    const oursCount = Math.floor(totalCompanies * city.oursRatio)
    const othersCount = totalCompanies - oursCount

    // Генерируем "наши" компании
    for (let i = 0; i < oursCount; i++) {
      companies.push({
        id: id++,
        // Небольшой разброс вокруг города (±0.02 градуса ≈ ±2км)
        lat: city.lat + rng.range(-0.02, 0.02),
        lon: city.lon + rng.range(-0.02, 0.02),
        kind: 'ours',
      })
    }

    // Генерируем "не наши" компании
    for (let i = 0; i < othersCount; i++) {
      companies.push({
        id: id++,
        lat: city.lat + rng.range(-0.02, 0.02),
        lon: city.lon + rng.range(-0.02, 0.02),
        kind: 'others',
      })
    }
  })

  generatedCompanies = companies
  return companies
}

// Генерация кластеров с группировкой по ячейкам
export function generateMapCells(
  zoom: number,
  bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): { cells: MapCell[]; points: MapPoint[] } {
  const companies = generateCompanies()

  // Фильтруем по bbox если есть
  const filtered = bbox
    ? companies.filter(
        (c) =>
          c.lat >= bbox.minLat &&
          c.lat <= bbox.maxLat &&
          c.lon >= bbox.minLon &&
          c.lon <= bbox.maxLon
      )
    : companies

  // Если zoom >= 11, возвращаем точки
  if (zoom >= 11) {
    const points: MapPoint[] = filtered.slice(0, 500).map((c) => ({
      id: c.id,
      lat: c.lat,
      lon: c.lon,
      kind: c.kind,
    }))
    return { cells: [], points }
  }

  // Группируем в кластеры
  // cellDeg = 84 / 2^zoom (из формулы Mercator Web для приблизительной оценки)
  const cellDeg = 84 / Math.pow(2, zoom)

  // Группируем компании по ячейкам
  const cellMap = new Map<
    string,
    Array<{ lat: number; lon: number; kind: 'ours' | 'others' }>
  >()

  filtered.forEach((company) => {
    const cellLat = Math.floor(company.lat / cellDeg)
    const cellLon = Math.floor(company.lon / cellDeg)
    const key = `${cellLat},${cellLon}`

    if (!cellMap.has(key)) {
      cellMap.set(key, [])
    }
    cellMap.get(key)!.push(company)
  })

  // Создаём кластеры
  const cells: MapCell[] = []

  cellMap.forEach((companies) => {
    // Центр кластера - среднее координат компаний
    const avgLat = companies.reduce((sum, c) => sum + c.lat, 0) / companies.length
    const avgLon = companies.reduce((sum, c) => sum + c.lon, 0) / companies.length

    const ours = companies.filter((c) => c.kind === 'ours').length
    const others = companies.filter((c) => c.kind === 'others').length

    cells.push({
      lat: avgLat,
      lon: avgLon,
      total: companies.length,
      ours,
      others,
      excluded: 0,
    })
  })

  return { cells, points: [] }
}
