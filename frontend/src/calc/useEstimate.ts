import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { postEstimate } from './api'
import type { EstimateRequest } from './types'

export const ESTIMATE_DEBOUNCE_MS = 400

export function hasPositions(body: EstimateRequest): boolean {
  return body.items.length + body.customItems.length > 0
}

/**
 * Автопересчёт: тело запроса → POST /api/calc/estimate не чаще, чем раз в 400 мс после последнего изменения.
 * Без позиций запрос не шлём. Пока считается новое — отдаём прошлый результат (isStale → полупрозрачно).
 */
export function useEstimate(body: EstimateRequest) {
  const bodyKey = JSON.stringify(body)
  const [debouncedKey, setDebouncedKey] = useState(bodyKey)
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = setTimeout(() => setDebouncedKey(bodyKey), ESTIMATE_DEBOUNCE_MS)
    return () => clearTimeout(debounceTimer.current)
  }, [bodyKey])

  const enabled = hasPositions(body) && hasPositions(JSON.parse(debouncedKey) as EstimateRequest)

  const query = useQuery({
    queryKey: ['calc-estimate', debouncedKey],
    queryFn: () => postEstimate(JSON.parse(debouncedKey) as EstimateRequest),
    enabled,
    placeholderData: (prev) => prev,
    // Расчёт детерминирован: 400 на повторе не исправится, а ошибка покажется на секунду позже
    retry: false,
  })

  return {
    data: enabled ? query.data : undefined,
    error: enabled ? query.error : null,
    isLoading: enabled && query.isLoading,
    isStale: bodyKey !== debouncedKey || query.isFetching,
  }
}
