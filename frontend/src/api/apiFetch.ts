import type { ErrorResponse, ApiError } from './types'

const TOKEN_KEY = 'rt_access_token'

// Безопасная работа с sessionStorage
function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function setToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Игнорируем ошибки (приватный режим браузера)
  }
}

function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // Игнорируем ошибки
  }
}

export { getToken, setToken, clearToken }

// Нормализация ошибки
function normalizeError(status: number, data: unknown): ApiError {
  if (data && typeof data === 'object' && 'error' in data) {
    const errorResponse = data as ErrorResponse
    return errorResponse.error
  }

  // Фолбэк для нестандартных ответов
  if (status === 502 || status === 503) {
    return {
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'Сервис временно недоступен',
    }
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'Произошла ошибка',
  }
}

/** Шаги входа: их 401 — это «неверный пароль/код», а не «сессия истекла» */
const AUTH_STEP_URLS = ['/api/auth/login', '/api/auth/2fa/verify']

export interface ApiFetchOptions extends RequestInit {
  responseType?: 'json' | 'blob'
}

export interface BlobResponse {
  blob: Blob
  filename: string | null
}

export async function apiFetch<T>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const token = getToken()
  const responseType = options.responseType || 'json'

  const headers: Record<string, string> = {}

  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value
      })
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headers[key] = value
      })
    } else {
      Object.assign(headers, options.headers)
    }
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json'
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (response.status === 401) {
      // Сам код из тела: INVALID_CREDENTIALS / INVALID_CODE на входе, UNAUTHORIZED — протухший токен
      const body = await response.json().catch(() => null)
      const error = body && typeof body === 'object' && 'error' in body
        ? (body as ErrorResponse).error
        : { code: 'UNAUTHORIZED', message: 'Требуется авторизация' }

      // Ошибка самого входа — не сессия: остаёмся на экране, показываем «Неверный код» и т. п.
      if (!AUTH_STEP_URLS.some((u) => url.startsWith(u))) {
        clearToken()
        const { pathname, search } = window.location
        if (pathname !== '/login' && pathname !== '/login/2fa') {
          const back = pathname + search
          const next = back !== '/' ? `?next=${encodeURIComponent(back)}` : ''
          window.location.href = `/login${next}`
        }
      }
      throw error
    }

    // Для blob-ответов
    if (responseType === 'blob') {
      if (!response.ok) {
        // Попытаться распарсить JSON ошибку
        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          const data = await response.json()
          const error = normalizeError(response.status, data)
          throw error
        }
        // Фолбэк
        const error = normalizeError(response.status, null)
        throw error
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename: string | null = null

      if (contentDisposition) {
        // Сначала пробуем filename*=UTF-8''...
        const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/)
        if (filenameStarMatch) {
          filename = decodeURIComponent(filenameStarMatch[1])
        } else {
          // Потом filename=...
          const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/)
          if (filenameMatch) {
            filename = filenameMatch[1]
          }
        }
      }

      return { blob, filename } as T
    }

    // Для JSON-ответов
    const contentType = response.headers.get('content-type')
    const isJson = contentType?.includes('application/json')

    let data: unknown
    if (isJson) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    if (!response.ok) {
      const error = normalizeError(response.status, data)
      throw error
    }

    return data as T
  } catch (error) {
    // Если это уже ApiError, пробрасываем дальше
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      throw error
    }

    // Сетевая ошибка
    throw {
      code: 'NETWORK_ERROR',
      message: 'Не удалось связаться с сервером',
    } as ApiError
  }
}
