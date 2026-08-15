import { relativeTime } from '../chats'
import type { ChatSession, DiscoverSectionInfo } from '../types'

export type AppMode = 'discover' | 'chat'

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
  appMode: AppMode
  onModeChange: (mode: AppMode) => void
  signedIn: boolean
  sessions: ChatSession[]
  activeId: string | null
  loading?: boolean
  busy?: boolean
  userName: string
  userAvatar: string | null
  suggestions: readonly InsideSuggestion[]
  discoverSections: DiscoverSectionInfo[]
  activeDiscoverSection: string
  onSelectDiscoverSection: (section: string) => void
  onNewChat: () => void
  onSelect: (id: string) => void
  onLogout: () => void
  onSuggest: (question: string) => void
  onClose?: () => void
  showClose?: boolean
}

export function ChatSidebar({
  appMode,
  onModeChange,
  signedIn,
  sessions,
  activeId,
  loading,
  busy,
  userName,
  userAvatar,
  suggestions,
  discoverSections,
  activeDiscoverSection,
  onSelectDiscoverSection,
  onNewChat,
  onSelect,
  onLogout,
  onSuggest,
  onClose,
  showClose,
}: ChatSidebarProps) {
  const showInside = !loading && sessions.length === 0
  const showNewChat = signedIn && sessions.length > 0
  const sectionTitle = showInside || !signedIn ? 'Inside' : 'Chats'

  function goDiscover() {
    onModeChange('discover')
    onClose?.()
  }

  function goChat() {
    onModeChange('chat')
  }

  function selectSession(id: string) {
    onModeChange('chat')
    onSelect(id)
    onClose?.()
  }

  function suggest(q: string) {
    onModeChange('chat')
    onSuggest(q)
    onClose?.()
  }

  function startNewChat() {
    onNewChat()
    onClose?.()
  }

  function selectDiscoverSection(section: string) {
    onModeChange('discover')
    onSelectDiscoverSection(section)
    onClose?.()
  }

  return (
    <aside className="inside-col chat-sidebar" aria-label="Edition navigation">
      <div className="chat-sidebar-top">
        <div
          className={`sidebar-mode-row${appMode === 'discover' ? ' sidebar-mode-row-active' : ''}`}
        >
          <button
            type="button"
            className={`sidebar-mode-label${appMode === 'discover' ? ' sidebar-mode-label-active' : ''}`}
            aria-current={appMode === 'discover' ? 'page' : undefined}
            onClick={goDiscover}
          >
            Discover
          </button>
        </div>

        {appMode === 'discover' ? (
          <ul className="discover-section-list" aria-label="Discover sections">
            {discoverSections.map((item) => {
              const active = item.section === activeDiscoverSection
              return (
                <li key={item.section}>
                  <button
                    type="button"
                    className={`inside-item discover-section-item${active ? ' discover-section-active' : ''}`}
                    onClick={() => selectDiscoverSection(item.section)}
                    aria-current={active ? 'true' : undefined}
                  >
                    <p className="inside-head">{item.section}</p>
                    <p className="inside-snip">
                      {item.count} {item.count === 1 ? 'article' : 'articles'}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}

        <div className="chat-sidebar-head">
          <div
            className={`chat-sidebar-title-row${appMode === 'chat' ? ' sidebar-mode-row-active' : ''}`}
          >            <button
              type="button"
              className={`sidebar-mode-label${appMode === 'chat' ? ' sidebar-mode-label-active' : ''}`}
              aria-current={appMode === 'chat' ? 'page' : undefined}
              onClick={goChat}
            >
              {sectionTitle}
            </button>
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
          {showNewChat && appMode === 'chat' ? (
            <button
              type="button"
              className="chat-new-btn"
              onClick={startNewChat}
              disabled={busy}
            >
              New chat
            </button>
          ) : null}
        </div>

        {appMode === 'discover' ? null : loading && signedIn ? (
          <p className="chat-sidebar-empty">Loading sessions…</p>
        ) : showInside || !signedIn ? (
          <div className="chat-inside-list">
            {suggestions.map((item) => (
              <button
                key={item.head}
                type="button"
                className="inside-item"
                onClick={() => suggest(item.q)}
                disabled={!signedIn || busy}
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

      {signedIn ? (
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
      ) : null}
    </aside>
  )
}
