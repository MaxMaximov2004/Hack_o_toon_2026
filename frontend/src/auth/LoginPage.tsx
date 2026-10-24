import { useState, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../api/apiFetch'
import type { LoginResponse, ApiError } from '../api/types'
import styles from './authLayout.module.css'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      // Сохраняем mfaToken в памяти (передадим через state)
      // Только свой относительный путь: «//evil.com» и «https://…» не пускаем
      const rawNext = searchParams.get('next') || '/'
      const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
      navigate('/login/2fa', {
        state: {
          mfaToken: response.mfaToken,
          mfaSetupRequired: response.mfaSetupRequired,
          otpauthUrl: response.otpauthUrl,
          qrPngBase64: response.qrPngBase64,
          next,
        },
        replace: true,
      })
    } catch (err) {
      const apiError = err as ApiError
      if (apiError.code === 'INVALID_CREDENTIALS') {
        setError('Неверный email или пароль')
      } else {
        setError(apiError.message || 'Произошла ошибка')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <main className={styles.card}>
        <div className={styles.brand}>
          Ростелеком <span className={styles.brandSeparator}>|</span>{' '}
          <span className={styles.product}>Радар присутствия</span>
        </div>
        <h1 className={styles.title}>Вход</h1>
        <p className={styles.subtitle}>Клиенты и инвестпроекты Ростовской области на одной карте</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              autoCapitalize="none"
              className={styles.input}
              disabled={isLoading}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={styles.input}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          <button type="submit" className={styles.button} disabled={isLoading}>
            {isLoading ? 'Входим…' : 'Войти'}
          </button>
        </form>

        <p className={styles.footnote}>Демо-аккаунт: demo@rt.ru / Demo2026!</p>
      </main>
    </div>
  )
}
