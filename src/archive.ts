import { ApiError, API_URL } from './api'
import type { ArchiveIssue, ArchiveResponse } from './types'

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; message?: string }
    return data.error ?? data.message ?? fallback
  } catch {
    return fallback
  }
}

export async function fetchArchive(): Promise<ArchiveResponse> {
  const res = await fetch(`${API_URL}/api/archive`)
  if (!res.ok) {
    throw new ApiError(
      await readError(res, `Failed to load archive (${res.status})`),
      res.status,
    )
  }
  const data = (await res.json()) as {
    calendarStart?: string | null
    calendarEnd?: string | null
    count?: number
    issues?: Record<string, unknown>[]
  }
  const issues: ArchiveIssue[] = (data.issues ?? [])
    .map((raw) => {
      const date = String(raw.date ?? '')
      const url =
        typeof raw.url === 'string' && raw.url.startsWith('/')
          ? raw.url
          : `/api/manual?date=${date}`
      return {
        date,
        filename: String(raw.filename ?? ''),
        totalPages:
          typeof raw.totalPages === 'number' ? raw.totalPages : null,
        url,
      }
    })
    .filter((issue) => /^\d{4}-\d{2}-\d{2}$/.test(issue.date))
  return {
    calendarStart: data.calendarStart || null,
    calendarEnd: data.calendarEnd || null,
    count: typeof data.count === 'number' ? data.count : issues.length,
    issues,
  }
}

export function todayISO(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatIssueDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day))
  return dt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatIssueDay(iso: string): string {
  const day = iso.split('-')[2]
  return String(Number(day))
}

export function formatIssueWeekday(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day))
  return dt.toLocaleDateString('en-GB', {
    weekday: 'short',
    timeZone: 'UTC',
  })
}

export function currentYearMonth(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function formatMonthHeading(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, 1))
  return dt.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function groupIssuesByMonth(issues: ArchiveIssue[]) {
  const groups: { key: string; label: string; issues: ArchiveIssue[] }[] = []
  const index = new Map<string, number>()
  for (const issue of issues) {
    const key = issue.date.slice(0, 7)
    let slot = index.get(key)
    if (slot == null) {
      slot = groups.length
      index.set(key, slot)
      groups.push({ key, label: formatMonthHeading(key), issues: [] })
    }
    groups[slot].issues.push(issue)
  }
  return groups
}
