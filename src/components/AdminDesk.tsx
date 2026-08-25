import { useState, type FormEvent } from 'react'
import { ApiError, API_URL } from '../api'
import { todayISO } from '../archive'
import { authHeaders, clearToken } from '../token'
import type { ArchiveIssue } from '../types'

type AdminDeskProps = {
  onUploaded?: (issue: ArchiveIssue) => void
}

function throwIfPublisherDenied(res: Response): void {
  if (res.status === 401) {
    clearToken()
    throw new ApiError('Session expired. Please sign in again.', res.status)
  }
  if (res.status === 403) {
    throw new ApiError('Only the archive publisher can upload PDFs.', res.status)
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; message?: string }
    return data.error ?? data.message ?? fallback
  } catch {
    return fallback
  }
}

async function uploadNewspaperPdf(date: string, file: File): Promise<ArchiveIssue> {
  const iso = String(date || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new ApiError('Pick a valid date (YYYY-MM-DD).')
  }
  if (!file || file.size < 8) {
    throw new ApiError('Choose a newspaper PDF to upload.')
  }

  const signRes = await fetch(`${API_URL}/api/publisher/pdf/sign`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ date: iso }),
  })
  throwIfPublisherDenied(signRes)

  if (signRes.ok) {
    const signed = (await signRes.json()) as {
      uploadUrl?: string
      headers?: Record<string, string>
      filename?: string
      url?: string
    }
    if (!signed.uploadUrl) {
      throw new ApiError('Upload URL was not returned.')
    }
    const putRes = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers: signed.headers || { 'Content-Type': 'application/pdf' },
      body: file,
    })
    if (!putRes.ok) {
      throw new ApiError(
        `GCS upload failed (${putRes.status}). Check bucket CORS and permissions.`,
        putRes.status,
      )
    }
    const doneRes = await fetch(`${API_URL}/api/publisher/pdf/complete`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ date: iso }),
    })
    throwIfPublisherDenied(doneRes)
    if (!doneRes.ok) {
      throw new ApiError(
        await readError(doneRes, `Upload could not be confirmed (${doneRes.status})`),
        doneRes.status,
      )
    }
    const done = (await doneRes.json()) as Record<string, unknown>
    return {
      date: iso,
      filename: String(done.filename || signed.filename || file.name),
      totalPages: null,
      url: String(done.url || `/api/manual?date=${iso}`),
    }
  }

  const form = new FormData()
  form.set('date', iso)
  form.set('pdf', file)
  const res = await fetch(`${API_URL}/api/publisher/pdf`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  throwIfPublisherDenied(res)
  if (!res.ok) {
    throw new ApiError(await readError(res, `Upload failed (${res.status})`), res.status)
  }
  const data = (await res.json()) as Record<string, unknown>
  return {
    date: iso,
    filename: String(data.filename || file.name),
    totalPages: null,
    url: String(data.url || `/api/manual?date=${iso}`),
  }
}

export default function AdminDesk({ onUploaded }: AdminDeskProps) {
  const [date, setDate] = useState(todayISO)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadOk, setUploadOk] = useState<string | null>(null)

  async function handleUpload(event: FormEvent) {
    event.preventDefault()
    if (!file) {
      setUploadError('Choose a newspaper PDF.')
      return
    }
    setUploading(true)
    setUploadError(null)
    setUploadOk(null)
    try {
      const issue = await uploadNewspaperPdf(date, file)
      setUploadOk(`Published ${issue.filename}`)
      setFile(null)
      onUploaded?.(issue)
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="discover-page admin-page" aria-label="Admin desk">
      <p className="archive-past-kicker">Admin</p>
      <h2 className="archive-month-title">Newspaper ingest</h2>
      <form className="archive-upload" onSubmit={(e) => void handleUpload(e)}>
        <p className="archive-upload-copy">
          Upload a Hindu PDF for any date. Stored as The-Hindu-DD-MM-YYYY.pdf in
          the public GCS bucket.
        </p>
        <div className="archive-upload-row">
          <label className="archive-upload-field">
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              disabled={uploading}
            />
          </label>
          <label className="archive-upload-field archive-upload-file">
            <span>PDF</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={uploading}
            />
          </label>
          <button type="submit" className="archive-upload-submit" disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        {file ? (
          <p className="archive-upload-hint">
            {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
          </p>
        ) : null}
        {uploadError ? (
          <p className="archive-upload-error" role="alert">
            {uploadError}
          </p>
        ) : null}
        {uploadOk ? <p className="archive-upload-ok">{uploadOk}</p> : null}
      </form>
    </section>
  )
}
