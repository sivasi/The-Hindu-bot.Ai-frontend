import type {
  HealthResponse,
  QueryRequest,
  QueryResponse,
  StreamEvent,
  StreamStatusEvent,
} from './types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export function getManualPdfUrl(pageNumber?: number): string {
  const base = `${API_URL}/api/manual`
  if (typeof pageNumber === 'number' && pageNumber > 0) {
    return `${base}#page=${pageNumber}`
  }
  return base
}

export class ApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/api/health`)
  if (!res.ok) {
    throw new ApiError(`Health check failed (${res.status})`, res.status)
  }
  return res.json() as Promise<HealthResponse>
}

function buildQueryBody(body: QueryRequest) {
  const payload: Record<string, unknown> = {
    question: body.question,
    mode: body.mode ?? 'normal',
  }
  // Turbo modes always use backend k=10 — do not send k for turbo.
  if (
    typeof body.k === 'number' &&
    (body.mode === 'normal' || body.mode == null)
  ) {
    payload.k = body.k
  }
  return payload
}

/** Blocking fallback — prefer queryArchiveStream. */
export async function queryArchive(body: QueryRequest): Promise<QueryResponse> {
  const res = await fetch(`${API_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildQueryBody(body)),
  })

  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const data = (await res.json()) as { error?: string; message?: string }
      detail = data.error ?? data.message ?? detail
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status)
  }

  return res.json() as Promise<QueryResponse>
}

export type StreamHandlers = {
  onStatus: (event: StreamStatusEvent) => void
  onToken?: (text: string) => void
  onResult: (result: QueryResponse) => void
  onError: (message: string) => void
  signal?: AbortSignal
}

function parseSseChunk(raw: string): StreamEvent | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith(':')) return null

  const dataLine = trimmed
    .split('\n')
    .map((l) => l.trimEnd())
    .find((l) => l.startsWith('data:'))
  if (!dataLine) return null

  const payload = dataLine.replace(/^data:\s*/, '').trim()
  if (!payload || payload === '[DONE]') return null

  try {
    return JSON.parse(payload) as StreamEvent
  } catch {
    return null
  }
}

/** Primary ask path — journey statuses; tokens only for turbo_research. */
export async function queryArchiveStream(
  body: QueryRequest,
  handlers: StreamHandlers,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/query/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(buildQueryBody(body)),
    signal: handlers.signal,
  })

  if (!res.ok || !res.body) {
    let detail = `HTTP ${res.status}`
    try {
      const data = (await res.json()) as { error?: string; message?: string }
      detail = data.error ?? data.message ?? detail
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawResult = false
  let streamError: string | null = null

  const handleEvent = (event: StreamEvent) => {
    if (event.type === 'status') {
      handlers.onStatus(event)
    } else if (event.type === 'token') {
      handlers.onToken?.(event.text ?? '')
    } else if (event.type === 'result') {
      sawResult = true
      handlers.onResult({
        answer: event.answer,
        sources: event.sources ?? [],
        meta: event.meta,
      })
    } else if (event.type === 'error') {
      streamError = event.message || 'Query failed'
      handlers.onError(streamError)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const event = parseSseChunk(part)
      if (!event) continue
      if (event.type === 'done') return
      handleEvent(event)
    }
  }

  if (buffer.trim()) {
    const event = parseSseChunk(buffer)
    if (event && event.type !== 'done') handleEvent(event)
  }

  if (streamError) return
  if (!sawResult) {
    throw new ApiError('The archive stream ended before returning an answer.')
  }
}
