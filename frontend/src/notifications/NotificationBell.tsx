import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../api/endpoints'
import type { Notification } from '../api/types'
import { formatRelativeTime } from '../utils/formatRelativeTime'
import styles from './NotificationBell.module.css'

/** state для перехода в Навигатор: открыть карточку проекта */
export interface OpenProjectState {
  openProjectId: number
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()

  const { data, isError } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  const readOne = useMutation({ mutationFn: markNotificationRead, onSettled: invalidate })
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSettled: invalidate })

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  const unread = data?.unreadCount ?? 0

  const handleOpenNotification = (n: Notification) => {
    if (!n.isRead) readOne.mutate(n.id)
    setIsOpen(false)
    // Уже в Навигаторе — сохраняем текущий фильтр
    const search = location.pathname === '/navigator' ? location.search : ''
    const state: OpenProjectState = { openProjectId: n.projectId }
    navigate({ pathname: '/navigator', search }, { state })
  }

  return (
    <div className={styles.container}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen((v) => !v)}
        aria-label={unread > 0 ? `Уведомления: ${unread} непрочитанных` : 'Уведомления'}
        aria-expanded={isOpen}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className={styles.count} data-testid="unread-count">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className={styles.overlay} onClick={() => setIsOpen(false)} />
          <div className={styles.panel} role="dialog" aria-label="Уведомления">
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Уведомления</span>
              {unread > 0 && (
                <button
                  className={styles.textButton}
                  onClick={() => readAll.mutate()}
                  disabled={readAll.isPending}
                >
                  Прочитать все
                </button>
              )}
            </div>

            {isError && <div className={styles.empty}>Не удалось загрузить уведомления</div>}

            {data && data.items.length === 0 && (
              <div className={styles.empty}>
                Уведомлений нет. Подпишитесь на проекты в Навигаторе
              </div>
            )}

            {data && data.items.length > 0 && (
              <ul className={styles.list}>
                {data.items.map((n) => (
                  <li key={n.id}>
                    <button
                      className={`${styles.item} ${n.isRead ? '' : styles.unread}`}
                      onClick={() => handleOpenNotification(n)}
                    >
                      {!n.isRead && <span className={styles.dot} aria-label="не прочитано" />}
                      <span className={styles.itemBody}>
                        <span className={styles.itemTitle}>{n.title}</span>
                        <span className={styles.itemMeta}>
                          {n.municipalityName && <>{n.municipalityName} · </>}
                          {formatRelativeTime(n.createdAt)}
                          {n.sentToTelegram && <> · в Telegram</>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Link to="/subscriptions" className={styles.footerLink} onClick={() => setIsOpen(false)}>
              Мои подписки и Telegram
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
