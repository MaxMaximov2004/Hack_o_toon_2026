import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WhereWorks } from './WhereWorks'
import * as endpoints from '../api/endpoints'
import { mockDictionaries } from '../mocks/fixtures'
import type { CompanyLocations } from '../api/types'

vi.mock('../api/endpoints')
const auth = vi.hoisted(() => ({ roles: ['user'] as string[] }))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { roles: auth.roles } }) }))

const registeredOnly: CompanyLocations = {
  registered: { municipalityName: 'Сальск', settlement: null, lat: 46.47, lon: 41.54 },
  actual: [],
  relocated: false,
}
const relocated: CompanyLocations = {
  ...registeredOnly,
  relocated: true,
  actual: [
    { id: 7, municipalityName: 'Азов', regionName: null, address: 'ул. Ленина, 1', lat: 47.1, lon: 39.4,
      source: 'manager', confidence: 0.8, note: 'со слов директора', createdAt: '2026-10-24T10:12:00Z' },
    { id: 5, municipalityName: null, regionName: 'Краснодарский край', address: null, lat: null, lon: null,
      source: 'crm', confidence: 0.9, note: null, createdAt: '2026-10-23T09:00:00Z' },
  ],
}

function renderBlock() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <WhereWorks companyId={42} />
    </QueryClientProvider>
  )
}

describe('WhereWorks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.roles = ['user']
    vi.mocked(endpoints.getDictionaries).mockResolvedValue(mockDictionaries)
    vi.mocked(endpoints.getCompanyLocations).mockResolvedValue(registeredOnly)
    vi.mocked(endpoints.addCompanyLocation).mockResolvedValue(relocated.actual[0])
    vi.mocked(endpoints.deleteCompanyLocation).mockResolvedValue()
  })

  it('регистрация и подсказка, если факта нет', async () => {
    renderBlock()
    expect(await screen.findByText('Сальск')).toBeInTheDocument()
    expect(screen.getByText(/Фактический адрес неизвестен/)).toBeInTheDocument()
  })

  it('факт с источником и уверенностью; менеджер удаляет только своё', async () => {
    vi.mocked(endpoints.getCompanyLocations).mockResolvedValue(relocated)
    renderBlock()
    expect(await screen.findByText('Азов, ул. Ленина, 1')).toBeInTheDocument()
    expect(screen.getByText(/менеджер · уверенность 80 %/)).toBeInTheDocument()
    expect(screen.getByText(/CRM \/ биллинг РТ · уверенность 90 %/)).toBeInTheDocument()
    expect(screen.getByText(/Работает не там, где зарегистрирована/)).toBeInTheDocument()
    const deletes = screen.getAllByRole('button', { name: 'Удалить место' })
    expect(deletes).toHaveLength(1)
    fireEvent.click(deletes[0])
    await waitFor(() => expect(endpoints.deleteCompanyLocation).toHaveBeenCalledWith(42, 7))
  })

  it('админ может удалить и место из CRM', async () => {
    auth.roles = ['user', 'admin']
    vi.mocked(endpoints.getCompanyLocations).mockResolvedValue(relocated)
    renderBlock()
    await screen.findByText('Азов, ул. Ленина, 1')
    expect(screen.getAllByRole('button', { name: 'Удалить место' })).toHaveLength(2)
  })

  it('«Указать фактическое место»: район из справочника → POST', async () => {
    renderBlock()
    fireEvent.click(await screen.findByText('Указать фактическое место'))
    const save = screen.getByRole('button', { name: 'Сохранить' })
    expect(save).toBeDisabled()
    await screen.findByRole('option', { name: 'Азов' })
    fireEvent.change(screen.getByLabelText('Район / город'), { target: { value: 'Азов' } })
    fireEvent.change(screen.getByLabelText('Адрес (необязательно)'), { target: { value: 'ул. Ленина, 1' } })
    fireEvent.click(save)
    await waitFor(() =>
      expect(endpoints.addCompanyLocation).toHaveBeenCalledWith(42, {
        municipalityName: 'Азов', address: 'ул. Ленина, 1', note: undefined,
      })
    )
  })

  it('другой регион — текстом', async () => {
    renderBlock()
    fireEvent.click(await screen.findByText('Указать фактическое место'))
    fireEvent.click(screen.getByLabelText('Другой регион'))
    fireEvent.change(screen.getByLabelText('Регион'), { target: { value: ' Краснодарский край ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() =>
      expect(endpoints.addCompanyLocation).toHaveBeenCalledWith(42, {
        regionName: 'Краснодарский край', address: undefined, note: undefined,
      })
    )
  })
})
