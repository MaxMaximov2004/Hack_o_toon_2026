// Типы для фильтров проектов (продукт 2)

export interface ProjectFilters {
  stage?: string[] // мульти: design, construction, launch
  industry?: string[] // мульти: коды отраслей
  need?: string[] // мульти: it_infra, apcs, phys_security, info_security
  municipalityId?: number[] // мульти
  yearFrom?: number
  yearTo?: number
  isKey?: boolean
  amountMin?: number // млн ₽
  q?: string // поиск по названию и инициатору, ≥ 2 символов
}

export type ProjectSortField = 'amountMln' | 'jobs' | 'startYear' | 'launchYear' | 'title'
export type ProjectSortDirection = 'asc' | 'desc'
