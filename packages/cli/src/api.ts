import { getConfig } from './config'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = 30000, // 30 second timeout
): Promise<T> {
  const { hub_url, api_key } = getConfig()

  if (!hub_url || !api_key) {
    throw new Error(
      'Not configured. Run:\n  skill config set hub_url https://your-vps.com\n  skill config set api_key kb_live_xxx',
    )
  }

  // Create abort controller with timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${hub_url}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': api_key,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new ApiError(res.status, text)
    }

    return res.json() as T
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms. API may be unresponsive.`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
