import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NotificationBell } from './NotificationBell'
import * as endpoints from '../api/endpoints'
import type { NotificationsResponse } from '../api/types'

vi.mock('../api/endpoints')

const feed: NotificationsResponse = {
  unreadCount: 1,
  items: [
    {
      id: 31, projectId: 7, title: 'Демо: логистический центр', municipalityName: 'г. Ростов-на-Дону',
      subscriptionId: 12, isRead: false, sentToTelegram: true, createdAt: new Date().toISOString(),
    },
    {
      id: 30, projectId: 3, title: 'Старый проект', municipalityName: null,
      subscriptionId: 7, isRead: true, sentToTelegram: false, createdAt: '2026-01-01T00:00:00Z',
    },
  ],
}

function NavigatorStub() {
  const location = useLocation()
  return <div data-testid="navigator">{JSON.stringify(location.state)}</div>
}

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <NotificationBell />
        <Routes>
          <Route path="/" element={null} />
          <Route path="/navigator" element={<NavigatorStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(endpoints.getNotifications).mockResolvedValue(feed)
    vi.mocked(endpoints.markNotificationRead).mockResolvedValue()
    vi.mocked(endpoints.markAllNotificationsRead).mockResolvedValue()
  })

  it('показывает число непрочитанных', async () => {
    renderBell()
    expect(await screen.findByTestId('unread-count')).toHaveTextContent('1')
  })

  it('без непрочитанных — без кружка; пустая лента — подсказка', async () => {
    vi.mocked(endpoints.getNotifications).mockResolvedValue({ items: [], unreadCount: 0 })
    renderBell()
    fireEvent.click(await screen.findByRole('button', { name: 'Уведомления' }))
    expect(await screen.findByText(/Уведомлений нет/)).toBeInTheDocument()
    expect(screen.queryByTestId('unread-count')).not.toBeInTheDocument()
  })

  it('клик по уведомлению: прочитано + переход в Навигатор с openProjectId', async () => {
    renderBell()
    fireEvent.click(await screen.findByRole('button', { name: /1 непрочитанных/ }))
    fireEvent.click(await screen.findByText('Демо: логистический центр'))
    await waitFor(() => expect(endpoints.markNotificationRead).toHaveBeenCalledWith(31, expect.anything()))
    expect(await screen.findByTestId('navigator')).toHaveTextContent('{"openProjectId":7}')
  })

  it('прочитанное повторно не отмечается', async () => {
    renderBell()
    fireEvent.click(await screen.findByRole('button', { name: /непрочитанных/ }))
    fireEvent.click(await screen.findByText('Старый проект'))
    expect(await screen.findByTestId('navigator')).toHaveTextContent('{"openProjectId":3}')
    expect(endpoints.markNotificationRead).not.toHaveBeenCalled()
  })

  it('«Прочитать все»', async () => {
    renderBell()
    fireEvent.click(await screen.findByRole('button', { name: /непрочитанных/ }))
    fireEvent.click(await screen.findByText('Прочитать все'))
    await waitFor(() => expect(endpoints.markAllNotificationsRead).toHaveBeenCalled())
  })
})
