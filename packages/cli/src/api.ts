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
): Promise<T> {
  const { hub_url, api_key } = getConfig()

  if (!hub_url || !api_key) {
    throw new Error(
      'Not configured. Run:\n  skill config set hub_url https://your-vps.com\n  skill config set api_key kb_live_xxx',
    )
  }

  const res = await fetch(`${hub_url}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': api_key,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new ApiError(res.status, text)
  }

  return res.json() as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
