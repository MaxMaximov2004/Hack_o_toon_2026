import type { CustomItemInput, EstimateItemInput, EstimateRequest, Financing } from './types'

/**
 * Параметры расчёта = URL (как фильтр Навигатора): ссылкой можно поделиться, «назад» не засоряется (replace).
 * Свои позиции (customItems) в URL не пишем — только в состоянии страницы.
 *
 *   region=3 level=advanced stage=pir&stage=pnr (stage=none — ни одного этапа)
 *   urgent=true unique=true financing=leasing term=24
 *   item=el_01:10&item=vn_02:6:ns   (id:количество[:ns — нестандарт])
 *
 * Значения по умолчанию в URL не пишем — короче ссылки и ключи кэша.
 */

export interface CalcParams {
  regionId: number
  level: string
  stages: string[]
  urgent: boolean
  uniqueSolution: boolean
  financing: Financing
  termMonths: number
  items: EstimateItemInput[]
}

export const FINANCING_OPTIONS: { value: Financing; label: string }[] = [
  { value: 'prepay', label: 'Предоплата' },
  { value: 'installment', label: 'Рассрочка' },
  { value: 'leasing', label: 'Лизинг' },
]

const ALL_STAGES = ['pir', 'pnr', 'shef']

export const DEFAULT_CALC_PARAMS: CalcParams = {
  regionId: 3, // «Южный» — Ростовская область (calc.region_coef, infra/db/init/03_seed.sql)
  level: 'basic',
  stages: ALL_STAGES,
  urgent: false,
  uniqueSolution: false,
  financing: 'prepay',
  termMonths: 12,
  items: [],
}

const NO_STAGES = 'none'

function positiveInt(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined
  const n = Number(value)
  return n >= 1 ? n : undefined
}

export function queryToCalcParams(search: URLSearchParams): CalcParams {
  const d = DEFAULT_CALC_PARAMS

  const stageValues = search.getAll('stage')
  const stages = stageValues.length === 0 ? d.stages : stageValues.filter((s) => s !== NO_STAGES)

  const financing = search.get('financing')
  const items: EstimateItemInput[] = []
  for (const raw of search.getAll('item')) {
    const [componentId, qtyRaw, flag] = raw.split(':')
    const qty = positiveInt(qtyRaw ?? null)
    // Битые и повторные позиции из ссылки пропускаем: calc-service ответил бы 400 на дубликат
    if (!componentId || qty === undefined || items.some((i) => i.componentId === componentId)) continue
    items.push(flag === 'ns' ? { componentId, qty, nonStandard: true } : { componentId, qty })
  }

  return {
    regionId: positiveInt(search.get('region')) ?? d.regionId,
    level: search.get('level') || d.level,
    stages,
    urgent: search.get('urgent') === 'true',
    uniqueSolution: search.get('unique') === 'true',
    financing: FINANCING_OPTIONS.some((o) => o.value === financing) ? (financing as Financing) : d.financing,
    termMonths: positiveInt(search.get('term')) ?? d.termMonths,
    items,
  }
}

export function calcParamsToQuery(params: CalcParams): string {
  const d = DEFAULT_CALC_PARAMS
  const query = new URLSearchParams()

  if (params.regionId !== d.regionId) query.set('region', String(params.regionId))
  if (params.level !== d.level) query.set('level', params.level)

  const sameStages =
    params.stages.length === d.stages.length && d.stages.every((s) => params.stages.includes(s))
  if (!sameStages) {
    if (params.stages.length === 0) query.append('stage', NO_STAGES)
    params.stages.forEach((s) => query.append('stage', s))
  }

  if (params.urgent) query.set('urgent', 'true')
  if (params.uniqueSolution) query.set('unique', 'true')
  if (params.financing !== d.financing) query.set('financing', params.financing)
  if (params.termMonths !== d.termMonths) query.set('term', String(params.termMonths))

  params.items.forEach((i) => query.append('item', `${i.componentId}:${i.qty}${i.nonStandard ? ':ns' : ''}`))

  return query.toString()
}

/** Тело POST /api/calc/estimate (и CSV, и КП) — одно на расчёт и выгрузки, чтобы файл совпадал с экраном */
export function calcParamsToBody(params: CalcParams, customItems: CustomItemInput[]): EstimateRequest {
  return {
    regionId: params.regionId,
    level: params.level,
    termMonths: params.termMonths,
    financing: params.financing,
    stages: params.stages,
    items: params.items,
    customItems,
    urgent: params.urgent,
    uniqueSolution: params.uniqueSolution,
  }
}
