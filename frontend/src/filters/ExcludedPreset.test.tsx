import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useFilter } from './useFilter'

describe('Excluded Clients Preset', () => {
  it('should apply preset filters to URL correctly', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter
        initialEntries={['/']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/" element={children} />
        </Routes>
      </MemoryRouter>
    )

    const { result } = renderHook(() => useFilter(), { wrapper })

    // Начальное состояние - дефолты
    expect(result.current.filters.client).toBe('all')
    expect(result.current.filters.status).toBe('active')

    // Применяем пресет "Исключённые клиенты"
    act(() => {
      result.current.updateFilters({
        client: 'ours',
        status: 'excluded',
        minLat: undefined,
        maxLat: undefined,
        minLon: undefined,
        maxLon: undefined,
      })
    })

    // Проверяем URL и filters
    expect(result.current.filters.client).toBe('ours')
    expect(result.current.filters.status).toBe('excluded')
    expect(result.current.filters.minLat).toBeUndefined()
    expect(result.current.filters.maxLat).toBeUndefined()
    expect(result.current.filters.minLon).toBeUndefined()
    expect(result.current.filters.maxLon).toBeUndefined()
  })

  it('should preserve preset filters when bbox is updated after preset', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter
        initialEntries={['/']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/" element={children} />
        </Routes>
      </MemoryRouter>
    )

    const { result } = renderHook(() => useFilter(), { wrapper })

    // Применяем пресет
    act(() => {
      result.current.updateFilters({
        client: 'ours',
        status: 'excluded',
        minLat: undefined,
        maxLat: undefined,
        minLon: undefined,
        maxLon: undefined,
      })
    })

    // Симулируем moveend после fitBounds (как в handleExcludedPresetApply)
    act(() => {
      result.current.updateFilters({
        minLat: 46.0,
        maxLat: 49.5,
        minLon: 38.8,
        maxLon: 43.5,
      })
    })

    // Проверяем, что client и status сохранились
    expect(result.current.filters.client).toBe('ours')
    expect(result.current.filters.status).toBe('excluded')
    // bbox тоже должен быть
    expect(result.current.filters.minLat).toBe(46.0)
    expect(result.current.filters.maxLat).toBe(49.5)
    expect(result.current.filters.minLon).toBe(38.8)
    expect(result.current.filters.maxLon).toBe(43.5)
  })

  it('should clear bbox when preset is applied with undefined bbox values', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter
        initialEntries={['/?minLat=47.0&maxLat=48.0&minLon=39.0&maxLon=40.0']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/" element={children} />
        </Routes>
      </MemoryRouter>
    )

    const { result } = renderHook(() => useFilter(), { wrapper })

    // Начальное состояние - есть bbox
    expect(result.current.filters.minLat).toBe(47.0)
    expect(result.current.filters.maxLat).toBe(48.0)

    // Применяем пресет с undefined bbox
    act(() => {
      result.current.updateFilters({
        client: 'ours',
        status: 'excluded',
        minLat: undefined,
        maxLat: undefined,
        minLon: undefined,
        maxLon: undefined,
      })
    })

    // bbox должен быть удален из URL
    expect(result.current.filters.minLat).toBeUndefined()
    expect(result.current.filters.maxLat).toBeUndefined()
    expect(result.current.filters.minLon).toBeUndefined()
    expect(result.current.filters.maxLon).toBeUndefined()
    // пресет должен быть применён
    expect(result.current.filters.client).toBe('ours')
    expect(result.current.filters.status).toBe('excluded')
  })
})
