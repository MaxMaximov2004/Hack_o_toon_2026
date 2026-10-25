import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { Toast } from '../ui/Toast'
import type { ApiError } from '../api/types'
import { getPricesStatus, postPricesRefresh } from './api'
import type { PricesStatus } from './types'
import styles from './PricesPanel.module.css'

const PRICE_LISTS: Record<string, string> = { video: 'видеонаблюдение', vats: 'ВАТС', wifi: 'Wi-Fi' }

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU')
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** «Прайсы Ростелекома: видеонаблюдение от 01.06.2026, …; рыночные аналоги tinko.ru — 5 камер» */
export function describePrices(last: NonNullable<PricesStatus['last']>): string {
  const rt = Object.entries(last.details?.rt ?? {})
    .map(([key, r]) => `${PRICE_LISTS[key] ?? key}${r.date ? ` от ${formatDate(r.date)}` : ''}`)
    .join(', ')
  const offline = Object.values(last.details?.rt ?? {}).some((r) => r.origin !== 'online')
  const market = last.details?.market
  return [
    rt && `Прайсы Ростелекома: ${rt}${offline ? ' (сайт недоступен — сохранённая копия)' : ''}`,
    market && market.found > 0 && `рыночные аналоги tinko.ru — ${market.found} камер`,
  ]
    .filter(Boolean)
    .join('; ')
}

/** Над каталогом: откуда и когда цены (парсер ETL) и «Обновить цены» для админа */
export function PricesPanel() {
  const { user } = useAuth()
  const isAdmin = !!user?.roles?.includes('admin')
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [waiting, setWaiting] = useState(false)

  const { data, isError } = useQuery({
    queryKey: ['calc-prices-status'],
    queryFn: async () => {
      const status = await getPricesStatus()
      if (waiting && !status.running) {
        setWaiting(false)
        await queryClient.invalidateQueries({ queryKey: ['calc-catalog'] })
        setToast(
          status.last?.status === 'ok'
            ? { message: 'Цены обновлены', type: 'success' }
            : { message: 'Не удалось обновить цены — остались прежние', type: 'error' }
        )
      }
      return status
    },
    refetchInterval: (query) => (waiting || query.state.data?.running ? 2000 : false),
    retry: false,
  })

  const refresh = async () => {
    try {
      await postPricesRefresh()
      setWaiting(true)
    } catch (err) {
      const e = err as ApiError
      if (e?.code === 'CONFLICT') setWaiting(true)        // уже идёт — просто ждём
      else setToast({ message: e?.message ?? 'Не удалось запустить обновление', type: 'error' })
    }
  }

  const running = waiting || !!data?.running
  if (isError && !isAdmin) return null                   // статус недоступен — каталог работает и без него

  return (
    <div className={styles.panel}>
      <p className={styles.text}>
        {running
          ? 'Обновляем цены: прайсы Ростелекома и магазин…'
          : data?.last?.finishedAt
            ? `${describePrices(data.last)}. Обновлено ${formatDateTime(data.last.finishedAt)}`
            : 'Цены из прайсов ещё не загружались — показаны цены каталога'}
      </p>
      {isAdmin && (
        <button type="button" className={styles.button} onClick={refresh} disabled={running}>
          {running ? 'Обновляем…' : 'Обновить цены'}
        </button>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
