import { useEffect, useRef, useState } from 'react'
import { relativeTime } from '../chats'
import type { ChatSession } from '../types'

type ChatSidebarProps = {
  sessions: ChatSession[]
  activeId: string | null
  loading?: boolean
  busy?: boolean
  onNewChat: () => void
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => Promise<void> | void
  onDelete: (id: string) => Promise<void> | void
}

export function ChatSidebar({
  sessions,
  activeId,
  loading,
  busy,
  onNewChat,
  onSelect,
  onRename,
  onDelete,
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

  return (
    <aside className="inside-col chat-sidebar" aria-label="Chat history">
      <div className="chat-sidebar-head">
        <h2 className="inside-title">Chats</h2>
        <button
          type="button"
          className="chat-new-btn"
          onClick={onNewChat}
          disabled={busy}
        >
          New chat
        </button>
      </div>

      {loading ? (
        <p className="chat-sidebar-empty">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <p className="chat-sidebar-empty">
          No chats yet. Ask a question to start a thread.
        </p>
      ) : (
        <ul className="chat-session-list">
          {sessions.map((session) => {
            const active = session.id === activeId
            const renaming = renamingId === session.id
            return (
              <li
                key={session.id}
                className={`chat-session-item${active ? ' chat-session-active' : ''}`}
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
                      className="chat-session-main"
                      onClick={() => onSelect(session.id)}
                      disabled={busy}
                    >
                      <p className="chat-session-title">
                        {session.title || 'New chat'}
                      </p>
                      {session.preview ? (
                        <p className="chat-session-preview">{session.preview}</p>
                      ) : null}
                      <p className="chat-session-time">
                        {relativeTime(session.lastMessageAt || session.createdAt)}
                      </p>
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
    </aside>
  )
}
