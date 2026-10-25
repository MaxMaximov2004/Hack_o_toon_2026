import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CalcPage } from './CalcPage'
import * as calcApi from '../calc/api'
import * as endpoints from '../api/endpoints'
import { mockDictionaries } from '../mocks/fixtures'
import { mockEstimate } from '../calc/mockEstimate'
import type { CalcCatalog, EstimateRequest, EstimateResponse } from '../calc/types'
import catalogFixture from '../mocks/fixtures/calc-catalog.json'
import estimateFixture from '../mocks/fixtures/calc-estimate.json'

vi.mock('../calc/api')
vi.mock('../api/endpoints')
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ user: { fullName: 'Демо' }, logout: vi.fn() }),
}))

const catalog = catalogFixture as CalcCatalog
const analogs = (estimateFixture as EstimateResponse).analogs

function SearchProbe() {
  return <div data-testid="search">{useLocation().search}</div>
}

function renderPage(url = '/calc') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/calc" element={<><CalcPage /><SearchProbe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CalcPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(calcApi.getPricesStatus).mockResolvedValue({ running: false, last: null })
    vi.mocked(calcApi.getCalcCatalog).mockResolvedValue(catalog)
    vi.mocked(calcApi.postEstimate).mockImplementation(async (body: EstimateRequest) => mockEstimate(body, catalog, analogs))
    vi.mocked(endpoints.getDictionaries).mockResolvedValue(mockDictionaries)
    vi.mocked(endpoints.getNotifications).mockResolvedValue({ items: [], unreadCount: 0 })
  })

  it('без позиций — подсказка, расчёт не запрашивается, выгрузки неактивны', async () => {
    renderPage()
    expect(await screen.findByText('Условия сделки')).toBeInTheDocument()
    expect(screen.getByText(/Добавьте оборудование из каталога/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Скачать CSV' })).toBeDisabled()
    expect(calcApi.postEstimate).not.toHaveBeenCalled()
  })

  it('добавили позицию → она в URL → через паузу расчёт с ценой', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Больше: Датчик CO2' }))
    expect(screen.getByTestId('search').textContent).toBe('?item=vn_02%3A1')
    await waitFor(() => expect(calcApi.postEstimate).toHaveBeenCalledTimes(1))
    expect(vi.mocked(calcApi.postEstimate).mock.calls[0][0]).toMatchObject({
      regionId: 3, level: 'basic', items: [{ componentId: 'vn_02', qty: 1 }], customItems: [],
    })
    expect(await screen.findByText('Маржинальность')).toBeInTheDocument()
    expect(screen.getByText('Оптимальная цена')).toBeInTheDocument()
  })

  it('ссылка с параметрами восстанавливает форму и сразу считает', async () => {
    renderPage('/calc?region=5&level=expert&urgent=true&item=el_01%3A10')
    await waitFor(() => expect(calcApi.postEstimate).toHaveBeenCalled())
    expect(vi.mocked(calcApi.postEstimate).mock.calls[0][0]).toMatchObject({
      regionId: 5, level: 'expert', urgent: true, items: [{ componentId: 'el_01', qty: 10 }],
    })
    expect(await screen.findByLabelText('Регион')).toHaveValue('5')
    expect(screen.getByRole('radio', { name: /Экспертный/ })).toBeChecked()
  })

  it('своя позиция уходит в запрос, но не в URL', async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText('Название'), { target: { value: 'ПО' } })
    fireEvent.change(screen.getByLabelText('Цена за ед., ₽'), { target: { value: '1000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить позицию' }))
    await waitFor(() => expect(calcApi.postEstimate).toHaveBeenCalled())
    expect(vi.mocked(calcApi.postEstimate).mock.calls[0][0].customItems).toEqual([
      { name: 'ПО', unit: 'шт.', unitPrice: 1000, qty: 1, complexity: 1 },
    ])
    expect(screen.getByTestId('search').textContent).toBe('')
  })

  it('ошибка расчёта — текст из API', async () => {
    vi.mocked(calcApi.postEstimate).mockRejectedValue({ code: 'VALIDATION_ERROR', message: 'Неизвестный регион: 99' })
    renderPage('/calc?region=99&item=el_01%3A1')
    expect(await screen.findByText('Неизвестный регион: 99')).toBeInTheDocument()
  })

  it('каталог не загрузился — сообщение и «Повторить»', async () => {
    vi.mocked(calcApi.getCalcCatalog).mockRejectedValue({ code: 'UPSTREAM_UNAVAILABLE', message: 'Сервис временно недоступен' })
    renderPage()
    expect(await screen.findByText(/Сервис временно недоступен/)).toBeInTheDocument()
    vi.mocked(calcApi.getCalcCatalog).mockResolvedValue(catalog)
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText('Условия сделки')).toBeInTheDocument()
  })
})
