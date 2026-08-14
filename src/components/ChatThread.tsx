import { useEffect, useMemo, useState } from 'react'
import { MarkdownAnswer } from './MarkdownAnswer'
import { SourceItem } from './SourceItem'
import type { ChatMessage } from '../types'

type ChatThreadProps = {
  messages: ChatMessage[]
  showAllSources: boolean
  onToggleSources: () => void
  /** Keep the latest unanswered question visible while a reply is in flight. */
  showPendingQuestion?: boolean
}

function useIsMobile(maxWidth = 900) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(`(max-width: ${maxWidth}px)`).matches
      : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [maxWidth])

  return isMobile
}

function isCompleteAssistant(msg: ChatMessage): boolean {
  return Boolean(msg.content?.trim()) && (msg.sources?.length ?? 0) > 0
}

/** Drop failed turns: questions with no usable answer/sources. */
export function pruneIncompleteTurns(messages: ChatMessage[]): ChatMessage[] {
  return visibleMessages(messages, false)
}

function visibleMessages(
  messages: ChatMessage[],
  showPendingQuestion: boolean,
): ChatMessage[] {
  const out: ChatMessage[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]

    if (msg.role === 'user') {
      const next = messages[i + 1]
      if (next?.role === 'assistant' && isCompleteAssistant(next)) {
        out.push(msg)
        continue
      }
      const isLast = i === messages.length - 1
      const awaitingReply = !next || next.role !== 'assistant'
      if (showPendingQuestion && isLast && awaitingReply) {
        out.push(msg)
      }
      continue
    }

    if (isCompleteAssistant(msg)) {
      out.push(msg)
    }
  }

  return out
}

export function ChatThread({
  messages,
  showAllSources,
  showPendingQuestion = false,
}: ChatThreadProps) {
  const isMobile = useIsMobile()
  const previewCount = isMobile ? 2 : 3
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const thread = useMemo(
    () => visibleMessages(messages, showPendingQuestion),
    [messages, showPendingQuestion],
  )
  const threadKey = thread.map((m) => m.id).join('|')

  useEffect(() => {
    setExpandedIds({})
  }, [threadKey, showAllSources])

  if (!thread.length) return null

  function toggleExpanded(msgId: string) {
    setExpandedIds((prev) => ({ ...prev, [msgId]: !prev[msgId] }))
  }

  return (
    <div className="chat-thread" aria-label="Conversation">
      {thread.map((msg) => {
        if (msg.role === 'user') {
          return (
            <article key={msg.id} className="chat-turn chat-turn-user">
              <p className="chat-turn-label">Question</p>
              <p className="chat-turn-user-text">{msg.content}</p>
            </article>
          )
        }

        const sources = msg.sources ?? []
        const mode = msg.meta?.mode
        const expanded = Boolean(expandedIds[msg.id])
        const visibleSources = expanded
          ? sources
          : sources.slice(0, previewCount)
        const hiddenCount = Math.max(0, sources.length - previewCount)
        const canToggle = hiddenCount > 0

        return (
          <article key={msg.id} className="chat-turn chat-turn-assistant">
            <p className="chat-turn-label">Answer</p>
            {mode && mode !== 'normal' ? (
              <p className="answer-mode-note">
                {mode === 'turbo_short'
                  ? 'Turbo Short · deeper · more accurate · brief'
                  : 'Turbo Research · deeper · more accurate · longer'}
              </p>
            ) : null}
            <MarkdownAnswer content={msg.content} />
            <div
              className={`chat-turn-sources${isMobile ? ' chat-turn-sources-mobile' : ''}`}
            >
              <h3 className="chat-turn-sources-title">Sources</h3>
              <ul className={`source-list${isMobile ? ' source-list-mobile' : ''}`}>
                {visibleSources.map((source, i) => (
                  <SourceItem
                    key={`${msg.id}-${source.heading}-${source.chunkIndex}-${source.pageNumber}-${i}`}
                    source={source}
                    index={i}
                    compact={isMobile}
                  />
                ))}
                {isMobile && canToggle ? (
                  <li className="source-item source-item-compact source-more-item">
                    <button
                      type="button"
                      className="source-compact-more"
                      onClick={() => toggleExpanded(msg.id)}
                      aria-expanded={expanded}
                    >
                      {expanded ? 'Show fewer' : 'Show more'}
                    </button>
                  </li>
                ) : null}
              </ul>
              {!isMobile && canToggle ? (
                <button
                  type="button"
                  className="sources-more"
                  onClick={() => toggleExpanded(msg.id)}
                  aria-expanded={expanded}
                >
                  {expanded
                    ? 'Show fewer sources'
                    : `Show ${hiddenCount} more sources`}
                </button>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
