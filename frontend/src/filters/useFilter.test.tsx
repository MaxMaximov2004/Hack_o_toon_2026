import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useFilter } from './useFilter'

describe('useFilter', () => {
  it('should preserve industry filters when updating bbox', () => {
    // Wrapper с начальным URL содержащим фильтры industry
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/?industry=agro&industry=trade']}>
        <Routes>
          <Route path="/" element={children} />
        </Routes>
      </MemoryRouter>
    )

    const { result } = renderHook(() => useFilter(), { wrapper })

    // Проверяем начальное состояние
    expect(result.current.filters.industry).toEqual(['agro', 'trade'])

    // Обновляем bbox так же, как это делает карта
    act(() => {
      result.current.updateFilters({
        minLat: 45.3042,
        maxLat: 48.1755,
        minLon: 38.2457,
        maxLon: 42.5853,
      })
    })

    // Проверяем, что industry осталась, а bbox добавился
    expect(result.current.filters.industry).toEqual(['agro', 'trade'])
    expect(result.current.filters.minLat).toBe(45.3042)
    expect(result.current.filters.maxLat).toBe(48.1755)
    expect(result.current.filters.minLon).toBe(38.2457)
    expect(result.current.filters.maxLon).toBe(42.5853)
  })

  it('should preserve bbox when updating industry', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/?minLat=46.1678&maxLat=48.9940&minLon=38.6302&maxLon=42.9698']}>
        <Routes>
          <Route path="/" element={children} />
        </Routes>
      </MemoryRouter>
    )

    const { result } = renderHook(() => useFilter(), { wrapper })

    // Обновляем industry
    act(() => {
      result.current.updateFilters({
        industry: ['logistics', 'it'],
      })
    })

    // Проверяем, что bbox остался
    expect(result.current.filters.industry).toEqual(['logistics', 'it'])
    expect(result.current.filters.minLat).toBe(46.1678)
    expect(result.current.filters.maxLat).toBe(48.994)
    expect(result.current.filters.minLon).toBe(38.6302)
    expect(result.current.filters.maxLon).toBe(42.9698)
  })

  it('should handle multiple filter types simultaneously', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/?industry=agro&industry=trade&client=ours&sizeCategory=small']}>
        <Routes>
          <Route path="/" element={children} />
        </Routes>
      </MemoryRouter>
    )

    const { result } = renderHook(() => useFilter(), { wrapper })

    // Обновляем bbox
    act(() => {
      result.current.updateFilters({
        minLat: 45.3042,
        maxLat: 48.1755,
        minLon: 38.2457,
        maxLon: 42.5853,
      })
    })

    // Все фильтры должны остаться
    expect(result.current.filters.industry).toEqual(['agro', 'trade'])
    expect(result.current.filters.client).toBe('ours')
    expect(result.current.filters.sizeCategory).toEqual(['small'])
    expect(result.current.filters.minLat).toBe(45.3042)
  })
})
