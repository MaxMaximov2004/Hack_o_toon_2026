import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as apiFetchModule from '../api/apiFetch'
import { getCalcCatalog, postEstimate, postEstimateCsv, postProposal } from './api'
import type { EstimateRequest } from './types'

vi.mock('../api/apiFetch', () => ({ apiFetch: vi.fn() }))

const body: EstimateRequest = {
  regionId: 3, level: 'basic', termMonths: 12, financing: 'prepay', stages: ['pir'],
  items: [{ componentId: 'el_01', qty: 10 }], customItems: [], urgent: false, uniqueSolution: false,
}

describe('calc/api', () => {
  beforeEach(() => vi.mocked(apiFetchModule.apiFetch).mockReset())

  it('каталог — GET /api/calc/catalog', async () => {
    await getCalcCatalog()
    expect(apiFetchModule.apiFetch).toHaveBeenCalledWith('/api/calc/catalog')
  })

  it('расчёт — POST с телом JSON', async () => {
    await postEstimate(body)
    expect(apiFetchModule.apiFetch).toHaveBeenCalledWith('/api/calc/estimate', {
      method: 'POST', body: JSON.stringify(body),
    })
  })

  it('CSV — то же тело, ответ файлом', async () => {
    await postEstimateCsv(body)
    expect(apiFetchModule.apiFetch).toHaveBeenCalledWith('/api/calc/export/csv', {
      method: 'POST', body: JSON.stringify(body), responseType: 'blob',
    })
  })

  it('КП — тело расчёта + client (как в ТЗ 14)', async () => {
    await postProposal(body, { name: 'ООО «Ромашка»', inn: '6164000000' })
    const [url, options] = vi.mocked(apiFetchModule.apiFetch).mock.calls[0]
    expect(url).toBe('/api/calc/proposal')
    expect(options).toMatchObject({ method: 'POST', responseType: 'blob' })
    expect(JSON.parse(options!.body as string)).toEqual({ ...body, client: { name: 'ООО «Ромашка»', inn: '6164000000' } })
  })
})
