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
import { GoogleSignIn } from './components/GoogleSignIn'
import { JourneyStatus } from './components/JourneyStatus'
import { MarkdownAnswer } from './components/MarkdownAnswer'
import { SourceItem } from './components/SourceItem'
import { StreamingAnswer } from './components/StreamingAnswer'
import type { QueryMode, QueryResponse } from './types'

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
    kicker: 'Way forward',
    tone: 'red',
    title: 'One front page. One question.',
    blurb: 'No chat history screen — type above the fold and read below.',
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
  const [result, setResult] = useState<QueryResponse | null>(null)
  const [journeyMessage, setJourneyMessage] = useState<string | null>(null)
  const [showAllSources, setShowAllSources] = useState(false)
  const [streamDraft, setStreamDraft] = useState('')
  const [isStreamingAnswer, setIsStreamingAnswer] = useState(false)
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [user, setUser] = useState<AuthUser | null>(null)
  const answerRef = useRef<HTMLElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const streamDraftRef = useRef('')
  const tokenFlushRaf = useRef<number | null>(null)

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

  useEffect(() => {
    let cancelled = false
    checkHealth()
      .then((h) => {
        if (cancelled) return
        if (!h.ok || !h.chromaOk || !h.indexReady) {
          setHealthWarning(
            'Archive index may be unavailable. Answers could fail until the backend is ready.',
          )
        } else {
          setHealthWarning(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHealthWarning(
            'Could not reach the archive API. Check that the backend is running on port 3001.',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

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
        // Token present but /me unavailable — keep session for Ask until a 401.
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
    return () => {
      abortRef.current?.abort()
      if (tokenFlushRaf.current != null) {
        cancelAnimationFrame(tokenFlushRaf.current)
      }
    }
  }, [])

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

  function handleSessionExpired(message?: string) {
    clearToken()
    setUser(null)
    setAuthStatus('signed_out')
    setResult(null)
    setJourneyMessage(null)
    setIsStreamingAnswer(false)
    setStreamDraft('')
    streamDraftRef.current = ''
    setStatus('idle')
    setError(message || 'Session expired. Please sign in again.')
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

    setStatus('loading')
    setError(null)
    setResult(null)
    setShowAllSources(false)
    setStreamDraft('')
    streamDraftRef.current = ''
    setIsStreamingAnswer(false)
    setJourneyMessage(
      mode === 'normal'
        ? 'Searching about the content'
        : 'Searching deeply about the content',
    )

    const request = { question: trimmed, mode }

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
          const wasEmpty = streamDraftRef.current.length === 0
          setJourneyMessage(null)
          setIsStreamingAnswer(true)
          streamDraftRef.current += text
          flushStreamDraft()
          if (wasEmpty) {
            requestAnimationFrame(() => {
              answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            })
          }
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
          setResult(data)
          setStatus('done')
          requestAnimationFrame(() => {
            answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          })
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

      // Fallback to blocking /api/query if stream is unavailable
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
        setResult(data)
        setStatus('done')
        requestAnimationFrame(() => {
          answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
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
        setError(message)
        setStatus('error')
      }
    }
  }

  function applySuggestion(text: string) {
    if (!signedIn || status === 'loading') return
    setQuestion(text)
  }

  const canAsk = signedIn && question.trim().length > 0 && status !== 'loading'
  const userLabel = displayName(user)
  const userAvatar = avatarUrl(user)
  const resultMode =
    result?.meta?.mode ??
    (result?.meta?.turbo ? 'turbo_research' : result ? 'normal' : null)

  return (
    <div className="app-shell">
      <div className="paper">
        <header className="masthead">
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
              {signedIn ? (
                <>
                  <div className="masthead-user">
                    {userAvatar ? (
                      <img
                        className="masthead-user-avatar"
                        src={userAvatar}
                        alt=""
                        width={22}
                        height={22}
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <p className="masthead-link masthead-user-name">{userLabel}</p>
                  </div>
                  <button
                    type="button"
                    className="masthead-signout"
                    onClick={() => void handleLogout()}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <p className="masthead-link">Ask the paper</p>
                  <p className="masthead-link">Cited sources</p>
                  <p className="masthead-link">Sign in required</p>
                </>
              )}
            </div>
            <p className="masthead-vol">Vol. Q&amp;A · No. 1</p>
          </div>
        </header>

        <div className="city-bar" aria-hidden>
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

        {healthWarning && (
          <div role="status" className="banner-warn">
            {healthWarning}
          </div>
        )}

        <section className="feature-row" aria-label="About this website">
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

        <div className="page-grid">
          <aside className="inside-col" aria-label="Inside">
            <h2 className="inside-title">Inside</h2>
            {INSIDE.map((item) => (
              <button
                key={item.head}
                type="button"
                className="inside-item"
                onClick={() => applySuggestion(item.q)}
                disabled={!signedIn || status === 'loading'}
              >
                <p className="inside-head">{item.head}</p>
                <p className="inside-snip">{item.snip}</p>
              </button>
            ))}
          </aside>

          <main className="lead-col">
            <div className="lead-headline-block">
              <p className="ask-deck">
                A living front page for the archive: put your question where the lead
                headline usually sits, and the desk answers from retrieved newspaper
                chunks — with sources printed underneath.
              </p>
            </div>

            {authStatus === 'checking' ? (
              <div className="auth-gate auth-gate-checking">
                <p className="auth-kicker">Subscriber desk</p>
                <p className="auth-status">Checking your press pass…</p>
              </div>
            ) : !signedIn ? (
              <GoogleSignIn onSignedIn={handleSignedIn} />
            ) : (
              <form onSubmit={handleAsk} className="ask-shell">
                <label htmlFor="question" className="sr-only">
                  Ask the archive
                </label>
                <textarea
                  id="question"
                  name="question"
                  rows={3}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Type your question as today’s lead headline…"
                  disabled={status === 'loading'}
                  className="ask-input"
                />
                <div className="ask-toolbar">
                  <div className="ask-toolbar-left">
                    <button type="submit" className="ask-btn" disabled={!canAsk}>
                      {status === 'loading' ? 'Working…' : 'Ask'}
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
            )}

            {signedIn && status === 'loading' && journeyMessage && !isStreamingAnswer && (
              <JourneyStatus message={journeyMessage} />
            )}

            {error && (
              <div role="alert" className="banner-warn animate-fade-up">
                {error}
              </div>
            )}

            {signedIn && status !== 'done' && status !== 'loading' && (
              <section className="about-block" aria-labelledby="about-heading">
                <h2 id="about-heading" className="sr-only">
                  About this website
                </h2>
                <p className="about-lead">
                  This website turns The Hindu archive into an interactive edition.
                  Instead of scrolling for a story, you ask the paper — and it
                  answers with citations from indexed article chunks.
                </p>
              </section>
            )}

            {signedIn && status === 'loading' && isStreamingAnswer && (
              <section
                ref={answerRef}
                className="section-rule scroll-mt-6"
                aria-labelledby="answer-heading"
              >
                <h2 id="answer-heading" className="section-label">
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

            {signedIn && status === 'done' && result && (
              <>
                <section
                  ref={answerRef}
                  className="section-rule animate-fade-up scroll-mt-6"
                  aria-labelledby="answer-heading"
                >
                  <h2 id="answer-heading" className="section-label">
                    Answer
                  </h2>
                  {resultMode && resultMode !== 'normal' ? (
                    <p className="answer-mode-note">
                      {resultMode === 'turbo_short'
                        ? 'Turbo Short · deeper · more accurate · brief'
                        : 'Turbo Research · deeper · more accurate · longer'}
                    </p>
                  ) : null}
                  {result.answer?.trim() ? (
                    <MarkdownAnswer content={result.answer} />
                  ) : (
                    <p className="italic text-[var(--ink-muted)]">
                      No answer was returned for this question.
                    </p>
                  )}
                </section>

                <section
                  className="section-rule animate-fade-up"
                  style={{ animationDelay: '80ms' }}
                  aria-labelledby="sources-heading"
                >
                  <h2 id="sources-heading" className="section-label">
                    Sources
                  </h2>
                  {result.sources?.length ? (
                    <>
                      <ul className="source-list">
                        {(showAllSources
                          ? result.sources
                          : result.sources.slice(0, 3)
                        ).map((source, i) => (
                          <SourceItem
                            key={`${source.heading}-${source.chunkIndex}-${source.pageNumber}-${i}`}
                            source={source}
                            index={i}
                          />
                        ))}
                      </ul>
                      {result.sources.length > 3 && (
                        <button
                          type="button"
                          className="sources-more"
                          onClick={() => setShowAllSources((v) => !v)}
                          aria-expanded={showAllSources}
                        >
                          {showAllSources
                            ? 'Show fewer sources'
                            : `Show ${result.sources.length - 3} more sources`}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="italic text-[var(--ink-muted)]">
                      No sources were retrieved for this answer.
                    </p>
                  )}
                </section>
              </>
            )}
          </main>
        </div>

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
