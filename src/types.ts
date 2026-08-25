export type HealthResponse = {
  ok: boolean
  chromaOk: boolean
  indexReady: boolean
  vectorCount: number
  collection: string
}

export type Source = {
  heading: string
  chunkIndex: number
  chunkTotal: number
  pageNumber: number
  date?: string | null
  section?: string
  excerpt: string
  pageContent: string
  metadata?: Record<string, unknown>
}

export type QueryMode = 'normal' | 'turbo_short' | 'turbo_research'

export type QueryResponse = {
  answer: string
  sources: Source[]
  meta: {
    k: number
    mode?: QueryMode | string
    turbo?: boolean
    streamAnswer?: boolean
    wordTarget?: number | null
    model: string
    collection: string
  }
}

export type QueryRequest = {
  question: string
  mode?: QueryMode
  k?: number
  sessionId?: string | null
}

export type ChatSession = {
  id: string
  title: string
  preview?: string
  messageCount?: number
  lastMessageAt?: string
  createdAt?: string
  updatedAt?: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  meta?: QueryResponse['meta']
  createdAt?: string
}

export type StreamStep = 'searching' | 'found' | 'llm' | 'answering' | string

export type StreamStatusEvent = {
  type: 'status'
  step: StreamStep
  message: string
  count?: number
}

export type StreamTokenEvent = {
  type: 'token'
  text: string
}

export type StreamResultEvent = {
  type: 'result'
  answer: string
  sources: Source[]
  meta: QueryResponse['meta']
}

export type StreamSessionEvent = {
  type: 'session'
  sessionId: string
  session: ChatSession
  created?: boolean
}

export type StreamErrorEvent = {
  type: 'error'
  message: string
}

export type StreamDoneEvent = {
  type: 'done'
}

export type StreamEvent =
  | StreamStatusEvent
  | StreamTokenEvent
  | StreamResultEvent
  | StreamSessionEvent
  | StreamErrorEvent
  | StreamDoneEvent

export const DISCOVER_SECTIONS = [
  'Front Page',
  'National',
  'Regional',
  'Edit',
  'Op-Ed',
  'Business',
  'Foreign',
  'Sports',
  'Science',
] as const

export type DiscoverSectionName = (typeof DISCOVER_SECTIONS)[number]

export type ExamArticle = {
  id: string
  title: string
  section: string
  examRelevance?: string
  summary?: string
  refinedBody?: string
  examTags?: string[]
  pageNumber?: number
  wordCount?: number
  source?: string
  createdAt?: string
  updatedAt?: string
}

export type DiscoverSectionInfo = {
  section: string
  count: number
}

export type DiscoverHomeResponse = {
  sections: DiscoverSectionInfo[]
  frontPage: {
    section: string
    count: number
    articles: ExamArticle[]
  }
}

export type DiscoverSectionResponse = {
  section: string
  count: number
  articles: ExamArticle[]
}

export type ArchiveIssue = {
  date: string
  filename: string
  totalPages: number | null
  url: string
}

export type ArchiveResponse = {
  calendarStart: string | null
  calendarEnd: string | null
  count: number
  issues: ArchiveIssue[]
}
