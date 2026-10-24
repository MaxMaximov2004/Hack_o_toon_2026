import type { Dictionaries, Subscription } from '../api/types'

/**
 * Подписка человеческим текстом: «Транспорт и логистика · г. Ростов-на-Дону»,
 * «Физическая безопасность · стадия Строительство». Пока справочник не загружен — коды.
 */
export function describeSubscription(sub: Subscription, dict: Dictionaries | undefined): string {
  const parts: string[] = []
  if (sub.industry) {
    parts.push(dict?.industries.find((i) => i.code === sub.industry)?.name ?? sub.industry)
  }
  if (sub.municipalityId !== null) {
    parts.push(
      dict?.municipalities.find((m) => m.id === sub.municipalityId)?.name ?? `район №${sub.municipalityId}`
    )
  }
  if (sub.need) {
    parts.push(dict?.needs.find((n) => n.code === sub.need)?.name ?? sub.need)
  }
  if (sub.stage) {
    parts.push(`стадия ${dict?.stages.find((st) => st.code === sub.stage)?.name ?? sub.stage}`)
  }
  return parts.join(' · ')
}
