import { useEffect, useState } from 'react'
import { MarkdownAnswer } from './MarkdownAnswer'
import { SourceItem } from './SourceItem'
import type { ChatMessage } from '../types'

type ChatThreadProps = {
  messages: ChatMessage[]
  showAllSources: boolean
  onToggleSources: () => void
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

export function ChatThread({
  messages,
  showAllSources,
  onToggleSources,
}: ChatThreadProps) {
  const isMobile = useIsMobile()
  const previewCount = isMobile ? 2 : 3

  if (!messages.length) return null

  return (
    <div className="chat-thread" aria-label="Conversation">
      {messages.map((msg, index) => {
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
        const isLastAssistant =
          index === messages.length - 1 ||
          !messages.slice(index + 1).some((m) => m.role === 'assistant')

        const visibleSources =
          isLastAssistant && !showAllSources
            ? sources.slice(0, previewCount)
            : sources

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
            {msg.content?.trim() ? (
              <MarkdownAnswer content={msg.content} />
            ) : (
              <p className="italic text-[var(--ink-muted)]">No answer was returned.</p>
            )}
            {sources.length > 0 ? (
              <div className={`chat-turn-sources${isMobile ? ' chat-turn-sources-mobile' : ''}`}>
                <h3 className="chat-turn-sources-title">Sources</h3>
                <ul className="source-list">
                  {visibleSources.map((source, i) => (
                    <SourceItem
                      key={`${msg.id}-${source.heading}-${source.chunkIndex}-${source.pageNumber}-${i}`}
                      source={source}
                      index={i}
                      compact={isMobile}
                    />
                  ))}
                </ul>
                {isLastAssistant && sources.length > previewCount ? (
                  <button
                    type="button"
                    className="sources-more"
                    onClick={onToggleSources}
                    aria-expanded={showAllSources}
                  >
                    {showAllSources
                      ? 'Show fewer'
                      : `+${sources.length - previewCount} more`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
