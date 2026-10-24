import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ImportClientsDialog } from './ImportClientsDialog'
import * as endpoints from '../api/endpoints'

vi.mock('../api/endpoints')

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ImportClientsDialog onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

const csv = (size = 10) => new File(['x'.repeat(size)], 'clients.csv', { type: 'text/csv' })
const fileInput = () => document.querySelector('input[type=file]') as HTMLInputElement

describe('ImportClientsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(endpoints.importClients).mockResolvedValue({
      rows: 41, matched: 40, notFound: ['6100000000'], mode: 'replace', whiteSpots: 2,
    })
    vi.mocked(endpoints.importLocations).mockResolvedValue({ rows: 3, matched: 2, notFound: [], invalid: ['строка 3: …'] })
  })

  it('без файла кнопка неактивна; replace — предупреждение; результат строкой', async () => {
    renderDialog()
    const upload = screen.getByRole('button', { name: 'Загрузить' })
    expect(upload).toBeDisabled()
    fireEvent.change(fileInput(), { target: { files: [csv()] } })
    fireEvent.click(screen.getByLabelText('Заменить список целиком'))
    expect(screen.getByText(/перестанут считаться нашими/)).toBeInTheDocument()
    fireEvent.click(upload)
    await waitFor(() => expect(endpoints.importClients).toHaveBeenCalledWith(expect.any(File), 'replace'))
    expect(
      await screen.findByText('Загружено 41, найдено 40, не найдено 1: 6100000000; белых пятен: 2')
    ).toBeInTheDocument()
  })

  it('файл больше 10 МБ — не отправляем', async () => {
    renderDialog()
    fireEvent.change(fileInput(), { target: { files: [csv(10 * 1024 * 1024 + 1)] } })
    expect(screen.getByText('Файл больше 10 МБ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Загрузить' })).toBeDisabled()
  })

  it('413 от сервера — «Файл больше 10 МБ»', async () => {
    vi.mocked(endpoints.importClients).mockRejectedValue({ code: 'TOO_LARGE', message: 'Payload too large' })
    renderDialog()
    fireEvent.change(fileInput(), { target: { files: [csv()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить' }))
    expect(await screen.findByText('Файл больше 10 МБ')).toBeInTheDocument()
  })

  it('вкладка «Адреса из CRM» шлёт в /api/locations/import', async () => {
    renderDialog()
    fireEvent.click(screen.getByRole('tab', { name: 'Адреса из CRM' }))
    fireEvent.change(fileInput(), { target: { files: [csv()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить' }))
    await waitFor(() => expect(endpoints.importLocations).toHaveBeenCalled())
    expect(await screen.findByText(/адресов добавлено 2/)).toBeInTheDocument()
    expect(screen.getByText('строка 3: …')).toBeInTheDocument()
  })
})
