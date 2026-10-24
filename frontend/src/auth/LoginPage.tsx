import { useState, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../api/apiFetch'
import type { LoginResponse, ApiError } from '../api/types'
import styles from './LoginPage.module.css'

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
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>Ростелеком</div>
          <h1 className={styles.title}>Радар присутствия</h1>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
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

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.button} disabled={isLoading}>
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className={styles.demo}>
          <p>Демо-аккаунт: demo@rt.ru / Demo2026!</p>
        </div>
      </div>
    </div>
  )
}
