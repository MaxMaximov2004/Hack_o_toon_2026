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
  // ВАЖНО: функциональное обновление от текущего URL, не перезаписываем всё
  const updateFilters = useCallback(
    (updates: Partial<CompanyFilters>) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev)

        // Обрабатываем каждый ключ из updates
        Object.keys(updates).forEach((key) => {
          const value = updates[key as keyof CompanyFilters]

          // Сначала удаляем старые значения этого ключа
          params.delete(key)

          // Затем добавляем новые, если они не дефолтные
          if (key === 'client' && value && value !== 'all') {
            params.set('client', value as string)
          } else if (key === 'status' && value && value !== 'active') {
            params.set('status', value as string)
          } else if (key === 'industry' && Array.isArray(value) && value.length > 0) {
            value.forEach((v) => params.append('industry', String(v)))
          } else if (key === 'municipalityId' && Array.isArray(value) && value.length > 0) {
            value.forEach((v) => params.append('municipalityId', String(v)))
          } else if (key === 'sizeCategory' && Array.isArray(value) && value.length > 0) {
            value.forEach((v) => params.append('sizeCategory', String(v)))
          } else if (key === 'revenueMin' && value !== undefined && value !== null) {
            params.set('revenueMin', value.toString())
          } else if (key === 'revenueMax' && value !== undefined && value !== null) {
            params.set('revenueMax', value.toString())
          } else if (key === 'growthMin' && value !== undefined && value !== null) {
            params.set('growthMin', value.toString())
          } else if (key === 'isNew' && value) {
            params.set('isNew', 'true')
          } else if (key === 'q' && value && (value as string).length >= 2) {
            params.set('q', value as string)
          } else if (key === 'relocated' && value) {
            params.set('relocated', 'true')
          } else if (key === 'minLat' && value !== undefined) {
            params.set('minLat', (value as number).toFixed(4))
          } else if (key === 'maxLat' && value !== undefined) {
            params.set('maxLat', (value as number).toFixed(4))
          } else if (key === 'minLon' && value !== undefined) {
            params.set('minLon', (value as number).toFixed(4))
          } else if (key === 'maxLon' && value !== undefined) {
            params.set('maxLon', (value as number).toFixed(4))
          }
        })

        return params
      }, { replace: true })
    },
    [setSearchParams]
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
