import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as api from './api'
import { useEstimate, ESTIMATE_DEBOUNCE_MS } from './useEstimate'
import type { EstimateRequest, EstimateResponse } from './types'
import estimateFixture from '../mocks/fixtures/calc-estimate.json'

vi.mock('./api')

const base: EstimateRequest = {
  regionId: 3, level: 'basic', termMonths: 12, financing: 'prepay', stages: ['pir'],
  items: [{ componentId: 'el_01', qty: 1 }], customItems: [], urgent: false, uniqueSolution: false,
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useEstimate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(api.postEstimate).mockReset()
    vi.mocked(api.postEstimate).mockResolvedValue(estimateFixture as EstimateResponse)
  })
  afterEach(() => vi.useRealTimers())

  it('частые изменения → один запрос с последним телом через 400 мс', async () => {
    const { rerender, result } = renderHook(({ body }) => useEstimate(body), { wrapper, initialProps: { body: base } })
    for (const qty of [2, 3, 4]) {
      rerender({ body: { ...base, items: [{ componentId: 'el_01', qty }] } })
      await act(() => vi.advanceTimersByTimeAsync(100))
    }
    expect(result.current.isStale).toBe(true)
    await act(() => vi.advanceTimersByTimeAsync(ESTIMATE_DEBOUNCE_MS))

    const bodies = vi.mocked(api.postEstimate).mock.calls.map(([b]) => b.items[0].qty)
    // первый — стартовое тело, второй — последнее; промежуточные 2 и 3 не отправлялись
    expect(bodies).toEqual([1, 4])
    expect(result.current.data?.price.optimal).toBe(estimateFixture.price.optimal)
  })

  it('без позиций запрос не уходит и результата нет', async () => {
    const { result } = renderHook(() => useEstimate({ ...base, items: [] }), { wrapper })
    await act(() => vi.advanceTimersByTimeAsync(ESTIMATE_DEBOUNCE_MS * 2))
    expect(api.postEstimate).not.toHaveBeenCalled()
    expect(result.current.data).toBeUndefined()
  })

  it('только своя позиция (ПО) — тоже считаем', async () => {
    const body = { ...base, items: [], customItems: [{ name: 'ПО', unit: 'лиц.', unitPrice: 1000, qty: 1 }] }
    renderHook(() => useEstimate(body), { wrapper })
    await act(() => vi.advanceTimersByTimeAsync(ESTIMATE_DEBOUNCE_MS))
    expect(api.postEstimate).toHaveBeenCalledTimes(1)
  })

  it('ошибка API — объект ApiError с текстом', async () => {
    vi.mocked(api.postEstimate).mockRejectedValue({ code: 'VALIDATION_ERROR', message: 'Неизвестный регион: 99' })
    const { result } = renderHook(() => useEstimate(base), { wrapper })
    await act(() => vi.advanceTimersByTimeAsync(ESTIMATE_DEBOUNCE_MS))
    expect(result.current.error).toMatchObject({ message: 'Неизвестный регион: 99' })
  })
})
