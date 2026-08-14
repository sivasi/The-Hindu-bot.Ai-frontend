import { relativeTime } from '../chats'
import type { ChatSession } from '../types'

export type InsideSuggestion = {
  head: string
  snip: string
  q: string
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
}: ChatSidebarProps) {
  const showInside = !loading && sessions.length === 0
  const showNewChat = sessions.length > 0

  return (
    <aside className="inside-col chat-sidebar" aria-label="Chat history">
      <div className="chat-sidebar-top">
        <div className="chat-sidebar-head">
          <h2 className={`inside-title${showInside ? '' : ' chat-title'}`}>
            {showInside ? 'Inside' : 'Chats'}
          </h2>
          {showNewChat && (
            <button
              type="button"
              className="chat-new-btn"
              onClick={onNewChat}
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
                onClick={() => onSuggest(item.q)}
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
              const snip =
                session.preview?.trim() ||
                relativeTime(session.lastMessageAt || session.createdAt) ||
                'Open this chat'
              return (
                <li
                  key={session.id}
                  className={`chat-session-item${active ? ' chat-session-active' : ''}`}
                >
                  <button
                    type="button"
                    className="inside-item chat-session-main"
                    onClick={() => onSelect(session.id)}
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
