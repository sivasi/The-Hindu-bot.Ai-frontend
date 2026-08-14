import { relativeTime } from '../chats'
import type { ChatSession } from '../types'

export type InsideSuggestion = {
  head: string
  snip: string
  q: string
}

function truncatePlain(text: string, max = 72): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  return cleaned.slice(0, max).trimEnd()
}

type ChatSidebarProps = {
  sessions: ChatSession[]
  activeId: string | null
  loading?: boolean
  busy?: boolean
  userName: string
  userAvatar: string | null
  suggestions: readonly InsideSuggestion[]
  onNewChat: () => void
  onSelect: (id: string) => void
  onLogout: () => void
  onSuggest: (question: string) => void
  onClose?: () => void
  showClose?: boolean
}

export function ChatSidebar({
  sessions,
  activeId,
  loading,
  busy,
  userName,
  userAvatar,
  suggestions,
  onNewChat,
  onSelect,
  onLogout,
  onSuggest,
  onClose,
  showClose,
}: ChatSidebarProps) {
  const showInside = !loading && sessions.length === 0
  const showNewChat = sessions.length > 0

  function selectSession(id: string) {
    onSelect(id)
    onClose?.()
  }

  function suggest(q: string) {
    onSuggest(q)
    onClose?.()
  }

  function startNewChat() {
    onNewChat()
    onClose?.()
  }

  return (
    <aside className="inside-col chat-sidebar" aria-label="Chat history">
      <div className="chat-sidebar-top">
        <div className="chat-sidebar-head">
          <div className="chat-sidebar-title-row">
            <h2 className={`inside-title${showInside ? '' : ' chat-title'}`}>
              {showInside ? 'Inside' : 'Chats'}
            </h2>
            {showClose ? (
              <button
                type="button"
                className="mobile-drawer-close"
                onClick={onClose}
                aria-label="Close menu"
              >
                ✕
              </button>
            ) : null}
          </div>
          {showNewChat && (
            <button
              type="button"
              className="chat-new-btn"
              onClick={startNewChat}
              disabled={busy}
            >
              New chat
            </button>
          )}
        </div>

        {loading ? (
          <p className="chat-sidebar-empty">Loading sessions…</p>
        ) : showInside ? (
          <div className="chat-inside-list">
            {suggestions.map((item) => (
              <button
                key={item.head}
                type="button"
                className="inside-item"
                onClick={() => suggest(item.q)}
                disabled={busy}
              >
                <p className="inside-head">{item.head}</p>
                <p className="inside-snip">{item.snip}</p>
              </button>
            ))}
          </div>
        ) : (
          <ul className="chat-session-list">
            {sessions.map((session) => {
              const active = session.id === activeId
              const snip = truncatePlain(
                session.preview?.trim() ||
                  relativeTime(session.lastMessageAt || session.createdAt) ||
                  'Open this chat',
              )
              return (
                <li
                  key={session.id}
                  className={`chat-session-item${active ? ' chat-session-active' : ''}`}
                >
                  <button
                    type="button"
                    className="inside-item chat-session-main"
                    onClick={() => selectSession(session.id)}
                    disabled={busy}
                  >
                    <p className="inside-head">{session.title || 'New chat'}</p>
                    <p className="inside-snip">{snip}</p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="chat-sidebar-user">
        <div className="chat-sidebar-user-card">
          {userAvatar ? (
            <img
              className="chat-sidebar-user-avatar"
              src={userAvatar}
              alt=""
              width={36}
              height={36}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="chat-sidebar-user-fallback" aria-hidden>
              {userName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="chat-sidebar-user-meta">
            <p className="chat-sidebar-user-kicker">Signed in</p>
            <p className="chat-sidebar-user-name" title={userName}>
              {userName}
            </p>
            <button
              type="button"
              className="chat-sidebar-signout"
              onClick={onLogout}
            >
              Sign out »
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
