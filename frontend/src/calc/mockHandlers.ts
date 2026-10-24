import { http, HttpResponse } from 'msw'
import { mockEstimate, MockValidationError } from './mockEstimate'
import type { CalcCatalog, EstimateRequest, EstimateResponse } from './types'
import catalogFixture from '../mocks/fixtures/calc-catalog.json'
import estimateFixture from '../mocks/fixtures/calc-estimate.json'
// Ответ analogs.py при недоступном core-api
import analogsOffFixture from '../mocks/fixtures/calc-analogs-off.json'
// СИНТЕТИКА: на стенде аналогов всегда 63, «мало» (< 5) не получить. Собрано из реального ответа: 3 ближайших
// проекта, count = 3, перцентили по их ИТ-бюджетам той же формулой, что _percentiles в analogs.py
import analogsFewFixture from '../mocks/fixtures/calc-analogs-few.synthetic.json'
// КП, снятое со стенда (POST /api/calc/proposal) — мок отдаёт его как есть
import proposalUrl from '../mocks/fixtures/calc-proposal.docx?url'

const catalog = catalogFixture as CalcCatalog
type Analogs = EstimateResponse['analogs']
const ANALOGS: Record<string, Analogs> = {
  real: (estimateFixture as EstimateResponse).analogs,
  off: analogsOffFixture as Analogs,
  few: analogsFewFixture as Analogs,
}

/**
 * Состояние аналогов для ручной проверки дашборда: sessionStorage['calc-mock-analogs'] = 'off' | 'few'.
 * Только в режиме моков — в обычном режиме эти хендлеры не регистрируются, а флаг не читается.
 */
export function mockAnalogs(): Analogs {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return ANALOGS.real
  let flag: string | null = null
  try {
    flag = sessionStorage.getItem('calc-mock-analogs')
  } catch {
    // Приватный режим — без флага
  }
  return (flag && ANALOGS[flag]) || ANALOGS.real
}

const today = () => new Date().toISOString().slice(0, 10)

const attachment = (filename: string) => `attachment; filename="${filename}"; filename*=UTF-8''${filename}`

function estimateOrError(body: EstimateRequest): EstimateResponse | Response {
  try {
    return mockEstimate(body, catalog, mockAnalogs())
  } catch (e) {
    if (e instanceof MockValidationError) {
      return HttpResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: e.message, details: { field: e.field } } },
        { status: 400 }
      )
    }
    throw e
  }
}

const num = (v: number) => v.toFixed(2).replace('.', ',')

function toCsv(e: EstimateResponse): string {
  const rows = [
    ['№', 'Наименование', 'Ед.изм.', 'Кол-во', 'Цена за ед.', 'Сумма'],
    ...e.items.map((item, i) => [String(i + 1), item.name, item.unit, String(item.qty), num(item.unitPrice), num(item.lineTotal)]),
    [],
    ['', 'Прямые затраты', '', '', '', num(e.costs.direct)],
    ['Минимум', '', '', '', '', num(e.price.min)],
    ['Оптимум', '', '', '', '', num(e.price.optimal)],
    ['Максимум', '', '', '', '', num(e.price.max)],
  ]
  return '﻿' + rows.map((r) => r.join(';')).join('\r\n')
}

/** calc-service для VITE_USE_MOCKS=true: каталог и аналоги — снятые ответы, расчёт — mockEstimate */
export const calcHandlers = [
  http.get('/api/calc/catalog', () => HttpResponse.json(catalog)),

  http.post('/api/calc/estimate', async ({ request }) => {
    const result = estimateOrError((await request.json()) as EstimateRequest)
    return result instanceof Response ? result : HttpResponse.json(result)
  }),

  http.post('/api/calc/export/csv', async ({ request }) => {
    const result = estimateOrError((await request.json()) as EstimateRequest)
    if (result instanceof Response) return result
    return new HttpResponse(toCsv(result), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': attachment(`estimate_${today()}.csv`),
      },
    })
  }),

  http.post('/api/calc/proposal', async ({ request }) => {
    const result = estimateOrError((await request.json()) as EstimateRequest)
    if (result instanceof Response) return result
    const docx = await fetch(proposalUrl).then((r) => r.arrayBuffer())
    return new HttpResponse(docx, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': attachment(`radar_proposal_${today()}.docx`),
      },
    })
  }),
]
