// Типы фильтров

export type ClientFilter = 'all' | 'ours' | 'others'
export type StatusFilter = 'active' | 'excluded' | 'all'

export interface CompanyFilters {
  // Основные фильтры
  client: ClientFilter
  status: StatusFilter

  // Отрасли (множественный выбор)
  industry: string[]

  // Выручка (в рублях/год)
  revenueMin?: number
  revenueMax?: number

  // Районы/города (множественный выбор, ID)
  municipalityId: number[]

  // Категории размера (множественный выбор)
  sizeCategory: string[]

  // Рост (%)
  growthMin?: number

  // Только новые
  isNew?: boolean

  // Поиск (название или ИНН)
  q?: string

  // Переехавшие (задача со звёздочкой)
  relocated?: boolean

  // Окно карты (bbox)
  minLat?: number
  maxLat?: number
  minLon?: number
  maxLon?: number
}

// Дефолтные значения
export const DEFAULT_FILTERS: CompanyFilters = {
  client: 'all',
  status: 'active',
  industry: [],
  municipalityId: [],
  sizeCategory: [],
}
