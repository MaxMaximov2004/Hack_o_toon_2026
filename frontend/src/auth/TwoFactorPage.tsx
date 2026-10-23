import { useState, FormEvent, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { apiFetch, setToken } from '../api/apiFetch'
import type { TwoFactorVerifyResponse, ApiError } from '../api/types'
import styles from './TwoFactorPage.module.css'

interface LocationState {
  mfaToken: string
  mfaSetupRequired: boolean
  otpauthUrl?: string
  qrPngBase64?: string
  next: string
}

export function TwoFactorPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()
  const state = location.state as LocationState | null

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  if (!state?.mfaToken) {
    return <Navigate to="/login" replace />
  }

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    setError('')

    // Автосабмит на 6-й цифре
    if (digits.length === 6) {
      handleSubmit(digits)
    }
  }

  const handleSubmit = async (codeValue?: string) => {
    const finalCode = codeValue || code
    if (finalCode.length !== 6) return

    setIsLoading(true)
    setError('')

    try {
      const response = await apiFetch<TwoFactorVerifyResponse>('/api/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({
          mfaToken: state.mfaToken,
          code: finalCode,
        }),
      })

      setToken(response.accessToken)
      setUser(response.user)
      navigate(state.next || '/', { replace: true })
    } catch (err) {
      const apiError = err as ApiError
      if (apiError.code === 'INVALID_CODE') {
        setError('Неверный код')
        setCode('')
        inputRef.current?.focus()
      } else if (apiError.code === 'TOO_MANY_ATTEMPTS') {
        setError('Слишком много попыток')
        setTimeout(() => {
          navigate('/login', { replace: true })
        }, 2000)
      } else {
        setError(apiError.message || 'Произошла ошибка')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSubmit()
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>Ростелеком</div>
          <h1 className={styles.title}>Двухфакторная аутентификация</h1>
        </div>

        {state.mfaSetupRequired && state.qrPngBase64 && (
          <div className={styles.qrSection}>
            <p className={styles.instruction}>
              Отсканируйте QR-код в Google Authenticator или Яндекс.Ключ
            </p>
            <img
              src={`data:image/png;base64,${state.qrPngBase64}`}
              alt="QR код для настройки 2FA"
              className={styles.qrCode}
            />
          </div>
        )}

        <form onSubmit={handleFormSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="code" className={styles.label}>
              Введите 6-значный код
            </label>
            <input
              ref={inputRef}
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              className={styles.codeInput}
              disabled={isLoading}
              maxLength={6}
              pattern="[0-9]*"
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            className={styles.button}
            disabled={isLoading || code.length !== 6}
          >
            {isLoading ? 'Проверка...' : 'Подтвердить'}
          </button>
        </form>

        <button
          onClick={() => navigate('/login', { replace: true })}
          className={styles.backButton}
        >
          Назад к входу
        </button>
      </div>
    </div>
  )
}
