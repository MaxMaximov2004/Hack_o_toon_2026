import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CALC_PARAMS,
  calcParamsToBody,
  calcParamsToQuery,
  queryToCalcParams,
  type CalcParams,
} from './calcParams'

const parse = (q: string) => queryToCalcParams(new URLSearchParams(q))

describe('calcParams: URL ↔ параметры', () => {
  it('пустой URL — умолчания: Южный, Базовый, все три этапа, 12 мес, предоплата', () => {
    expect(parse('')).toEqual(DEFAULT_CALC_PARAMS)
    expect(calcParamsToQuery(DEFAULT_CALC_PARAMS)).toBe('')
  })

  it('туда и обратно без потерь', () => {
    const params: CalcParams = {
      regionId: 5, level: 'expert', stages: ['pnr'], urgent: true, uniqueSolution: true,
      financing: 'leasing', termMonths: 24,
      items: [{ componentId: 'el_01', qty: 10 }, { componentId: 'vn_02', qty: 6, nonStandard: true }],
    }
    const query = calcParamsToQuery(params)
    expect(query).toBe(
      'region=5&level=expert&stage=pnr&urgent=true&unique=true&financing=leasing&term=24&item=el_01%3A10&item=vn_02%3A6%3Ans'
    )
    expect(parse(query)).toEqual(params)
  })

  it('ни одного этапа — stage=none, а не умолчание', () => {
    const params = { ...DEFAULT_CALC_PARAMS, stages: [] }
    expect(calcParamsToQuery(params)).toBe('stage=none')
    expect(parse('stage=none').stages).toEqual([])
  })

  it('те же этапы в другом порядке — умолчание, в URL не пишем', () => {
    expect(calcParamsToQuery({ ...DEFAULT_CALC_PARAMS, stages: ['shef', 'pir', 'pnr'] })).toBe('')
  })

  it('битая ссылка: мусор → умолчания, плохие и повторные позиции пропускаются', () => {
    const p = parse('region=abc&term=-5&financing=credit&item=el_01:0&item=:3&item=ht_01:2&item=ht_01:7&item=ws_01:x')
    expect(p.regionId).toBe(3)
    expect(p.termMonths).toBe(12)
    expect(p.financing).toBe('prepay')
    expect(p.items).toEqual([{ componentId: 'ht_01', qty: 2 }])
  })
})

describe('calcParamsToBody', () => {
  it('тело запроса по ТЗ 14, свои позиции — из состояния', () => {
    const custom = [{ name: 'ПО диспетчеризации', unit: 'лиц.', unitPrice: 150000, qty: 1 }]
    const body = calcParamsToBody(parse('item=el_01:10&urgent=true'), custom)
    expect(body).toEqual({
      regionId: 3, level: 'basic', termMonths: 12, financing: 'prepay', stages: ['pir', 'pnr', 'shef'],
      items: [{ componentId: 'el_01', qty: 10 }], customItems: custom, urgent: true, uniqueSolution: false,
    })
  })
})
