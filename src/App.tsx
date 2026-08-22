import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, checkHealth, getManualPdfUrl, queryArchive, queryArchiveStream } from './api'
import {
  avatarUrl,
  clearToken,
  displayName,
  fetchMe,
  getToken,
  logout,
} from './auth'
import type { AuthUser } from './authTypes'
import {
  getChat,
  listChats,
} from './chats'
import { BackendDown } from './components/BackendDown'
import { ChatSidebar } from './components/ChatSidebar'
import type { AppMode } from './components/ChatSidebar'
import { ChatThread, pruneIncompleteTurns } from './components/ChatThread'
import { DiscoverFeed } from './components/DiscoverFeed'
import { GoogleSignIn } from './components/GoogleSignIn'
import { JourneyStatus } from './components/JourneyStatus'
import { StreamingAnswer } from './components/StreamingAnswer'
import { fetchDiscoverHome, fetchDiscoverSection } from './discover'
import type {
  ChatMessage,
  ChatSession,
  DiscoverSectionInfo,
  ExamArticle,
  QueryMode,
  QueryResponse,
} from './types'
import { DISCOVER_SECTIONS } from './types'

type TurboKind = 'short' | 'research'

function resolveMode(turboOn: boolean, turboKind: TurboKind): QueryMode {
  if (!turboOn) return 'normal'
  return turboKind === 'short' ? 'turbo_short' : 'turbo_research'
}

function modeHint(mode: QueryMode): string {
  if (mode === 'turbo_short') return 'Deeper · more accurate · ~30–50 words'
  if (mode === 'turbo_research') return 'Deeper · more accurate · up to ~300 words'
  return 'Concise · 3 sources'
}

function upsertSession(list: ChatSession[], session: ChatSession): ChatSession[] {
  const without = list.filter((s) => s.id !== session.id)
  return [session, ...without].sort((a, b) => {
    const ta = new Date(a.lastMessageAt || a.createdAt || 0).getTime()
    const tb = new Date(b.lastMessageAt || b.createdAt || 0).getTime()
    return tb - ta
  })
}

const CITIES = [
  'Chennai',
  'Coimbatore',
  'Bengaluru',
  'Hyderabad',
  'Madurai',
  'Tiruchi',
  'Kochi',
  'Kozhikode',
  'Thiruvananthapuram',
  'Mangaluru',
  'Vijayawada',
  'Visakhapatnam',
  'Kolkata',
  'Mumbai',
  'New Delhi',
]

const FEATURES = [
  {
    kicker: 'Archive desk',
    tone: 'offwhite',
    title: 'Ask the paper, not the web',
    blurb: 'Questions are answered only from indexed Hindu archive chunks.',
  },
  {
    kicker: 'Grounded',
    tone: 'red',
    title: 'Every reply cites sources',
    blurb: 'Retrieved article excerpts appear under the answer for verification.',
  },
  {
    kicker: 'Retrieval',
    tone: 'offwhite',
    title: 'Semantic search over pages',
    blurb: 'The desk pulls the closest passages before drafting a reply.',
  },
  {
    kicker: 'History',
    tone: 'red',
    title: 'Chats stay in the Inside column',
    blurb: 'Each thread is a session — open, rename, or start a new lead.',
  },
  {
    kicker: 'How to use',
    tone: 'offwhite',
    title: 'Type like a headline',
    blurb: 'Use the lead box as your question. Press Ask to print the answer.',
  },
] as const

const INSIDE = [
  {
    head: 'Employment in power sector',
    snip: 'Ask what the archive reported on hiring and growth.',
    q: 'How much growth of employment in the power sector?',
  },
  {
    head: 'Inflation this week',
    snip: 'Probe price trends and policy notes from the paper.',
    q: 'What did the paper report on inflation this week?',
  },
  {
    head: 'Foreign investment',
    snip: 'Summarise FDI and capital-flow coverage in the corpus.',
    q: 'Summarise key points on foreign investment.',
  },
  {
    head: 'About this website',
    snip: 'A newspaper front page with a chatbot in the lead slot.',
    q: 'What is this Archive Q&A website for?',
  },
] as const

type Status = 'idle' | 'loading' | 'error' | 'done'
type AuthStatus = 'checking' | 'signed_out' | 'signed_in'

export default function App() {
  const [question, setQuestion] = useState('')
  const [turboOn, setTurboOn] = useState(false)
  const [turboKind, setTurboKind] = useState<TurboKind>('short')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [healthWarning, setHealthWarning] = useState<string | null>(null)
  const [backendStatus, setBackendStatus] = useState<
    'checking' | 'up' | 'down'
  >('checking')
  const [backendRetrying, setBackendRetrying] = useState(false)
  const [result, setResult] = useState<QueryResponse | null>(null)
  const [journeyMessage, setJourneyMessage] = useState<string | null>(null)
  const [showAllSources, setShowAllSources] = useState(false)
  const [streamDraft, setStreamDraft] = useState('')
  const [isStreamingAnswer, setIsStreamingAnswer] = useState(false)
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatsLoading, setChatsLoading] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [appMode, setAppMode] = useState<AppMode>('discover')
  const [discoverSections, setDiscoverSections] = useState<DiscoverSectionInfo[]>(
    () => DISCOVER_SECTIONS.map((section) => ({ section, count: 0 })),
  )
  const [activeDiscoverSection, setActiveDiscoverSection] =
    useState('Front Page')
  const [discoverArticles, setDiscoverArticles] = useState<ExamArticle[]>([])
  const [frontPageArticles, setFrontPageArticles] = useState<ExamArticle[]>([])
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [discoverError, setDiscoverError] = useState<string | null>(null)
  const [discoverHomeLoaded, setDiscoverHomeLoaded] = useState(false)
  const answerRef = useRef<HTMLElement>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const streamDraftRef = useRef('')
  const tokenFlushRaf = useRef<number | null>(null)
  const shouldStickToBottom = useRef(true)

  const mode = resolveMode(turboOn, turboKind)
  const signedIn = authStatus === 'signed_in'

  const editionParts = useMemo(() => {
    const now = new Date()
    return {
      weekday: new Intl.DateTimeFormat('en-IN', { weekday: 'long' })
        .format(now)
        .toUpperCase(),
      date: new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now),
    }
  }, [])

  async function probeBackend() {
    try {
      const h = await checkHealth()
      if (!h.ok) {
        setBackendStatus('down')
        setHealthWarning(null)
        return false
      }
      setBackendStatus('up')
      if (!h.chromaOk || !h.indexReady) {
        setHealthWarning(
          'Archive index may be unavailable. Answers could fail until the backend is ready.',
        )
      } else {
        setHealthWarning(null)
      }
      return true
    } catch {
      setBackendStatus('down')
      setHealthWarning(null)
      return false
    }
  }

  useEffect(() => {
    let cancelled = false
    void probeBackend().then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleBackendRetry() {
    setBackendRetrying(true)
    await probeBackend()
    setBackendRetrying(false)
  }

  async function refreshChats() {
    setChatsLoading(true)
    try {
      const list = await listChats()
      setSessions(list)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleSessionExpired(err.message)
        return
      }
      // Chats API may be briefly unavailable — keep Ask usable.
    } finally {
      setChatsLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      if (!getToken()) {
        if (!cancelled) {
          setUser(null)
          setAuthStatus('signed_out')
        }
        return
      }
      try {
        const me = await fetchMe()
        if (cancelled) return
        if (me) {
          setUser(me)
          setAuthStatus('signed_in')
        } else {
          setUser(null)
          setAuthStatus('signed_out')
        }
      } catch {
        if (cancelled) return
        setUser({ name: 'Signed-in reader' })
        setAuthStatus('signed_in')
      }
    }

    void restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!signedIn) {
      setSessions([])
      setActiveSessionId(null)
      setMessages([])
      return
    }
    void refreshChats()
  }, [signedIn])

  function scrollThreadToBottom(behavior: ScrollBehavior = 'smooth') {
    requestAnimationFrame(() => {
      threadEndRef.current?.scrollIntoView({ behavior, block: 'end' })
    })
  }

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (tokenFlushRaf.current != null) {
        cancelAnimationFrame(tokenFlushRaf.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!signedIn) return
    if (!messages.length && !isStreamingAnswer && !journeyMessage) return
    if (!shouldStickToBottom.current) return
    scrollThreadToBottom('smooth')
  }, [
    signedIn,
    messages,
    streamDraft,
    isStreamingAnswer,
    journeyMessage,
    status,
  ])

  function resetThreadUi() {
    setQuestion('')
    setResult(null)
    setError(null)
    setStatus('idle')
    setJourneyMessage(null)
    setStreamDraft('')
    streamDraftRef.current = ''
    setIsStreamingAnswer(false)
    setShowAllSources(false)
  }

  function handleSignedIn(nextUser: AuthUser) {
    setUser(nextUser)
    setAuthStatus('signed_in')
    setError(null)
  }

  async function handleLogout() {
    abortRef.current?.abort()
    await logout()
    setUser(null)
    setAuthStatus('signed_out')
    setSessions([])
    setActiveSessionId(null)
    setMessages([])
    resetThreadUi()
    setMobileNavOpen(false)
  }

  function handleSessionExpired(message?: string) {
    clearToken()
    setUser(null)
    setAuthStatus('signed_out')
    setSessions([])
    setActiveSessionId(null)
    setMessages([])
    resetThreadUi()
    setError(message || 'Session expired. Please sign in again.')
  }

  function handleNewChat() {
    abortRef.current?.abort()
    setActiveSessionId(null)
    setMessages([])
    resetThreadUi()
    setMobileNavOpen(false)
    setAppMode('chat')
  }

  async function handleSelectChat(id: string) {
    if (status === 'loading') return
    abortRef.current?.abort()
    setError(null)
    setShowAllSources(false)
    setJourneyMessage(null)
    setStreamDraft('')
    streamDraftRef.current = ''
    setIsStreamingAnswer(false)
    setQuestion('')
    setAppMode('chat')
    try {
      const { session, messages: loaded } = await getChat(id)
      setActiveSessionId(session.id)
      setMessages(pruneIncompleteTurns(loaded))
      setSessions((prev) => upsertSession(prev, session))
      const lastAssistant = [...pruneIncompleteTurns(loaded)]
        .reverse()
        .find((m) => m.role === 'assistant')
      if (lastAssistant) {
        setResult({
          answer: lastAssistant.content,
          sources: lastAssistant.sources ?? [],
          meta: lastAssistant.meta ?? {
            k: 0,
            model: '',
            collection: '',
          },
        })
        setStatus('done')
      } else {
        setResult(null)
        setStatus('idle')
      }
      shouldStickToBottom.current = true
      requestAnimationFrame(() => {
        scrollThreadToBottom('auto')
        requestAnimationFrame(() => scrollThreadToBottom('auto'))
      })
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleSessionExpired(err.message)
        return
      }
      setError(err instanceof ApiError ? err.message : 'Could not open that chat.')
    }
  }

  function flushStreamDraft() {
    if (tokenFlushRaf.current != null) return
    tokenFlushRaf.current = requestAnimationFrame(() => {
      tokenFlushRaf.current = null
      setStreamDraft(streamDraftRef.current)
    })
  }

  async function handleAsk(e?: FormEvent) {
    e?.preventDefault()
    const trimmed = question.trim()
    if (!trimmed || status === 'loading' || !signedIn) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const sessionIdForRequest = activeSessionId
    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setQuestion('')
    setStatus('loading')
    setError(null)
    setResult(null)
    setShowAllSources(false)
    setStreamDraft('')
    streamDraftRef.current = ''
    setIsStreamingAnswer(false)
    shouldStickToBottom.current = true
    scrollThreadToBottom('smooth')
    setJourneyMessage(
      mode === 'normal'
        ? 'Searching about the content'
        : 'Searching deeply about the content',
    )

    const request = {
      question: trimmed,
      mode,
      sessionId: sessionIdForRequest,
    }

    try {
      await queryArchiveStream(request, {
        signal: controller.signal,
        onStatus: (event) => {
          if (event.step === 'answering') {
            setJourneyMessage(null)
            setIsStreamingAnswer(true)
          } else if (!streamDraftRef.current) {
            setJourneyMessage(event.message)
          }
        },
        onToken: (text) => {
          if (!text) return
          setJourneyMessage(null)
          setIsStreamingAnswer(true)
          streamDraftRef.current += text
          flushStreamDraft()
          scrollThreadToBottom('smooth')
        },
        onSession: (event) => {
          const session = {
            ...event.session,
            id: event.sessionId || event.session.id,
          }
          setActiveSessionId(session.id)
          setSessions((prev) => upsertSession(prev, session))
        },
        onResult: (data) => {
          if (tokenFlushRaf.current != null) {
            cancelAnimationFrame(tokenFlushRaf.current)
            tokenFlushRaf.current = null
          }
          setJourneyMessage(null)
          setIsStreamingAnswer(false)
          setStreamDraft('')
          streamDraftRef.current = ''
          const assistantMessage: ChatMessage = {
            id: `local-asst-${Date.now()}`,
            role: 'assistant',
            content: data.answer,
            sources: data.sources,
            meta: data.meta,
            createdAt: new Date().toISOString(),
          }
          const hasAnswer = Boolean(data.answer?.trim())
          const hasSources = (data.sources?.length ?? 0) > 0
          if (hasAnswer && hasSources) {
            setMessages((prev) => [...prev, assistantMessage])
            setResult(data)
            setStatus('done')
            scrollThreadToBottom('smooth')
          } else {
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              return last?.role === 'user' ? prev.slice(0, -1) : prev
            })
            setResult(null)
            setError('No answer or sources were returned. Please try again.')
            setStatus('error')
          }
        },
        onError: (message) => {
          if (tokenFlushRaf.current != null) {
            cancelAnimationFrame(tokenFlushRaf.current)
            tokenFlushRaf.current = null
          }
          setJourneyMessage(null)
          setIsStreamingAnswer(false)
          setStreamDraft('')
          streamDraftRef.current = ''
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            return last?.role === 'user' ? prev.slice(0, -1) : prev
          })
          setError(message)
          setStatus('error')
        },
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return

      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        handleSessionExpired(err.message)
        return
      }

      try {
        setJourneyMessage(
          mode === 'normal'
            ? 'Searching about the content'
            : 'Searching deeply about the content',
        )
        const data = await queryArchive(request)
        setJourneyMessage(null)
        setIsStreamingAnswer(false)
        setStreamDraft('')
        streamDraftRef.current = ''
        const assistantMessage: ChatMessage = {
          id: `local-asst-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
          meta: data.meta,
          createdAt: new Date().toISOString(),
        }
        const hasAnswer = Boolean(data.answer?.trim())
        const hasSources = (data.sources?.length ?? 0) > 0
        if (hasAnswer && hasSources) {
          setMessages((prev) => [...prev, assistantMessage])
          setResult(data)
          setStatus('done')
          void refreshChats()
          scrollThreadToBottom('smooth')
        } else {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            return last?.role === 'user' ? prev.slice(0, -1) : prev
          })
          setResult(null)
          setError('No answer or sources were returned. Please try again.')
          setStatus('error')
        }
      } catch (fallbackErr) {
        if (
          fallbackErr instanceof ApiError &&
          (fallbackErr.status === 401 || fallbackErr.status === 403)
        ) {
          handleSessionExpired(fallbackErr.message)
          return
        }
        const message =
          fallbackErr instanceof ApiError
            ? fallbackErr.message
            : err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'Something went wrong. Please try again.'
        setJourneyMessage(null)
        setIsStreamingAnswer(false)
        setStreamDraft('')
        streamDraftRef.current = ''
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          return last?.role === 'user' ? prev.slice(0, -1) : prev
        })
        setError(message)
        setStatus('error')
      }
    }
  }

  async function loadDiscoverHome() {
    setDiscoverLoading(true)
    setDiscoverError(null)
    try {
      const data = await fetchDiscoverHome()
      const catalog =
        data.sections.length > 0
          ? data.sections
          : DISCOVER_SECTIONS.map((section) => ({ section, count: 0 }))
      // Keep canonical order; ensure Front Page stays first / present.
      const byName = new Map(catalog.map((s) => [s.section, s]))
      const ordered = DISCOVER_SECTIONS.map(
        (section) => byName.get(section) ?? { section, count: 0 },
      )
      setDiscoverSections(ordered)
      setActiveDiscoverSection('Front Page')
      setFrontPageArticles(data.frontPage.articles)
      setDiscoverArticles(data.frontPage.articles)
      setDiscoverHomeLoaded(true)
    } catch (err) {
      if (
        signedIn &&
        err instanceof ApiError &&
        (err.status === 401 || err.status === 403)
      ) {
        handleSessionExpired(err.message)
        return
      }
      setDiscoverError(
        err instanceof ApiError ? err.message : 'Could not load Discover.',
      )
      setDiscoverArticles([])
      setFrontPageArticles([])
    } finally {
      setDiscoverLoading(false)
    }
  }

  async function handleSelectDiscoverSection(section: string) {
    setActiveDiscoverSection(section)
    setAppMode('discover')
    setDiscoverError(null)

    if (section === 'Front Page') {
      if (discoverHomeLoaded) {
        setDiscoverArticles(frontPageArticles)
        return
      }
      await loadDiscoverHome()
      return
    }

    setDiscoverLoading(true)
    try {
      const data = await fetchDiscoverSection(section)
      setDiscoverArticles(data.articles)
      setDiscoverSections((prev) =>
        prev.map((s) =>
          s.section === data.section ? { ...s, count: data.count } : s,
        ),
      )
    } catch (err) {
      if (
        signedIn &&
        err instanceof ApiError &&
        (err.status === 401 || err.status === 403)
      ) {
        handleSessionExpired(err.message)
        return
      }
      setDiscoverError(
        err instanceof ApiError
          ? err.message
          : `Could not load ${section}.`,
      )
      setDiscoverArticles([])
    } finally {
      setDiscoverLoading(false)
    }
  }

  useEffect(() => {
    if (appMode !== 'discover') return
    if (discoverHomeLoaded) return
    void loadDiscoverHome()
  }, [appMode, discoverHomeLoaded])

  function handleModeChange(mode: AppMode) {
    setAppMode(mode)
    setMobileNavOpen(false)
    if (mode === 'discover') {
      setError(null)
      setActiveDiscoverSection('Front Page')
      if (discoverHomeLoaded) {
        setDiscoverArticles(frontPageArticles)
      }
    }
  }

  function applySuggestion(text: string) {
    if (!signedIn || status === 'loading') return
    setAppMode('chat')
    setQuestion(text)
  }

  const canAsk = signedIn && question.trim().length > 0 && status !== 'loading'
  const userLabel = displayName(user)
  const userAvatar = avatarUrl(user)
  const chatBusy = status === 'loading'
  const hasThread = messages.length > 0

  function renderAskForm(compact: boolean) {
    return (
      <form
        onSubmit={handleAsk}
        className={`ask-shell${compact ? ' ask-shell-compact' : ''}`}
      >
        <label htmlFor={compact ? 'question-followup' : 'question'} className="sr-only">
          {compact ? 'Continue this chat' : 'Ask the archive'}
        </label>
        <textarea
          id={compact ? 'question-followup' : 'question'}
          name="question"
          rows={compact ? 2 : 3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            compact
              ? 'Ask a follow-up in this chat…'
              : 'Type your question as today’s lead headline…'
          }
          disabled={status === 'loading'}
          className="ask-input"
        />
        <div className="ask-toolbar">
          <div className="ask-toolbar-left">
            <button type="submit" className="ask-btn" disabled={!canAsk}>
              {status === 'loading' ? 'Working…' : compact ? 'Send' : 'Ask'}
            </button>

            <div className="turbo-panel">
              <label
                className={`turbo-toggle${turboOn ? ' turbo-toggle-on' : ''}`}
                title="Turbo mode: deeper retrieval and more accurate answers"
              >
                <input
                  type="checkbox"
                  checked={turboOn}
                  onChange={(e) => setTurboOn(e.target.checked)}
                  disabled={status === 'loading'}
                />
                <span className="turbo-switch" aria-hidden />
                <span className="turbo-label">Turbo mode</span>
              </label>

              {turboOn && (
                <div
                  className="turbo-kind"
                  role="radiogroup"
                  aria-label="Turbo answer length"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={turboKind === 'short'}
                    className={`turbo-kind-option${turboKind === 'short' ? ' turbo-kind-active' : ''}`}
                    onClick={() => setTurboKind('short')}
                    disabled={status === 'loading'}
                  >
                    Short
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={turboKind === 'research'}
                    className={`turbo-kind-option${turboKind === 'research' ? ' turbo-kind-active' : ''}`}
                    onClick={() => setTurboKind('research')}
                    disabled={status === 'loading'}
                  >
                    Research
                  </button>
                </div>
              )}
            </div>
          </div>
          {status === 'loading' ? (
            <div className="loading-bar" aria-hidden />
          ) : (
            <span className="ask-toolbar-hint">{modeHint(mode)}</span>
          )}
        </div>
      </form>
    )
  }

  return (
    <div className={`app-shell${mobileNavOpen ? ' mobile-nav-open' : ''}`}>
      <div className="paper">
        <header className="masthead masthead-desktop">
          <h1 className="sr-only">The Hindu Archive Q&amp;A</h1>

          <div className="masthead-side masthead-left mt-2">
            <p className="masthead-weekday">{editionParts.weekday}</p>
            <p className="masthead-date">{editionParts.date}</p>
            <p className="masthead-edition">ARCHIVE EDITION</p>
            <p className="masthead-pages">Q&amp;A Desk</p>
          </div>

          <div className="masthead-logo">
            <img
              src="/hindu-masthead.png"
              alt="The Hindu — India's National Newspaper Since 1878"
              width={900}
              height={120}
              decoding="async"
            />
          </div>

          <div className="masthead-side masthead-right mt-2">
            <div className="masthead-right-top">
              <p className="masthead-follow">ARCHIVE Q&amp;A</p>
              <p className="masthead-link">Ask the paper</p>
              <p className="masthead-link">Cited sources</p>
              <p className="masthead-link">One front page</p>
            </div>
            <p className="masthead-vol">Vol. Q&amp;A · Version 2.0</p>
          </div>
        </header>

        <header className="masthead-mobile">
          <button
            type="button"
            className="mobile-menu-btn"
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            <span className="mobile-menu-icon" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </button>
          <div className="masthead-mobile-center">
            <img
              className="masthead-mobile-logo"
              src="/hindu-masthead.png"
              alt="The Hindu"
              width={280}
              height={40}
              decoding="async"
            />
            <p className="masthead-mobile-date">{editionParts.date}</p>
          </div>
          <span className="masthead-mobile-spacer" aria-hidden />
        </header>

        <div className="city-bar city-bar-desktop" aria-hidden>
          {CITIES.map((city, i) => (
            <span key={city} className="city-group">
              <span className="city-name">{city}</span>
              {i < CITIES.length - 1 && (
                <span className="city-sep" aria-hidden>
                  »
                </span>
              )}
            </span>
          ))}
        </div>

        {backendStatus === 'down' ? (
          <BackendDown
            onRetry={() => void handleBackendRetry()}
            retrying={backendRetrying}
          />
        ) : (
          <>
        {healthWarning && (
          <div role="status" className="banner-warn">
            {healthWarning}
          </div>
        )}

        <section className="feature-row feature-row-desktop" aria-label="About this website">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className={`feature-cell feature-tone-${f.tone}`}
            >
              <p className="feature-kicker">{f.kicker}</p>
              <h2 className="feature-title">{f.title}</h2>
              <p className="feature-blurb">{f.blurb}</p>
            </article>
          ))}
        </section>

        <button
          type="button"
          className={`mobile-drawer-backdrop${mobileNavOpen ? ' is-open' : ''}`}
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />

        <div className="page-grid page-grid-chats">
          <div className={`sidebar-slot${mobileNavOpen ? ' is-open' : ''}`}>
            <ChatSidebar
              appMode={appMode}
              onModeChange={handleModeChange}
              signedIn={signedIn}
              sessions={sessions}
              activeId={activeSessionId}
              loading={chatsLoading}
              busy={chatBusy}
              userName={userLabel}
              userAvatar={userAvatar}
              suggestions={INSIDE}
              discoverSections={discoverSections}
              activeDiscoverSection={activeDiscoverSection}
              onSelectDiscoverSection={(section) => {
                void handleSelectDiscoverSection(section)
              }}
              onNewChat={handleNewChat}
              onSelect={(id) => void handleSelectChat(id)}
              onLogout={() => void handleLogout()}
              onSuggest={applySuggestion}
              onClose={() => setMobileNavOpen(false)}
              showClose
            />
          </div>

          <main className="lead-col">
            {appMode === 'discover' ? (
              <DiscoverFeed
                section={activeDiscoverSection}
                articles={discoverArticles}
                loading={discoverLoading}
                error={discoverError}
              />
            ) : (
              <>
            {signedIn && !hasThread && (
              <div className="lead-headline-block">
                <p className="ask-deck">
                  A living front page for the archive: put your question where the lead
                  headline usually sits. A new chat is created on your first Ask.
                </p>
              </div>
            )}

            {authStatus === 'checking' ? (
              <section className="auth-lead auth-lead-checking">
                <p className="auth-eyebrow">Archive edition</p>
                <h2 className="auth-headline">Checking your press pass…</h2>
                <div className="loading-bar" aria-hidden />
              </section>
            ) : !signedIn ? (
              <GoogleSignIn onSignedIn={handleSignedIn} />
            ) : !hasThread ? (
              renderAskForm(false)
            ) : null}

            {signedIn && hasThread && (
              <section ref={answerRef} className="chat-thread-wrap scroll-mt-6">
                <ChatThread
                  messages={messages}
                  showAllSources={showAllSources}
                  onToggleSources={() => setShowAllSources((v) => !v)}
                  showPendingQuestion={status === 'loading'}
                />
              </section>
            )}

            {signedIn && status === 'loading' && journeyMessage && !isStreamingAnswer && (
              <JourneyStatus message={journeyMessage} />
            )}

            {signedIn && status === 'loading' && isStreamingAnswer && (
              <section className="section-rule scroll-mt-6" aria-labelledby="stream-heading">
                <h2 id="stream-heading" className="section-label">
                  Answer
                </h2>
                <p className="answer-mode-note">Turbo Research · streaming</p>
                {streamDraft ? (
                  <StreamingAnswer text={streamDraft} />
                ) : (
                  <p className="answer-stream-waiting">
                    <span className="answer-caret" aria-hidden />
                    Writing…
                  </p>
                )}
              </section>
            )}

            {error && (
              <div role="alert" className="banner-warn animate-fade-up">
                {error}
              </div>
            )}

            {signedIn && hasThread && (
              <div className="chat-followup">
                <p className="chat-followup-label">Continue this chat</p>
                {renderAskForm(true)}
              </div>
            )}

            {signedIn && <div ref={threadEndRef} className="chat-thread-end" aria-hidden />}

            {!signedIn && (
              <section className="about-block" aria-labelledby="about-heading">
                <h2 id="about-heading" className="sr-only">
                  About this website
                </h2>
                <p className="about-lead">
                  This website turns The Hindu archive into an interactive edition.
                  Instead of scrolling for a story, you ask the paper — and it
                  answers with citations from indexed article chunks.
                </p>

                <div className="about-how">
                  <h3 className="about-subhead">How the desk works</h3>
                  <ol className="about-steps">
                    <li>
                      <span className="about-step-num">1</span>
                      <div>
                        <p className="about-step-title">Sign in</p>
                        <p className="about-step-body">
                          Open the edition with Google. Your chats appear in the
                          Inside column.
                        </p>
                      </div>
                    </li>
                    <li>
                      <span className="about-step-num">2</span>
                      <div>
                        <p className="about-step-title">Ask the lead</p>
                        <p className="about-step-body">
                          Put your question in the headline slot. Start a new chat
                          anytime from the sidebar.
                        </p>
                      </div>
                    </li>
                    <li>
                      <span className="about-step-num">3</span>
                      <div>
                        <p className="about-step-title">Read with citations</p>
                        <p className="about-step-body">
                          Follow the journey line, then the answer and sources —
                          jump to the PDF page when you need the full clip.
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>
              </section>
            )}

            {signedIn && status === 'idle' && !hasThread && !result && (
              <section className="about-block">
                <p className="about-lead">
                  Start a new lead above, or open a previous chat from the Inside
                  column. Each Ask is saved to the active thread.
                </p>
              </section>
            )}
              </>
            )}
          </main>
        </div>
          </>
        )}

        <footer className="site-footer">
          <div className="site-footer-left">
            <p className="site-footer-brand">The Hindu Bot.AI</p>
            {signedIn ? (
              <a
                className="site-footer-pdf"
                href={getManualPdfUrl()}
                target="_blank"
                rel="noreferrer noopener"
              >
                View newspaper PDF »
              </a>
            ) : (
              <span className="site-footer-pdf site-footer-pdf-muted">
                Sign in to view newspaper PDF »
              </span>
            )}
          </div>
          <p className="site-footer-credit">
            Made with{' '}
            <svg
              className="site-footer-heart"
              viewBox="0 0 24 24"
              width="12"
              height="12"
              aria-hidden
            >
              <path
                fill="currentColor"
                d="M12 21s-6.7-4.35-9.33-7.4C.7 11.3 1.1 7.8 3.8 6.2c2-1.2 4.5-.55 5.85 1.2L12 10l2.35-2.6c1.35-1.75 3.85-2.4 5.85-1.2 2.7 1.6 3.1 5.1 1.13 7.4C18.7 16.65 12 21 12 21z"
              />
            </svg>{' '}
            by Aditya Kumar
          </p>
        </footer>
      </div>
    </div>
  )
}
