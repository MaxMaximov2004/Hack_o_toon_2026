import { useSearchParams } from 'react-router-dom'
import { useCallback, useMemo } from 'react'
import { calcParamsToQuery, queryToCalcParams, type CalcParams } from './calcParams'

/**
 * Параметры калькулятора через URL — источник правды query-строка, как в useProjectFilter.
 * Обновление — от текущего URL (функциональный setSearchParams), без записи в историю.
 */
export function useCalcParams() {
  const [searchParams, setSearchParams] = useSearchParams()

  const params = useMemo(() => queryToCalcParams(searchParams), [searchParams])

  const updateParams = useCallback(
    (updates: Partial<CalcParams>) => {
      setSearchParams(
        (prev) => new URLSearchParams(calcParamsToQuery({ ...queryToCalcParams(prev), ...updates })),
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const resetParams = useCallback(() => {
    setSearchParams({}, { replace: true })
  }, [setSearchParams])

  return { params, updateParams, resetParams }
}
