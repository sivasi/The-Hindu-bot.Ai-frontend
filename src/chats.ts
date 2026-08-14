import { ApiError, API_URL } from './api'
import { authHeaders, clearToken } from './token'
import type { ChatMessage, ChatSession } from './types'

function throwIfUnauthorized(res: Response): void {
  if (res.status === 401 || res.status === 403) {
    clearToken()
    throw new ApiError('Session expired. Please sign in again.', res.status)
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; message?: string }
    return data.error ?? data.message ?? fallback
  } catch {
    return fallback
  }
}

function normalizeSession(raw: Record<string, unknown>): ChatSession {
  const id = String(raw.id ?? raw._id ?? '')
  return {
    id,
    title: String(raw.title ?? 'New chat'),
    preview: typeof raw.preview === 'string' ? raw.preview : undefined,
    messageCount:
      typeof raw.messageCount === 'number' ? raw.messageCount : undefined,
    lastMessageAt:
      typeof raw.lastMessageAt === 'string'
        ? raw.lastMessageAt
        : typeof raw.updatedAt === 'string'
          ? raw.updatedAt
          : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  }
}

function normalizeMessage(raw: Record<string, unknown>, index: number): ChatMessage {
  const role = raw.role === 'assistant' ? 'assistant' : 'user'
  return {
    id: String(raw.id ?? raw._id ?? `msg-${index}`),
    role,
    content: String(raw.content ?? raw.text ?? raw.answer ?? ''),
    sources: Array.isArray(raw.sources) ? (raw.sources as ChatMessage['sources']) : undefined,
    meta:
      raw.meta && typeof raw.meta === 'object'
        ? (raw.meta as ChatMessage['meta'])
        : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
  }
}

export async function listChats(): Promise<ChatSession[]> {
  const res = await fetch(`${API_URL}/api/chats`, {
    headers: authHeaders(),
  })
  throwIfUnauthorized(res)
  if (!res.ok) {
    throw new ApiError(await readError(res, `Failed to load chats (${res.status})`), res.status)
  }
  const data = (await res.json()) as {
    sessions?: Record<string, unknown>[]
    chats?: Record<string, unknown>[]
  }
  const list = data.sessions ?? data.chats ?? []
  return list
    .map((s) => normalizeSession(s))
    .filter((s) => s.id)
    .sort((a, b) => {
      const ta = new Date(a.lastMessageAt || a.createdAt || 0).getTime()
      const tb = new Date(b.lastMessageAt || b.createdAt || 0).getTime()
      return tb - ta
    })
}

export async function createChat(title?: string): Promise<ChatSession> {
  const res = await fetch(`${API_URL}/api/chats`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(title ? { title } : {}),
  })
  throwIfUnauthorized(res)
  if (!res.ok) {
    throw new ApiError(await readError(res, `Failed to create chat (${res.status})`), res.status)
  }
  const data = (await res.json()) as {
    session?: Record<string, unknown>
  } & Record<string, unknown>
  const session = data.session ?? data
  return normalizeSession(session)
}

export async function getChat(
  id: string,
): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
  const res = await fetch(`${API_URL}/api/chats/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
  })
  throwIfUnauthorized(res)
  if (!res.ok) {
    throw new ApiError(await readError(res, `Failed to load chat (${res.status})`), res.status)
  }
  const data = (await res.json()) as {
    session?: Record<string, unknown>
    messages?: Record<string, unknown>[]
  }
  const sessionRaw = data.session ?? { id }
  return {
    session: normalizeSession(sessionRaw as Record<string, unknown>),
    messages: (data.messages ?? []).map((m, i) => normalizeMessage(m, i)),
  }
}

export async function renameChat(id: string, title: string): Promise<ChatSession> {
  const res = await fetch(`${API_URL}/api/chats/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ title }),
  })
  throwIfUnauthorized(res)
  if (!res.ok) {
    throw new ApiError(await readError(res, `Failed to rename chat (${res.status})`), res.status)
  }
  const data = (await res.json()) as {
    session?: Record<string, unknown>
  } & Record<string, unknown>
  return normalizeSession((data.session ?? data) as Record<string, unknown>)
}

export async function deleteChat(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/chats/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  throwIfUnauthorized(res)
  if (!res.ok) {
    throw new ApiError(await readError(res, `Failed to delete chat (${res.status})`), res.status)
  }
}

export function relativeTime(iso?: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const sec = Math.round(diff / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(t))
}
