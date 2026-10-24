import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SubscriptionsPage } from './SubscriptionsPage'
import * as endpoints from '../api/endpoints'
import { mockDictionaries } from '../mocks/fixtures'
import type { Subscription } from '../api/types'

vi.mock('../api/endpoints')
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ user: { fullName: 'Демо' }, logout: vi.fn() }),
}))

const subs: Subscription[] = [
  { id: 12, industry: 'logistics', municipalityId: 1, need: null, stage: null, createdAt: '2026-10-24T09:15:02Z' },
  { id: 7, industry: null, municipalityId: null, need: 'phys_security', stage: 'construction', createdAt: '2026-10-24T08:40:11Z' },
]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SubscriptionsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SubscriptionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(endpoints.getDictionaries).mockResolvedValue(mockDictionaries)
    vi.mocked(endpoints.getSubscriptions).mockResolvedValue(subs)
    vi.mocked(endpoints.getNotifications).mockResolvedValue({ items: [], unreadCount: 0 })
    vi.mocked(endpoints.getTelegramLink).mockResolvedValue({
      botConfigured: true, linked: false, url: 'https://t.me/radar_rt_demo_bot?start=k3J9xQ2mLp',
    })
    vi.mocked(endpoints.createSubscription).mockResolvedValue(subs[0])
    vi.mocked(endpoints.deleteSubscription).mockResolvedValue()
  })

  it('подписки человеческим текстом', async () => {
    renderPage()
    expect(await screen.findByText('Логистика · Ростов-на-Дону')).toBeInTheDocument()
    expect(screen.getByText('Физическая безопасность · стадия Строительство')).toBeInTheDocument()
  })

  it('пустая форма — кнопка неактивна; с отраслью — создаёт', async () => {
    renderPage()
    const submit = await screen.findByRole('button', { name: 'Подписаться' })
    expect(submit).toBeDisabled()
    await screen.findByRole('option', { name: 'ИТ' })
    fireEvent.change(screen.getByLabelText('Отрасль'), { target: { value: 'it' } })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    await waitFor(() =>
      expect(endpoints.createSubscription).toHaveBeenCalledWith({
        industry: 'it', municipalityId: undefined, need: undefined, stage: undefined,
      })
    )
    expect(await screen.findByText('Подписка оформлена')).toBeInTheDocument()
  })

  it('400 от сервера — текст ошибки под формой', async () => {
    vi.mocked(endpoints.createSubscription).mockRejectedValue({ code: 'VALIDATION_ERROR', message: 'Неизвестная стадия' })
    renderPage()
    await screen.findByRole('option', { name: 'Запуск' })
    fireEvent.change(screen.getByLabelText('Стадия'), { target: { value: 'launch' } })
    fireEvent.click(screen.getByRole('button', { name: 'Подписаться' }))
    expect(await screen.findByText('Неизвестная стадия')).toBeInTheDocument()
  })

  it('«Отписаться» удаляет подписку', async () => {
    renderPage()
    const buttons = await screen.findAllByRole('button', { name: 'Отписаться' })
    fireEvent.click(buttons[1])
    await waitFor(() => expect(endpoints.deleteSubscription).toHaveBeenCalledWith(7, expect.anything()))
  })

  it('Telegram: не привязан → ссылка на бота', async () => {
    renderPage()
    const link = await screen.findByRole('link', { name: 'Подключить Telegram' })
    expect(link).toHaveAttribute('href', 'https://t.me/radar_rt_demo_bot?start=k3J9xQ2mLp')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('Telegram: бот не настроен / уже привязан', async () => {
    vi.mocked(endpoints.getTelegramLink).mockResolvedValue({ botConfigured: false, linked: false, url: null })
    renderPage()
    expect(await screen.findByText('Telegram не подключён на сервере')).toBeInTheDocument()
    expect(screen.queryByText('Подключить Telegram')).not.toBeInTheDocument()
  })

  it('Telegram: привязан', async () => {
    vi.mocked(endpoints.getTelegramLink).mockResolvedValue({ botConfigured: true, linked: true, url: null })
    renderPage()
    expect(await screen.findByText('Уведомления приходят в Telegram ✓')).toBeInTheDocument()
  })
})
