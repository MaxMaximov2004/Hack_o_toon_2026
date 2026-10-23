import type { CompanyFilters } from './types'

/**
 * Преобразует объект фильтров в query-строку для API
 * Источник правды - URL. Эта функция используется для карты, списка и экспорта.
 */
export function filterToQuery(filters: CompanyFilters): string {
  const params = new URLSearchParams()

  // client (по умолчанию 'all', не добавляем в URL)
  if (filters.client && filters.client !== 'all') {
    params.append('client', filters.client)
  }

  // status (по умолчанию 'active', не добавляем в URL)
  if (filters.status && filters.status !== 'active') {
    params.append('status', filters.status)
  }

  // industry (множественный)
  if (filters.industry && filters.industry.length > 0) {
    filters.industry.forEach((ind) => params.append('industry', ind))
  }

  // revenueMin/Max
  if (filters.revenueMin !== undefined && filters.revenueMin !== null) {
    params.append('revenueMin', filters.revenueMin.toString())
  }
  if (filters.revenueMax !== undefined && filters.revenueMax !== null) {
    params.append('revenueMax', filters.revenueMax.toString())
  }

  // municipalityId (множественный)
  if (filters.municipalityId && filters.municipalityId.length > 0) {
    filters.municipalityId.forEach((id) => params.append('municipalityId', id.toString()))
  }

  // sizeCategory (множественный)
  if (filters.sizeCategory && filters.sizeCategory.length > 0) {
    filters.sizeCategory.forEach((cat) => params.append('sizeCategory', cat))
  }

  // growthMin
  if (filters.growthMin !== undefined && filters.growthMin !== null) {
    params.append('growthMin', filters.growthMin.toString())
  }

  // isNew
  if (filters.isNew) {
    params.append('isNew', 'true')
  }

  // q (поиск)
  if (filters.q && filters.q.length >= 2) {
    params.append('q', filters.q)
  }

  // relocated
  if (filters.relocated) {
    params.append('relocated', 'true')
  }

  // bbox (все четыре или ни одного, округление до 4 знаков)
  if (
    filters.minLat !== undefined &&
    filters.maxLat !== undefined &&
    filters.minLon !== undefined &&
    filters.maxLon !== undefined
  ) {
    params.append('minLat', filters.minLat.toFixed(4))
    params.append('maxLat', filters.maxLat.toFixed(4))
    params.append('minLon', filters.minLon.toFixed(4))
    params.append('maxLon', filters.maxLon.toFixed(4))
  }

  return params.toString()
}

/**
 * Парсит query-строку в объект фильтров
 */
export function queryToFilter(search: URLSearchParams): CompanyFilters {
  const client = (search.get('client') || 'all') as CompanyFilters['client']
  const status = (search.get('status') || 'active') as CompanyFilters['status']

  const industry = search.getAll('industry')
  const municipalityId = search.getAll('municipalityId').map(Number).filter((n) => !isNaN(n))
  const sizeCategory = search.getAll('sizeCategory')

  const revenueMin = search.get('revenueMin')
  const revenueMax = search.get('revenueMax')
  const growthMin = search.get('growthMin')

  const isNew = search.get('isNew') === 'true'
  const relocated = search.get('relocated') === 'true'
  const q = search.get('q') || undefined

  const minLat = search.get('minLat')
  const maxLat = search.get('maxLat')
  const minLon = search.get('minLon')
  const maxLon = search.get('maxLon')

  return {
    client,
    status,
    industry,
    municipalityId,
    sizeCategory,
    revenueMin: revenueMin ? Number(revenueMin) : undefined,
    revenueMax: revenueMax ? Number(revenueMax) : undefined,
    growthMin: growthMin ? Number(growthMin) : undefined,
    isNew: isNew || undefined,
    relocated: relocated || undefined,
    q,
    minLat: minLat ? Number(minLat) : undefined,
    maxLat: maxLat ? Number(maxLat) : undefined,
    minLon: minLon ? Number(minLon) : undefined,
    maxLon: maxLon ? Number(maxLon) : undefined,
  }
}
