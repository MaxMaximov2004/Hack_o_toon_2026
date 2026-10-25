// Типы калькулятора сделок (модуль 3) — по ответам calc-service (app/catalog.py, app/engine.py, app/estimate.py).
// Поля каталога calc-service отдаёт в snake_case (share_of_equipment, base_price) — оставляем как в ответе.

export interface CalcRegion {
  id: number
  name: string
  coef: number
  reason: string | null
}

export interface CalcLevel {
  code: string // basic, advanced, expert
  name: string
  coef: number
  description: string | null
}

export interface CalcStage {
  code: string // pir, pnr, shef
  name: string
  share_of_equipment: number // доля от стоимости оборудования, 0.1 = 10 %
  comment: string | null
}

export interface CalcComponent {
  id: string // el_01 …
  name: string
  unit: string
  base_price: number // рубли
  complexity: number
  // Парсер цен (ETL): источник цены; нет — цена из таблицы кейса. Старый calc-service полей не отдаёт
  price_source?: string | null
  price_url?: string | null
  price_date?: string | null // ISO-дата «Тарифы действуют с …»
  // Рыночный аналог той же серии в магазине
  market_price?: number | null
  market_source?: string | null
  market_note?: string | null
  market_url?: string | null
  market_checked_at?: string | null
}

/** GET /api/calc/prices/status — последний парсинг цен */
export interface PricesStatus {
  running: boolean
  last: {
    status: 'running' | 'ok' | 'failed'
    startedAt: string
    finishedAt: string | null
    details: {
      rt?: Record<string, { origin: string; date: string | null; parsed: number; updated: number; added: string[] }>
      market?: { found: number; missing: string[]; errors: string[] } | null
      error?: string
    } | null
  } | null
}

export interface CalcPricingParams {
  uniqueMarkup: number // %
  nonStandardMarkup: number // %
  financingRates: Record<string, number>
  volumeDiscounts: Record<string, number>
  maxFactor: number
  minMargin: number
  itShare: Record<string, number>
}

export interface CalcCatalogAssumption {
  param: string
  value: number | string
  comment: string
  assumption: boolean
}

export interface CalcCatalog {
  regions: CalcRegion[]
  levels: CalcLevel[]
  stages: CalcStage[]
  components: Record<string, CalcComponent[]> // группа системы → компоненты
  pricingParams: CalcPricingParams
  assumptions: CalcCatalogAssumption[]
}

export type Financing = 'prepay' | 'installment' | 'leasing'

export interface EstimateItemInput {
  componentId: string
  qty: number
  nonStandard?: boolean
}

export interface CustomItemInput {
  name: string
  unit: string
  unitPrice: number
  qty: number
  complexity?: number
}

export interface EstimateRequest {
  regionId: number
  level: string
  termMonths: number
  financing: Financing
  stages: string[]
  items: EstimateItemInput[]
  customItems: CustomItemInput[]
  urgent: boolean
  uniqueSolution: boolean
}

export interface ProposalClient {
  name: string
  inn?: string
  contact?: string
}

export interface EstimateLine {
  componentId?: string // нет у своих позиций
  name: string
  unit: string
  qty: number
  unitPrice: number
  complexity: number
  lineTotal: number
  nonStandardMarkup: number
  isNonStandard: boolean
  isCustom?: boolean
}

export interface BreakdownStep {
  key: string // direct, region, level, urgent, unique, financing, volume, non_standard
  label: string
  amount: number
}

export interface MarginPoint {
  price: number
  marginPct: number
}

export interface AnalogProject {
  id: number | null
  title: string | null
  itBudget: number
  industry: string
  distance: number
}

export interface AnalogDistribution {
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

export interface EstimateResponse {
  items: EstimateLine[]
  costs: { equipment: number; works: number; direct: number }
  price: {
    min: number
    optimal: number
    max: number
    minBasis: 'analogs_p25' | 'fallback_0.9' | string
    urgent: number | null
  }
  margin: { minPct: number; optimalPct: number; maxPct: number; curve: MarginPoint[] }
  breakdown: BreakdownStep[]
  analogs: {
    available: boolean
    source: string | null
    count: number
    percentile: string | null
    // При available=false приходит пустой объект {}
    distribution: AnalogDistribution | Record<string, never>
    nearest: AnalogProject[]
  }
  assumptions: string[]
}
