import { ApiError, API_URL } from './api'
import type {
  AuthConfigResponse,
  AuthMeResponse,
  AuthUser,
  GoogleAuthResponse,
} from './authTypes'
import { clearToken, getToken, setToken, authHeaders } from './token'

export { getToken, setToken, clearToken, authHeaders }

export function displayName(user: AuthUser | null | undefined): string {
  if (!user) return 'Reader'
  const name = typeof user.name === 'string' ? user.name.trim() : ''
  if (name) return name
  const email = typeof user.email === 'string' ? user.email.trim() : ''
  if (email) return email.split('@')[0] || email
  return 'Reader'
}

export function avatarUrl(user: AuthUser | null | undefined): string | null {
  if (!user) return null
  const pic =
    (typeof user.picture === 'string' && user.picture) ||
    (typeof user.image === 'string' && user.image) ||
    ''
  return pic || null
}

function normalizeUser(raw: AuthMeResponse | AuthUser | null | undefined): AuthUser | null {
  if (!raw || typeof raw !== 'object') return null
  if ('user' in raw && raw.user && typeof raw.user === 'object') {
    return raw.user as AuthUser
  }
  return raw as AuthUser
}

export async function fetchAuthConfig(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/config`)
    if (!res.ok) return null
    const data = (await res.json()) as AuthConfigResponse
    return data.clientId || data.googleClientId || null
  } catch {
    return null
  }
}

export async function resolveGoogleClientId(): Promise<string> {
  const fromApi = await fetchAuthConfig()
  if (fromApi) return fromApi
  const fromEnv = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()
  if (fromEnv) return fromEnv
  throw new ApiError(
    'Google Sign-In is not configured. Set VITE_GOOGLE_CLIENT_ID or expose /api/auth/config.',
  )
}

export async function exchangeGoogleIdToken(
  idToken: string,
): Promise<GoogleAuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })

  if (!res.ok) {
    let detail = `Sign-in failed (${res.status})`
    try {
      const data = (await res.json()) as { error?: string; message?: string }
      detail = data.error ?? data.message ?? detail
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status)
  }

  const data = (await res.json()) as GoogleAuthResponse
  if (!data?.token) {
    throw new ApiError('Sign-in response missing app token.')
  }
  setToken(data.token)
  return data
}

export async function fetchMe(): Promise<AuthUser | null> {
  const token = getToken()
  if (!token) return null

  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: authHeaders(),
  })

  if (res.status === 401 || res.status === 403) {
    clearToken()
    return null
  }
  if (!res.ok) {
    throw new ApiError(`Session check failed (${res.status})`, res.status)
  }

  const data = (await res.json()) as AuthMeResponse
  return normalizeUser(data)
}

export async function logout(): Promise<void> {
  const token = getToken()
  try {
    if (token) {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
      })
    }
  } catch {
    /* optional endpoint */
  } finally {
    clearToken()
  }
}
