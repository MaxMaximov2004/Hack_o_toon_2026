import { useSearchParams } from 'react-router-dom'
import { useMemo, useCallback } from 'react'
import type { CompanyFilters } from './types'
import { queryToFilter } from './filterToQuery'

/**
 * Хук для работы с фильтрами через URL
 * Источник правды - query-строка
 */
export function useFilter() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Парсим текущие фильтры из URL
  const filters = useMemo(() => {
    return queryToFilter(searchParams)
  }, [searchParams])

  // Обновление фильтров (replace, чтобы не засорять history)
  const updateFilters = useCallback(
    (updates: Partial<CompanyFilters>) => {
      const newFilters = { ...filters, ...updates }

      const params = new URLSearchParams()

      // client
      if (newFilters.client && newFilters.client !== 'all') {
        params.append('client', newFilters.client)
      }

      // status
      if (newFilters.status && newFilters.status !== 'active') {
        params.append('status', newFilters.status)
      }

      // industry
      if (newFilters.industry && newFilters.industry.length > 0) {
        newFilters.industry.forEach((ind) => params.append('industry', ind))
      }

      // revenueMin/Max
      if (newFilters.revenueMin !== undefined && newFilters.revenueMin !== null) {
        params.append('revenueMin', newFilters.revenueMin.toString())
      }
      if (newFilters.revenueMax !== undefined && newFilters.revenueMax !== null) {
        params.append('revenueMax', newFilters.revenueMax.toString())
      }

      // municipalityId
      if (newFilters.municipalityId && newFilters.municipalityId.length > 0) {
        newFilters.municipalityId.forEach((id) => params.append('municipalityId', id.toString()))
      }

      // sizeCategory
      if (newFilters.sizeCategory && newFilters.sizeCategory.length > 0) {
        newFilters.sizeCategory.forEach((cat) => params.append('sizeCategory', cat))
      }

      // growthMin
      if (newFilters.growthMin !== undefined && newFilters.growthMin !== null) {
        params.append('growthMin', newFilters.growthMin.toString())
      }

      // isNew
      if (newFilters.isNew) {
        params.append('isNew', 'true')
      }

      // q
      if (newFilters.q && newFilters.q.length >= 2) {
        params.append('q', newFilters.q)
      }

      // relocated
      if (newFilters.relocated) {
        params.append('relocated', 'true')
      }

      // bbox
      if (
        newFilters.minLat !== undefined &&
        newFilters.maxLat !== undefined &&
        newFilters.minLon !== undefined &&
        newFilters.maxLon !== undefined
      ) {
        params.append('minLat', newFilters.minLat.toFixed(4))
        params.append('maxLat', newFilters.maxLat.toFixed(4))
        params.append('minLon', newFilters.minLon.toFixed(4))
        params.append('maxLon', newFilters.maxLon.toFixed(4))
      }

      setSearchParams(params, { replace: true })
    },
    [filters, setSearchParams]
  )

  // Сброс фильтров
  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  return {
    filters,
    updateFilters,
    resetFilters,
  }
}
