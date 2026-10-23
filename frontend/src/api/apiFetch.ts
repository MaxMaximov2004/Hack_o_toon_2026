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

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()

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

    // Любой 401 - стереть токен и редирект на логин
    if (response.status === 401) {
      clearToken()
      const currentPath = window.location.pathname
      if (currentPath !== '/login' && currentPath !== '/login/2fa') {
        const next = currentPath !== '/' ? `?next=${encodeURIComponent(currentPath)}` : ''
        window.location.href = `/login${next}`
      }
    }

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
