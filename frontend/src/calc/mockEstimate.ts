import type { BreakdownStep, CalcCatalog, EstimateLine, EstimateRequest, EstimateResponse } from './types'

/**
 * Расчёт для MSW — повторяет calc-service (app/engine.py) как есть, включая известные расхождения с ТЗ 14
 * (ставка финансирования только по сроку, минимум с min_margin как множителем, наценка за нестандарт вне цены),
 * чтобы с моками экран показывал те же цифры, что на стенде. Аналоги — из снятого ответа (calc-estimate.json).
 */

export class MockValidationError extends Error {
  constructor(message: string, readonly field: string) {
    super(message)
  }
}

// Decimal ROUND_HALF_UP до копеек; EPSILON — от ошибок двоичной дроби (0.125 → 0.13, а не 0.12)
const r2 = (v: number) => Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100

export function mockEstimate(
  body: EstimateRequest,
  catalog: CalcCatalog,
  analogs: EstimateResponse['analogs']
): EstimateResponse {
  const components = Object.values(catalog.components).flat()
  const region = catalog.regions.find((r) => r.id === body.regionId)
  const level = catalog.levels.find((l) => l.code === body.level)
  if (!region) throw new MockValidationError(`Неизвестный регион: ${body.regionId}`, 'items')
  if (!level) throw new MockValidationError(`Неизвестный уровень: ${body.level}`, 'items')
  const stages = body.stages.map((code) => catalog.stages.find((s) => s.code === code))
  if (stages.some((s) => !s)) throw new MockValidationError(`Неизвестные этапы: ${body.stages}`, 'items')
  body.items.forEach((item, i) => {
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 100000) {
      throw new MockValidationError('Ошибка валидации', `items.${i}.qty`)
    }
  })
  if (body.items.some((i) => !components.some((c) => c.id === i.componentId))) {
    throw new MockValidationError(`Неизвестные компоненты: ${body.items.map((i) => i.componentId)}`, 'items')
  }
  const seen = new Set<string>()
  body.items.forEach((item, i) => {
    if (seen.has(item.componentId)) throw new MockValidationError(`Дубликат позиции [${i}]: ${item.componentId}`, 'items')
    seen.add(item.componentId)
  })

  const p = catalog.pricingParams
  const uniqueMarkup = p.uniqueMarkup / 100
  const nonStandardMarkup = p.nonStandardMarkup / 100

  const terms = Object.keys(p.financingRates).map(Number).sort((a, b) => a - b)
  const rateTerm = terms.find((t) => body.termMonths <= t) ?? terms[terms.length - 1]
  const rate = p.financingRates[String(rateTerm)] / 100

  const lines: EstimateLine[] = []
  let equipment = 0
  let nonStandardTotal = 0
  for (const item of body.items) {
    const c = components.find((x) => x.id === item.componentId)!
    const lineTotal = item.qty * c.base_price * c.complexity
    const nsExtra = item.nonStandard ? lineTotal * nonStandardMarkup : 0
    equipment += lineTotal
    nonStandardTotal += nsExtra
    lines.push({
      componentId: c.id, name: c.name, unit: c.unit, qty: item.qty, unitPrice: c.base_price,
      complexity: c.complexity, lineTotal: r2(lineTotal), nonStandardMarkup: nsExtra ? r2(nsExtra) : 0,
      isNonStandard: !!item.nonStandard,
    })
  }
  for (const ci of body.customItems) {
    const complexity = ci.complexity ?? 1
    const lineTotal = ci.qty * ci.unitPrice * complexity
    equipment += lineTotal
    nonStandardTotal += lineTotal * nonStandardMarkup
    lines.push({
      name: ci.name, unit: ci.unit, qty: ci.qty, unitPrice: ci.unitPrice, complexity, lineTotal: r2(lineTotal),
      nonStandardMarkup: r2(lineTotal * nonStandardMarkup), isNonStandard: true, isCustom: true,
    })
  }

  // Скидка за объём — по сумме оборудования до округления, ступень — наибольший порог не выше суммы
  let volumeDiscount = 0
  Object.keys(p.volumeDiscounts)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((threshold) => {
      if (equipment >= threshold) volumeDiscount = p.volumeDiscounts[String(threshold)] / 100
    })

  equipment = r2(equipment)
  const works = r2(equipment * stages.reduce((sum, s) => sum + s!.share_of_equipment, 0))
  const direct = r2(equipment + works)

  const P1 = r2(direct * region.coef)
  const P2 = r2(P1 * level.coef)
  const P3 = r2(P2 * (body.urgent ? 1.2 : 1))
  const P4 = r2(body.uniqueSolution ? P3 * (1 + uniqueMarkup) : P3)
  const P5 = r2(P4 * (1 + (rate * body.termMonths) / 12))
  const P6 = r2(P5 * (1 - volumeDiscount))
  const optimal = P6

  const breakdown: BreakdownStep[] = [
    { key: 'direct', label: 'Прямые затраты (себестоимость)', amount: direct },
    { key: 'region', label: `Регион: ${region.name}`, amount: r2(P1 - direct) },
    { key: 'level', label: `Уровень: ${level.name}`, amount: r2(P2 - P1) },
    body.urgent
      ? { key: 'urgent', label: 'Срочность × 1.2', amount: r2(P3 - P2) }
      : { key: 'urgent', label: 'Срочность', amount: 0 },
    { key: 'unique', label: 'Уникальное решение', amount: body.uniqueSolution ? r2(P4 - P3) : 0 },
    { key: 'financing', label: `Финансирование (${body.financing}, ${body.termMonths} мес)`, amount: r2(P5 - P4) },
    volumeDiscount > 0
      ? { key: 'volume', label: `Скидка за объём (${(volumeDiscount * 100).toFixed(1)}%)`, amount: -r2(P5 * volumeDiscount) }
      : { key: 'volume', label: 'Скидка за объём', amount: 0 },
  ]
  if (nonStandardTotal > 0) {
    breakdown.push({ key: 'non_standard', label: 'Наценка за нестандартные позиции', amount: r2(nonStandardTotal) })
  }

  const max = r2(optimal * p.maxFactor)
  const margin = (price: number) => (price === 0 ? 0 : r2(((price - direct) / price) * 100))

  let min: number
  let minBasis: string
  const dist = analogs.distribution as { p25?: number }
  if (analogs.available && analogs.count >= 5 && dist.p25 !== undefined) {
    const lower = direct * (1 + p.minMargin)
    const upper = optimal * 0.95
    min = r2(Math.min(Math.max(dist.p25, lower), upper))
    minBasis = 'analogs_p25'
  } else {
    min = r2(optimal * 0.9)
    minBasis = 'fallback_0.9'
  }

  let low = min * 0.95
  let high = max * 1.05
  if (low === high) {
    low = min
    high = max
  }
  const step = (high - low) / 19
  const curve = Array.from({ length: 20 }, (_, i) => {
    const price = r2(low + step * i)
    return { price, marginPct: margin(price) }
  })

  const assumptions: string[] = []
  if (minBasis === 'fallback_0.9') assumptions.push('Минимальная цена рассчитана как optimal × 0.9 (аналогов недостаточно)')
  if (!analogs.available) assumptions.push('Аналоги недоступны — расчёт минимума по запасному правилу')
  assumptions.push(`Максимальная цена: optimal × ${p.maxFactor} (допущение)`)
  assumptions.push(`Наценка за нестандарт: ${(nonStandardMarkup * 100).toFixed(1)}%`)
  assumptions.push(`Наценка за уникальное решение: ${(uniqueMarkup * 100).toFixed(1)}%`)

  return {
    items: lines,
    costs: { equipment, works, direct },
    price: { min, optimal, max, minBasis, urgent: body.urgent ? P3 : null },
    margin: { minPct: margin(min), optimalPct: margin(optimal), maxPct: margin(max), curve },
    breakdown,
    analogs,
    assumptions,
  }
}
