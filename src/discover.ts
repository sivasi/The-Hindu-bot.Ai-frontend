import { ApiError, API_URL } from './api'
import { authHeaders, clearToken } from './token'
import type {
  DiscoverHomeResponse,
  DiscoverSectionResponse,
  ExamArticle,
} from './types'

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

function normalizeArticle(raw: Record<string, unknown>): ExamArticle {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    title: String(raw.title ?? 'Untitled'),
    section: String(raw.section ?? ''),
    examRelevance:
      typeof raw.examRelevance === 'string' ? raw.examRelevance : undefined,
    summary: typeof raw.summary === 'string' ? raw.summary : undefined,
    refinedBody:
      typeof raw.refinedBody === 'string' ? raw.refinedBody : undefined,
    examTags: Array.isArray(raw.examTags)
      ? raw.examTags.map(String)
      : undefined,
    pageNumber:
      typeof raw.pageNumber === 'number' ? raw.pageNumber : undefined,
    wordCount: typeof raw.wordCount === 'number' ? raw.wordCount : undefined,
    source: typeof raw.source === 'string' ? raw.source : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  }
}

/** Discover home: section catalog + Front Page feed. */
export async function fetchDiscoverHome(): Promise<DiscoverHomeResponse> {
  const res = await fetch(`${API_URL}/api/discover`, {
    headers: authHeaders(),
  })
  throwIfUnauthorized(res)
  if (!res.ok) {
    throw new ApiError(
      await readError(res, `Failed to load Discover (${res.status})`),
      res.status,
    )
  }
  const data = (await res.json()) as {
    sections?: Record<string, unknown>[]
    frontPage?: {
      section?: string
      count?: number
      articles?: Record<string, unknown>[]
    }
  }
  const sections = (data.sections ?? []).map((s) => ({
    section: String(s.section ?? ''),
    count: typeof s.count === 'number' ? s.count : 0,
  }))
  const frontPageArticles = (data.frontPage?.articles ?? []).map((a) =>
    normalizeArticle(a),
  )
  return {
    sections,
    frontPage: {
      section: String(data.frontPage?.section ?? 'Front Page'),
      count:
        typeof data.frontPage?.count === 'number'
          ? data.frontPage.count
          : frontPageArticles.length,
      articles: frontPageArticles,
    },
  }
}

/** On-demand articles for one section. */
export async function fetchDiscoverSection(
  sectionName: string,
): Promise<DiscoverSectionResponse> {
  const path = `/api/discover/section/${encodeURIComponent(sectionName)}`
  const res = await fetch(`${API_URL}${path}`, {
    headers: authHeaders(),
  })
  throwIfUnauthorized(res)
  if (!res.ok) {
    throw new ApiError(
      await readError(res, `Failed to load section (${res.status})`),
      res.status,
    )
  }
  const data = (await res.json()) as {
    section?: string
    count?: number
    articles?: Record<string, unknown>[]
  }
  const articles = (data.articles ?? []).map((a) => normalizeArticle(a))
  return {
    section: String(data.section ?? sectionName),
    count: typeof data.count === 'number' ? data.count : articles.length,
    articles,
  }
}
