// =============================================================================
// API Client — fetch wrapper for Docker Compose Skeleton REST API
// =============================================================================

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

export class ApiClient {
  private baseUrl: string
  private timeout: number
  private maxRetries: number

  constructor(baseUrl = 'http://127.0.0.1:9876', timeout = 30000) {
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

  private async requestOnce<T>(method: string, path: string, body?: string): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    const init: RequestInit = {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: controller.signal,
    }
    if (body) init.body = body

    let response: Response
    try {
      response = await fetch(url, init)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiTimeoutError(path, this.timeout)
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

  private async request<T>(method: string, path: string, body?: string): Promise<T> {
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.requestOnce<T>(method, path, body)
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

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body ? JSON.stringify(body) : undefined)
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path)
  }

  async testConnection(): Promise<boolean> {
    try {
      // Use a single attempt with short timeout for connection test
      const url = `${this.baseUrl}/`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        return response.ok
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
