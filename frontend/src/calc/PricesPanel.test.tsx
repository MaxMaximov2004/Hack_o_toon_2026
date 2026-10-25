import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PricesPanel, describePrices } from './PricesPanel'
import * as api from './api'
import type { PricesStatus } from './types'

vi.mock('./api')
const auth = vi.hoisted(() => ({ roles: ['manager'] as string[] }))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { roles: auth.roles } }) }))

const last: NonNullable<PricesStatus['last']> = {
  status: 'ok',
  startedAt: '2026-10-25T01:29:12+00:00',
  finishedAt: '2026-10-25T01:29:28+00:00',
  details: {
    rt: {
      video: { origin: 'online', date: '2026-06-01', parsed: 18, updated: 18, added: [] },
      vats: { origin: 'копия из репозитория', date: '2026-05-01', parsed: 7, updated: 7, added: [] },
    },
    market: { found: 5, missing: [], errors: [] },
  },
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <PricesPanel />
    </QueryClientProvider>
  )
}

describe('PricesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.roles = ['manager']
    vi.mocked(api.getPricesStatus).mockResolvedValue({ running: false, last })
  })

  it('описание: даты прайсов, копия при недоступном сайте, число аналогов', () => {
    expect(describePrices(last)).toBe(
      'Прайсы Ростелекома: видеонаблюдение от 01.06.2026, ВАТС от 01.05.2026 (сайт недоступен — сохранённая копия); ' +
        'рыночные аналоги tinko.ru — 5 камер'
    )
  })

  it('менеджер видит, откуда цены, но без кнопки обновления', async () => {
    renderPanel()
    expect(await screen.findByText(/Прайсы Ростелекома: видеонаблюдение/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Обновить цены' })).not.toBeInTheDocument()
  })

  it('админ запускает обновление; когда парсинг закончился — тост', async () => {
    auth.roles = ['admin']
    vi.mocked(api.postPricesRefresh).mockResolvedValue()
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Обновить цены' }))
    await waitFor(() => expect(api.postPricesRefresh).toHaveBeenCalled())
    expect(await screen.findByText('Цены обновлены', {}, { timeout: 4000 })).toBeInTheDocument()
  })
})
