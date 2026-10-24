import { useState, FormEvent, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { apiFetch, setToken } from '../api/apiFetch'
import type { TwoFactorVerifyResponse, ApiError } from '../api/types'
import layout from './authLayout.module.css'
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

  // Фокус в поле — при открытии и после неудачной проверки (пока шёл запрос, поле было disabled)
  useEffect(() => {
    if (!isLoading) inputRef.current?.focus()
  }, [isLoading])

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
      } else if (apiError.code === 'TOO_MANY_ATTEMPTS') {
        setError('Слишком много попыток')
        setTimeout(() => {
          navigate('/login', { replace: true })
        }, 2000)
      } else if (apiError.code === 'UNAUTHORIZED') {
        // mfaToken истёк — начать вход заново
        setError('Время на ввод кода вышло — войдите ещё раз')
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
    <div className={layout.container}>
      <main className={layout.card}>
        <div className={layout.brand}>
          Ростелеком <span className={layout.brandSeparator}>|</span>{' '}
          <span className={layout.product}>Радар присутствия</span>
        </div>
        <h1 className={layout.title}>Код подтверждения</h1>
        <p className={layout.subtitle}>
          {state.mfaSetupRequired
            ? 'Первый вход: привяжите аутентификатор и введите код из него'
            : 'Введите 6 цифр из Google Authenticator или Яндекс Ключа'}
        </p>

        {state.mfaSetupRequired && state.qrPngBase64 && (
          <div className={styles.qrSection}>
            <p className={styles.instruction}>Отсканируйте в Google Authenticator или Яндекс Ключе</p>
            <img
              src={`data:image/png;base64,${state.qrPngBase64}`}
              alt="QR-код для привязки аутентификатора"
              className={styles.qrCode}
            />
          </div>
        )}

        <form onSubmit={handleFormSubmit} className={layout.form}>
          <div className={styles.codeWrap}>
            <input
              ref={inputRef}
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="6-значный код"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              className={styles.codeInput}
              disabled={isLoading}
              maxLength={6}
              pattern="[0-9]*"
            />
            <div className={styles.cells} aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <span
                  key={i}
                  className={[
                    styles.cell,
                    code[i] ? styles.cellFilled : '',
                    i === Math.min(code.length, 5) ? styles.cellActive : '',
                    error ? styles.cellError : '',
                  ].join(' ')}
                >
                  {code[i] ?? ''}
                </span>
              ))}
            </div>
          </div>

          {error && (
            <div className={layout.error} role="alert">
              {error}
            </div>
          )}

          <button type="submit" className={layout.button} disabled={isLoading || code.length !== 6}>
            {isLoading ? 'Проверяем…' : 'Подтвердить'}
          </button>
        </form>

        <button onClick={() => navigate('/login', { replace: true })} className={layout.linkButton}>
          Назад ко входу
        </button>
      </main>
    </div>
  )
}
