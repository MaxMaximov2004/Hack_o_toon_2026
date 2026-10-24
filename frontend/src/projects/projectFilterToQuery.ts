import type { ProjectFilters } from './types'

/**
 * Преобразует объект фильтров проектов в query-строку для API.
 * Используется для списка, таймлайна, карты и экспорта — чтобы все получали одинаковые данные.
 */
export function projectFilterToQuery(filters: ProjectFilters): string {
  const params = new URLSearchParams()

  // Множественные значения — повтором параметра
  if (filters.stage && filters.stage.length > 0) {
    filters.stage.forEach((s) => params.append('stage', s))
  }

  if (filters.industry && filters.industry.length > 0) {
    filters.industry.forEach((i) => params.append('industry', i))
  }

  if (filters.need && filters.need.length > 0) {
    filters.need.forEach((n) => params.append('need', n))
  }

  if (filters.municipalityId && filters.municipalityId.length > 0) {
    filters.municipalityId.forEach((m) => params.append('municipalityId', String(m)))
  }

  // Одиночные значения
  if (filters.yearFrom !== undefined) {
    params.set('yearFrom', String(filters.yearFrom))
  }

  if (filters.yearTo !== undefined) {
    params.set('yearTo', String(filters.yearTo))
  }

  if (filters.isKey) {
    params.set('isKey', 'true')
  }

  if (filters.amountMin !== undefined) {
    params.set('amountMin', String(filters.amountMin))
  }

  if (filters.q && filters.q.length >= 2) {
    params.set('q', filters.q)
  }

  return params.toString()
}
