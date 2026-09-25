// =============================================================================
// API Client — fetch wrapper for Docker Compose Skeleton REST API
// =============================================================================

import { getDefaultServerUrl } from '../lib/env'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class ApiTimeoutError extends ApiError {
  constructor(path: string, timeoutMs: number) {
    super(0, `Request to ${path} timed out after ${timeoutMs}ms`)
    this.name = 'ApiTimeoutError'
  }
}

export class ApiNetworkError extends ApiError {
  constructor(path: string, cause?: string) {
    super(0, `Network error requesting ${path}${cause ? `: ${cause}` : ''}`)
    this.name = 'ApiNetworkError'
  }
}

/**
 * Endpoints whose 401 means "the credentials in this request are wrong", not
 * "your API session is gone". A 401 from anything else ends the session.
 */
const CREDENTIAL_CHECK_PATHS = [
  '/auth/login',
  '/auth/setup',
  '/auth/register',
  '/auth/totp/validate',
  '/auth/totp/verify',
  '/auth/totp/disable',
  '/terminal/auth',
  '/terminal/exec',
  '/system/os-update',
]

function isCredentialCheckPath(path: string): boolean {
  const clean = path.split('?')[0]
  return CREDENTIAL_CHECK_PATHS.some((p) => clean === p || clean.startsWith(`${p}/`))
}

export class ApiClient {
  private baseUrl: string
  private timeout: number
  private maxRetries: number
  private authToken: string | null = null

  constructor(baseUrl = getDefaultServerUrl(), timeout = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.timeout = timeout
    this.maxRetries = 2
  }

  getBaseUrl(): string {
    return this.baseUrl
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '')
  }

  setTimeout(ms: number): void {
    this.timeout = ms
  }

  setAuthToken(token: string | null): void {
    this.authToken = token
  }

  getAuthToken(): string | null {
    return this.authToken
  }

  private async requestOnce<T>(method: string, path: string, body?: string, timeoutOverride?: number): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutOverride ?? this.timeout)

    const init: RequestInit = {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
      },
      signal: controller.signal,
    }
    if (body) init.body = body

    let response: Response
    try {
      response = await fetch(url, init)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiTimeoutError(path, timeoutOverride ?? this.timeout)
      }
      const message = err instanceof Error ? err.message : String(err)
      throw new ApiNetworkError(path, message)
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      let errorMessage = response.statusText
      try {
        const data = await response.json()
        if (data && typeof data.error === 'string') {
          errorMessage = data.error
        } else if (data && typeof data.message === 'string') {
          errorMessage = data.message
        }
      } catch {
        // response body was not JSON — use statusText
      }
      // Handle 401 — the API session is invalid, expired, or was never
      // established on this server (e.g. a session persisted by an older UI,
      // or a server that was reinstalled). End the session so the login /
      // setup flow takes over instead of polling forever; the authStore
      // listener ignores the event when nobody is signed in.
      // Endpoints that answer 401 about credentials carried *inside* the
      // request (password, TOTP code, Linux login, terminal session) leave
      // the API session untouched.
      if (response.status === 401) {
        if (!isCredentialCheckPath(path)) {
          this.authToken = null
          window.dispatchEvent(new CustomEvent('api-auth-expired'))
        }
        throw new ApiError(401, errorMessage)
      }
      throw new ApiError(response.status, errorMessage)
    }

    // Read body as text first, then parse — more resilient to encoding issues
    const text = await response.text()
    if (!text || text.trim().length === 0) {
      return {} as T
    }
    try {
      return JSON.parse(text) as T
    } catch {
      throw new ApiError(response.status, `Invalid JSON response from ${path}`)
    }
  }

  private async request<T>(method: string, path: string, body?: string, timeoutOverride?: number): Promise<T> {
    // Only retry idempotent GET requests on network errors — never POST/DELETE
    // which may have already modified server state
    if (method !== 'GET') {
      return this.requestOnce<T>(method, path, body, timeoutOverride)
    }
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.requestOnce<T>(method, path, body, timeoutOverride)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        // Only retry on network errors, not API errors
        if (!(err instanceof ApiNetworkError)) throw err
        // Wait a bit before retrying
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
        }
      }
    }
    throw lastError!
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  async post<T>(path: string, body?: unknown, timeoutOverride?: number): Promise<T> {
    return this.request<T>('POST', path, body ? JSON.stringify(body) : undefined, timeoutOverride)
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body ? JSON.stringify(body) : undefined)
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path)
  }

  async testConnection(): Promise<boolean> {
    try {
      // Simple reachability check — no auth headers (avoids CORS preflight)
      const url = `${this.baseUrl}/`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        // The dashboard's own HTML answers 200 too; only the API speaks JSON
        return response.ok && (response.headers.get('content-type') || '').includes('json')
      } catch {
        return false
      } finally {
        clearTimeout(timeoutId)
      }
    } catch {
      return false
    }
  }
}

export const apiClient = new ApiClient()
