import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: 'var(--font-size-lg)',
        color: 'var(--rt-purple)',
      }}>
        Загрузка...
      </div>
    )
  }

  if (!user) {
    // Вместе с query — ссылка с фильтром переживает вход
    const back = location.pathname + location.search
    const next = back !== '/' ? `?next=${encodeURIComponent(back)}` : ''
    return <Navigate to={`/login${next}`} replace />
  }

  return <>{children}</>
}
