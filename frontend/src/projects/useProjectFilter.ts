import { useSearchParams } from 'react-router-dom'
import { useCallback, useMemo } from 'react'
import type { ProjectFilters } from './types'

/**
 * Хук для управления фильтрами проектов через URL (отдельный от фильтров Радара).
 * Источник правды — query-параметры, как в useFilter для компаний.
 */
export function useProjectFilter() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Парсим текущие фильтры из URL
  const filters = useMemo((): ProjectFilters => {
    const stage = searchParams.getAll('stage')
    const industry = searchParams.getAll('industry')
    const need = searchParams.getAll('need')
    const municipalityId = searchParams.getAll('municipalityId').map(Number)
    const yearFrom = searchParams.get('yearFrom')
    const yearTo = searchParams.get('yearTo')
    const isKey = searchParams.get('isKey') === 'true'
    const amountMin = searchParams.get('amountMin')
    const q = searchParams.get('q')

    return {
      stage: stage.length > 0 ? stage : undefined,
      industry: industry.length > 0 ? industry : undefined,
      need: need.length > 0 ? need : undefined,
      municipalityId: municipalityId.length > 0 ? municipalityId : undefined,
      yearFrom: yearFrom ? Number(yearFrom) : undefined,
      yearTo: yearTo ? Number(yearTo) : undefined,
      isKey: isKey || undefined,
      amountMin: amountMin ? Number(amountMin) : undefined,
      q: q || undefined,
    }
  }, [searchParams])

  // Обновление фильтров
  const updateFilters = useCallback(
    (updates: Partial<ProjectFilters>) => {
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev)

          // Для каждого обновляемого поля
          Object.entries(updates).forEach(([key, value]) => {
            // Удаляем старые значения
            newParams.delete(key)

            // Добавляем новые
            if (value === undefined || value === null) {
              // Пропускаем undefined/null
              return
            }

            if (Array.isArray(value)) {
              // Множественные значения
              if (value.length > 0) {
                value.forEach((v) => newParams.append(key, String(v)))
              }
            } else if (typeof value === 'boolean') {
              // boolean — только true записываем
              if (value) {
                newParams.set(key, 'true')
              }
            } else {
              // Одиночные значения
              newParams.set(key, String(value))
            }
          })

          return newParams
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  // Сброс фильтров
  const resetFilters = useCallback(() => {
    setSearchParams({}, { replace: true })
  }, [setSearchParams])

  return { filters, updateFilters, resetFilters }
}
