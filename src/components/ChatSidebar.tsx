import { useEffect, useRef, useState } from 'react'
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
  onRename: (id: string, title: string) => Promise<void> | void
  onDelete: (id: string) => Promise<void> | void
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
  onRename,
  onDelete,
  onLogout,
  onSuggest,
}: ChatSidebarProps) {
  const [menuId, setMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuId(null)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function startRename(session: ChatSession) {
    setMenuId(null)
    setRenamingId(session.id)
    setRenameValue(session.title || '')
  }

  async function commitRename(id: string) {
    const next = renameValue.trim()
    setRenamingId(null)
    if (!next) return
    await onRename(id, next)
  }

  const showInside = !loading && sessions.length === 0
  const showNewChat = sessions.length > 0

  return (
    <aside className="inside-col chat-sidebar" aria-label="Chat history">
      <div className="chat-sidebar-top">
        <div className="chat-sidebar-head">
          <h2 className="inside-title">{showInside ? 'Inside' : 'Chats'}</h2>
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
              const renaming = renamingId === session.id
              const snip =
                session.preview?.trim() ||
                relativeTime(session.lastMessageAt || session.createdAt) ||
                'Open this chat'
              return (
                <li
                  key={session.id}
                  className={`chat-session-item${active ? ' chat-session-active' : ''}${menuId === session.id ? ' chat-session-menu-open' : ''}`}
                >
                  {renaming ? (
                    <form
                      className="chat-rename-form"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void commitRename(session.id)
                      }}
                    >
                      <input
                        className="chat-rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                        onBlur={() => void commitRename(session.id)}
                        disabled={busy}
                      />
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="inside-item chat-session-main"
                        onClick={() => onSelect(session.id)}
                        disabled={busy}
                      >
                        <p className="inside-head">{session.title || 'New chat'}</p>
                        <p className="inside-snip">{snip}</p>
                      </button>
                      <div
                        className="chat-session-menu-wrap"
                        ref={menuId === session.id ? menuRef : undefined}
                      >
                        <button
                          type="button"
                          className="chat-session-menu-btn"
                          aria-label="Chat options"
                          aria-expanded={menuId === session.id}
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuId((cur) =>
                              cur === session.id ? null : session.id,
                            )
                          }}
                        >
                          ⋯
                        </button>
                        {menuId === session.id ? (
                          <div className="chat-session-menu" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => startRename(session)}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="chat-session-menu-danger"
                              onClick={() => {
                                setMenuId(null)
                                void onDelete(session.id)
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
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
