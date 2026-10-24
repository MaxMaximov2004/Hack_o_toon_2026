/**
 * «только что», «5 мин назад», «3 ч назад», «вчера», «4 дн назад», дальше — дата «12.10.2026»
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60_000)

  if (Number.isNaN(diffMin)) return ''
  if (diffMin < 1) return 'только что'
  if (diffMin < 60) return `${diffMin} мин назад`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} ч назад`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'вчера'
  if (diffDays < 7) return `${diffDays} дн назад`
  return date.toLocaleDateString('ru-RU')
}
