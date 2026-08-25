import { lazy, Suspense, useEffect, useState } from 'react'
import { API_URL } from '../api'
import { authHeaders } from '../token'
import type { ArchiveIssue } from '../types'

const AdminDesk = lazy(() => import('./AdminDesk'))

type AdminGateProps = {
  onDenied: () => void
  onUploaded?: (issue: ArchiveIssue) => void
}

async function confirmPublisherAccess(): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/publisher/access`, {
    headers: authHeaders(),
  })
  if (!res.ok) return false
  const data = (await res.json()) as { allowed?: boolean }
  return data.allowed === true
}

export default function AdminGate({ onDenied, onUploaded }: AdminGateProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    let live = true
    confirmPublisherAccess()
      .then((ok) => {
        if (!live) return
        setAllowed(ok)
        if (!ok) onDenied()
      })
      .catch(() => {
        if (!live) return
        setAllowed(false)
        onDenied()
      })
    return () => {
      live = false
    }
  }, [onDenied])

  if (allowed !== true) {
    return (
      <section className="discover-page admin-page" aria-label="Admin">
        <p className="discover-status">Checking publisher access…</p>
        <div className="loading-bar" aria-hidden />
      </section>
    )
  }

  return (
    <Suspense
      fallback={
        <section className="discover-page admin-page" aria-label="Admin">
          <p className="discover-status">Loading admin desk…</p>
          <div className="loading-bar" aria-hidden />
        </section>
      }
    >
      <AdminDesk onUploaded={onUploaded} />
    </Suspense>
  )
}
