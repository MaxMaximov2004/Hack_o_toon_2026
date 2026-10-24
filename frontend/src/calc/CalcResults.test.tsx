import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as endpoints from '../api/endpoints'
import { mockDictionaries } from '../mocks/fixtures'
import { KpiStrip } from './KpiStrip'
import { Dashboard } from './Dashboard'
import { Waterfall, buildWaterfall } from './Waterfall'
import { MarginChart, buildScale, nearestPoint } from './MarginChart'
import { AnalogsBlock, labelAt, logPosition } from './AnalogsBlock'
import { ItemsTable, Assumptions } from './EstimateDetails'
import type { EstimateResponse } from './types'
import estimateFixture from '../mocks/fixtures/calc-estimate.json'

vi.mock('../api/endpoints')

const estimate = estimateFixture as EstimateResponse
const plain = (s: string | null) => (s ?? '').replace(/\s/g, ' ')

describe('KpiStrip', () => {
  it('три цены с маржой, ступень среди аналогов и источник минимума', () => {
    render(<KpiStrip estimate={estimate} />)
    expect(screen.getByText('Оптимум')).toBeInTheDocument()
    expect(plain(screen.getByText(/578\s978/).textContent)).toBe('578 978 ₽')
    expect(screen.getByText('маржа 13,4 %')).toBeInTheDocument()
    expect(screen.getByText('выше 10 %')).toBeInTheDocument()
    expect(screen.getByText('и ниже 25 % аналогов, из 63 проектов')).toBeInTheDocument()
    expect(screen.getByText('Минимум — по 25-му перцентилю бюджетов аналогов')).toBeInTheDocument()
  })

  it('отрицательная маржа выделена', () => {
    const loss = { ...estimate, margin: { ...estimate.margin, minPct: -5.82 } }
    render(<KpiStrip estimate={loss} />)
    expect(screen.getByText('маржа -5,8 %').className).toMatch(/negative/)
  })

  it('аналоги недоступны — прочерк вместо ступени', () => {
    const off = { ...estimate, analogs: { available: false, source: null, count: 0, percentile: null, distribution: {}, nearest: [] } }
    render(<KpiStrip estimate={off as EstimateResponse} />)
    expect(screen.getByText('аналоги недоступны')).toBeInTheDocument()
  })
})

describe('Dashboard', () => {
  beforeEach(() => vi.mocked(endpoints.getDictionaries).mockResolvedValue(mockDictionaries))

  it('KPI, вывод одной строкой и четыре блока сетки', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Dashboard estimate={estimate} />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(screen.getByText(/Оптимум 578\s978 ₽ даёт маржу 13,4 %/)).toBeInTheDocument()
    ;['Маржинальность', 'Сравнение с аналогами', 'Из чего складывается цена', 'Позиции'].forEach((t) =>
      expect(screen.getByRole('heading', { name: t })).toBeInTheDocument()
    )
  })
})

describe('Waterfall', () => {
  it('нулевые шаги не рисуются, накопление по порядку, итог — price.optimal', () => {
    const bars = buildWaterfall(estimate.breakdown, estimate.price.optimal)
    expect(bars.map((b) => b.key)).toEqual(['direct', 'region', 'financing', 'non_standard', 'optimal'])
    expect(bars[1]).toMatchObject({ start: 501280, end: 551408, kind: 'up' })
    expect(bars.at(-1)).toMatchObject({ amount: 578978.4, kind: 'total' })
  })

  it('скидка за объём — полоса вниз', () => {
    const bars = buildWaterfall(
      [{ key: 'direct', label: 'Себестоимость', amount: 100 }, { key: 'volume', label: 'Скидка', amount: -10 }],
      90
    )
    expect(bars[1]).toMatchObject({ start: 100, end: 90, kind: 'down' })
  })

  it('подписи шагов из ответа сервиса', () => {
    render(<Waterfall breakdown={estimate.breakdown} optimal={estimate.price.optimal} />)
    expect(screen.getByText('Регион: Южный')).toBeInTheDocument()
    expect(screen.getByText('Оптимальная цена')).toBeInTheDocument()
    expect(screen.queryByText('Срочность')).not.toBeInTheDocument()
  })
})

describe('MarginChart', () => {
  it('ось маржи включает 0, точки внутри области графика', () => {
    const scale = buildScale(estimate.margin.curve)
    expect(scale.minPct).toBe(0)
    estimate.margin.curve.forEach((p) => {
      expect(scale.x(p.price)).toBeGreaterThanOrEqual(40)
      expect(scale.x(p.price)).toBeLessThanOrEqual(348)
    })
  })

  it('ближайшая точка кривой к цене', () => {
    const curve = [{ price: 100, marginPct: 1 }, { price: 200, marginPct: 2 }, { price: 300, marginPct: 3 }]
    expect(nearestPoint(curve, 240)).toEqual({ price: 200, marginPct: 2 })
  })

  it('по умолчанию подпись — оптимум; график с понятным описанием', () => {
    render(<MarginChart estimate={estimate} />)
    expect(plain(screen.getByText(/При цене/).textContent)).toBe('При цене 578 978 ₽ маржа 13,4 %')
    expect(screen.getByRole('group', { name: /^Маржа от/ })).toBeInTheDocument()
  })

  it('отметки — кнопки: нажатие на «Минимум» показывает его цену и маржу; таблица для скринридера', () => {
    render(<MarginChart estimate={estimate} />)
    const min = screen.getByRole('button', { name: /^Минимум: цена 550\s029 ₽, маржа 8,9 %$/ })
    fireEvent.pointerDown(min)
    expect(plain(screen.getByText(/При цене/).textContent)).toBe('При цене 550 029 ₽ маржа 8,9 %')
    expect(screen.getByRole('table', { name: 'Маржа в зависимости от цены сделки' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(estimate.margin.curve.length + 1)
  })
})

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="navigator">{JSON.stringify(location.state)}</div>
}

function renderAnalogs(e: EstimateResponse) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/calc']}>
        <Routes>
          <Route path="/calc" element={<AnalogsBlock estimate={e} />} />
          <Route path="/navigator" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AnalogsBlock', () => {
  beforeEach(() => vi.mocked(endpoints.getDictionaries).mockResolvedValue(mockDictionaries))

  it('подписи на шкале не вылезают за края', () => {
    expect(labelAt(20)).toEqual({ x: 20, textAnchor: 'start' })
    expect(labelAt(340)).toEqual({ x: 340, textAnchor: 'end' })
    expect(labelAt(180)).toEqual({ x: 180, textAnchor: 'middle' })
    // «10 %» у правого края — уже не вправо от точки, а влево
    expect(labelAt(300, 'start')).toEqual({ x: 300, textAnchor: 'end' })
  })

  it('узкое распределение (мало аналогов) — одна подпись диапазона 10–90 %', () => {
    const few = {
      ...estimate,
      analogs: { ...estimate.analogs, count: 3, distribution: { p10: 473600, p25: 476000, p50: 480000, p75: 490000, p90: 496000 } },
    }
    renderAnalogs(few as EstimateResponse)
    expect(screen.getByText(/^10–90 % ·/)).toBeInTheDocument()
    expect(screen.queryByText(/^90 % ·/)).not.toBeInTheDocument()
  })

  it('логарифмическая шкала', () => {
    expect(logPosition(1000, 100, 10000)).toBe(50)
    expect(logPosition(1, 100, 10000)).toBe(0)
  })

  it('ближайшие аналоги с отраслью; «Открыть в Навигаторе» передаёт id проекта', async () => {
    renderAnalogs(estimate)
    expect(await screen.findByText(/Сельское хозяйство/)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Открыть в Навигаторе' })[0])
    expect(screen.getByTestId('navigator').textContent).toBe(JSON.stringify({ openProjectId: estimate.analogs.nearest[0].id }))
  })

  it('нет id у аналога — кнопки нет', () => {
    const noId = { ...estimate, analogs: { ...estimate.analogs, nearest: [{ ...estimate.analogs.nearest[0], id: null }] } }
    renderAnalogs(noId)
    expect(screen.queryByRole('button', { name: 'Открыть в Навигаторе' })).not.toBeInTheDocument()
  })

  it('аналоги недоступны — частичный результат с пояснением', () => {
    const off = {
      ...estimate,
      price: { ...estimate.price, minBasis: 'fallback_0.9' },
      analogs: { available: false, source: null, count: 0, percentile: null, distribution: {}, nearest: [] },
    }
    renderAnalogs(off as EstimateResponse)
    expect(screen.getByText('Аналоги недоступны — минимум посчитан по запасному правилу: оптимум × 0,9.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('подпись без «вашей отрасли», ступень оптимума и таблица для скринридера', () => {
    renderAnalogs(estimate)
    expect(screen.getByText('Сравнение с 63 инвестпроектами области (ориентир по ИТ-бюджетам)')).toBeInTheDocument()
    expect(screen.getByText('выше 10 % и ниже 25 % аналогов')).toBeInTheDocument()
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/^Оптимальная цена 578\s978 ₽ — выше 10 % и ниже 25 % аналогов/)
    const table = screen.getByRole('table', { name: 'ИТ-бюджеты инвестпроектов области и наша цена' })
    expect(table.querySelectorAll('tr')).toHaveLength(6)
    expect(document.body.textContent).not.toMatch(/вашей отрасл/)
  })

  it('ближайшие: разница нашей цены с ИТ-бюджетом в рублях и процентах', () => {
    renderAnalogs(estimate)
    // 578 978,4 − 472 000 = 106 978 ₽, это +22,7 % от бюджета
    expect(screen.getByText((t) => plain(t) === 'наша цена выше на 106 978 ₽ (+22,7 %)')).toBeInTheDocument()
  })

  it('мало аналогов (минимум по запасному правилу) — пояснение', () => {
    const few = { ...estimate, price: { ...estimate.price, minBasis: 'fallback_0.9' }, analogs: { ...estimate.analogs, count: 3 } }
    renderAnalogs(few as EstimateResponse)
    expect(screen.getByText(/Аналогов меньше пяти/)).toBeInTheDocument()
    expect(screen.getByText(/Сравнение с 3 инвестпроектами/)).toBeInTheDocument()
  })
})

describe('ItemsTable / Assumptions', () => {
  it('позиции с пометками «своя позиция» и «нестандарт»', () => {
    render(<ItemsTable estimate={estimate} />)
    expect(screen.getByText('ПО диспетчеризации')).toBeInTheDocument()
    expect(screen.getByText('своя позиция')).toBeInTheDocument()
    expect(screen.getAllByText('нестандарт')).toHaveLength(2)
  })

  it('допущения из ответа и пометка «предварительный»', () => {
    render(<Assumptions estimate={estimate} />)
    expect(screen.getByText('Расчёт предварительный.')).toBeInTheDocument()
    expect(screen.getByText(estimate.assumptions[0])).toBeInTheDocument()
  })
})
