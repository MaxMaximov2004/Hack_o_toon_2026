import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SmartSearch } from './SmartSearch'
import type { CompanyFilters } from '../filters/types'
import type { Dictionaries } from '../api/types'

// Мок данных справочников
const mockDictionaries: Dictionaries = {
  industries: [
    { code: 'it', name: 'ИТ' },
    { code: 'construction', name: 'Строительство' },
    { code: 'logistics', name: 'Логистика' },
  ],
  municipalities: [
    { id: 1, name: 'г. Азов', kind: 'city', lat: 47.1, lon: 39.4 },
    { id: 2, name: 'Азовский р-н', kind: 'district', lat: 47.05, lon: 39.3 },
    { id: 3, name: 'Белая Калитва', kind: 'city', lat: 48.2, lon: 40.8 },
  ],
  sizeCategories: [
    { code: 'micro', name: 'Микропредприятие' },
    { code: 'small', name: 'Малое' },
    { code: 'medium', name: 'Среднее' },
  ],
  stages: [],
  needs: [],
}

// Моки для API
vi.mock('../api/endpoints', () => ({
  getDictionaries: vi.fn(() => Promise.resolve(mockDictionaries)),
  getCompanies: vi.fn(() => Promise.resolve({ items: [], total: 0, page: 0, size: 5 })),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('SmartSearch suggestions', () => {
  const defaultFilters: CompanyFilters = {
    client: 'all',
    status: 'active',
    industry: [],
    municipalityId: [],
    sizeCategory: [],
  }

  it('shows "ИТ" first when searching "ит", without "Строительство" or "Белая Калитва"', async () => {
    const onFiltersChange = vi.fn()
    const onSelectCompany = vi.fn()

    render(
      <SmartSearch
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        onSelectCompany={onSelectCompany}
      />,
      { wrapper: createWrapper() }
    )

    const input = screen.getByPlaceholderText('Название, ИНН, отрасль, город')
    await userEvent.type(input, 'ит')

    await waitFor(() => {
      const suggestions = screen.queryAllByText(/ИТ|Строительство|Белая Калитва/)
      expect(suggestions.length).toBeGreaterThan(0)
    })

    // Должна быть только "ИТ"
    expect(screen.getByText('ИТ')).toBeInTheDocument()
    expect(screen.queryByText('Строительство')).not.toBeInTheDocument()
    expect(screen.queryByText('Белая Калитва')).not.toBeInTheDocument()
  })

  it('shows "г. Азов" and "Азовский р-н" when searching "азов"', async () => {
    const onFiltersChange = vi.fn()
    const onSelectCompany = vi.fn()

    render(
      <SmartSearch
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        onSelectCompany={onSelectCompany}
      />,
      { wrapper: createWrapper() }
    )

    const input = screen.getByPlaceholderText('Название, ИНН, отрасль, город')
    await userEvent.type(input, 'азов')

    await waitFor(() => {
      expect(screen.getByText('г. Азов')).toBeInTheDocument()
    })

    expect(screen.getByText('г. Азов')).toBeInTheDocument()
    expect(screen.getByText('Азовский р-н')).toBeInTheDocument()
  })

  it('shows "Строительство" when searching "стро"', async () => {
    const onFiltersChange = vi.fn()
    const onSelectCompany = vi.fn()

    render(
      <SmartSearch
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        onSelectCompany={onSelectCompany}
      />,
      { wrapper: createWrapper() }
    )

    const input = screen.getByPlaceholderText('Название, ИНН, отрасль, город')
    await userEvent.type(input, 'стро')

    await waitFor(() => {
      expect(screen.getByText('Строительство')).toBeInTheDocument()
    })
  })

  it('shows "Белая Калитва" when searching "кал"', async () => {
    const onFiltersChange = vi.fn()
    const onSelectCompany = vi.fn()

    render(
      <SmartSearch
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        onSelectCompany={onSelectCompany}
      />,
      { wrapper: createWrapper() }
    )

    const input = screen.getByPlaceholderText('Название, ИНН, отрасль, город')
    await userEvent.type(input, 'кал')

    await waitFor(() => {
      expect(screen.getByText('Белая Калитва')).toBeInTheDocument()
    })
  })
})

describe('SmartSearch filter application', () => {
  it('applies industry filter when selecting "ИТ" suggestion', async () => {
    const onFiltersChange = vi.fn()
    const onSelectCompany = vi.fn()
    const filters: CompanyFilters = {
      client: 'all',
      status: 'active',
      industry: [],
      municipalityId: [],
      sizeCategory: [],
    }

    render(
      <SmartSearch filters={filters} onFiltersChange={onFiltersChange} onSelectCompany={onSelectCompany} />,
      { wrapper: createWrapper() }
    )

    const input = screen.getByPlaceholderText('Название, ИНН, отрасль, город')
    await userEvent.type(input, 'ит')

    await waitFor(() => {
      expect(screen.getByText('ИТ')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('ИТ'))

    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalled()
    })

    // Проверяем, что был вызван с правильными параметрами
    const lastCall = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0]
    expect(lastCall.industry).toEqual(['it'])
    expect(lastCall.q).toBeUndefined()
  })

  it('preserves other filters when applying new filter', async () => {
    const onFiltersChange = vi.fn()
    const onSelectCompany = vi.fn()
    const filters: CompanyFilters = {
      client: 'ours',
      status: 'active',
      industry: ['logistics'],
      municipalityId: [1],
      sizeCategory: [],
      revenueMin: 1000000,
    }

    render(
      <SmartSearch filters={filters} onFiltersChange={onFiltersChange} onSelectCompany={onSelectCompany} />,
      { wrapper: createWrapper() }
    )

    const input = screen.getByPlaceholderText('Название, ИНН, отрасль, город')
    await userEvent.type(input, 'ит')

    await waitFor(() => {
      expect(screen.getByText('ИТ')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('ИТ'))

    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalled()
    })

    const lastCall = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0]
    // Должен добавить 'it' к существующему 'logistics'
    expect(lastCall.industry).toEqual(['logistics', 'it'])
    // Другие фильтры не должны быть затронуты (их нет в updates)
    expect(lastCall.client).toBeUndefined()
    expect(lastCall.municipalityId).toBeUndefined()
    expect(lastCall.revenueMin).toBeUndefined()
  })

  it('does not add duplicate filter', async () => {
    const onFiltersChange = vi.fn()
    const onSelectCompany = vi.fn()
    const filters: CompanyFilters = {
      client: 'all',
      status: 'active',
      industry: ['it'], // уже есть
      municipalityId: [],
      sizeCategory: [],
    }

    render(
      <SmartSearch filters={filters} onFiltersChange={onFiltersChange} onSelectCompany={onSelectCompany} />,
      { wrapper: createWrapper() }
    )

    const input = screen.getByPlaceholderText('Название, ИНН, отрасль, город')
    await userEvent.type(input, 'ит')

    await waitFor(() => {
      expect(screen.getByText('ИТ')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('ИТ'))

    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalled()
    })

    const lastCall = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0]
    // Не должно быть дубликата
    expect(lastCall.industry).toBeUndefined() // не обновляется, т.к. уже есть
  })
})

describe('SmartSearch Enter key behavior', () => {
  it('applies filter when pressing Enter on "мал"', async () => {
    const onFiltersChange = vi.fn()
    const onSelectCompany = vi.fn()
    const filters: CompanyFilters = {
      client: 'ours',
      status: 'active',
      industry: [],
      municipalityId: [],
      sizeCategory: [],
      revenueMin: 1000000,
    }

    render(
      <SmartSearch filters={filters} onFiltersChange={onFiltersChange} onSelectCompany={onSelectCompany} />,
      { wrapper: createWrapper() }
    )

    const input = screen.getByPlaceholderText('Название, ИНН, отрасль, город')
    await userEvent.type(input, 'мал')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalled()
    })

    const lastCall = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0]
    expect(lastCall.sizeCategory).toEqual(['small'])
    expect(lastCall.q).toBeUndefined() // весь текст распознан

    // Другие параметры не затронуты
    expect(lastCall.client).toBeUndefined()
    expect(lastCall.revenueMin).toBeUndefined()
  })

  it('applies multiple filters when pressing Enter on "логист азов"', async () => {
    const onFiltersChange = vi.fn()
    const onSelectCompany = vi.fn()
    const filters: CompanyFilters = {
      client: 'all',
      status: 'active',
      industry: [],
      municipalityId: [],
      sizeCategory: [],
    }

    render(
      <SmartSearch filters={filters} onFiltersChange={onFiltersChange} onSelectCompany={onSelectCompany} />,
      { wrapper: createWrapper() }
    )

    const input = screen.getByPlaceholderText('Название, ИНН, отрасль, город')
    await userEvent.type(input, 'логист азов')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalled()
    })

    const lastCall = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0]
    expect(lastCall.industry).toEqual(['logistics'])
    // Азов может быть город (id=1) или район (id=2), проверяем что хотя бы один добавлен
    expect(lastCall.municipalityId).toBeDefined()
    expect(lastCall.municipalityId!.length).toBeGreaterThan(0)
    expect(lastCall.q).toBeUndefined() // весь текст распознан
  })

  it('sets q when pressing Enter on unrecognized text "Южный ветер"', async () => {
    const onFiltersChange = vi.fn()
    const onSelectCompany = vi.fn()
    const filters: CompanyFilters = {
      client: 'all',
      status: 'active',
      industry: [],
      municipalityId: [],
      sizeCategory: [],
    }

    render(
      <SmartSearch filters={filters} onFiltersChange={onFiltersChange} onSelectCompany={onSelectCompany} />,
      { wrapper: createWrapper() }
    )

    const input = screen.getByPlaceholderText('Название, ИНН, отрасль, город')
    await userEvent.type(input, 'Южный ветер')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalled()
    })

    const lastCall = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0]
    expect(lastCall.q).toBe('Южный ветер')
    expect(lastCall.industry).toBeUndefined()
    expect(lastCall.municipalityId).toBeUndefined()
  })

  it('sets q for INN when pressing Enter on "0123456789"', async () => {
    const onFiltersChange = vi.fn()
    const onSelectCompany = vi.fn()
    const filters: CompanyFilters = {
      client: 'all',
      status: 'active',
      industry: [],
      municipalityId: [],
      sizeCategory: [],
    }

    render(
      <SmartSearch filters={filters} onFiltersChange={onFiltersChange} onSelectCompany={onSelectCompany} />,
      { wrapper: createWrapper() }
    )

    const input = screen.getByPlaceholderText('Название, ИНН, отрасль, город')
    await userEvent.type(input, '0123456789')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalled()
    })

    const lastCall = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0]
    expect(lastCall.q).toBe('0123456789')
  })

  it('applies mixed text: "мал Южный ветер" → sizeCategory + q', async () => {
    const onFiltersChange = vi.fn()
    const onSelectCompany = vi.fn()
    const filters: CompanyFilters = {
      client: 'all',
      status: 'active',
      industry: [],
      municipalityId: [],
      sizeCategory: [],
    }

    render(
      <SmartSearch filters={filters} onFiltersChange={onFiltersChange} onSelectCompany={onSelectCompany} />,
      { wrapper: createWrapper() }
    )

    const input = screen.getByPlaceholderText('Название, ИНН, отрасль, город')
    await userEvent.type(input, 'мал Южный ветер')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalled()
    })

    const lastCall = onFiltersChange.mock.calls[onFiltersChange.mock.calls.length - 1][0]
    expect(lastCall.sizeCategory).toEqual(['small'])
    expect(lastCall.q).toBe('Южный ветер') // нераспознанная часть
  })
})
