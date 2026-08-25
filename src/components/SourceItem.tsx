import { useState } from 'react'
import { getManualPdfUrl } from '../api'
import type { Source } from '../types'

type SourceItemProps = {
  source: Source
  index: number
  compact?: boolean
}

function sourceDate(source: Source): string | null {
  const raw = source.date || source.metadata?.date
  const iso = String(raw || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null
}

function formatIssueDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day))
  return dt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function SourceItem({ source, index, compact = false }: SourceItemProps) {
  const [open, setOpen] = useState(false)
  const date = sourceDate(source)
  const pageLabel = date
    ? `${formatIssueDate(date)} · p.${source.pageNumber}`
    : `p.${source.pageNumber}`
  const pdfUrl = getManualPdfUrl(source.pageNumber, date)
  const heading = source.heading || 'Untitled article'

  if (compact) {
    return (
      <li
        className="source-item source-item-compact animate-stagger"
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <a
          className="source-compact-link"
          href={pdfUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          <span className="source-compact-bullet" aria-hidden>
            •
          </span>
          <span className="source-compact-heading">{heading}</span>
          <span className="source-compact-page">{pageLabel}</span>
        </a>
      </li>
    )
  }

  const chunkLabel = `Chunk ${source.chunkIndex}/${source.chunkTotal}`
  const fullPageLabel = [
    date ? formatIssueDate(date) : null,
    `Page ${source.pageNumber}`,
    source.section || null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li
      className="source-item animate-stagger"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <h3 className="source-heading">{heading}</h3>
        <p className="source-meta">
          {chunkLabel} · {fullPageLabel} · {open ? 'Hide' : 'Read full'}
        </p>
        {!open && source.excerpt && (
          <p className="source-excerpt line-clamp-4">{source.excerpt}</p>
        )}
      </button>
      <a
        className="source-pdf-link"
        href={pdfUrl}
        target="_blank"
        rel="noreferrer noopener"
        onClick={(e) => e.stopPropagation()}
      >
        Open {date ? `${formatIssueDate(date)} · ` : ''}page {source.pageNumber} in
        paper »
      </a>
      {open && (
        <div className="source-full animate-fade-up">
          {source.pageContent || source.excerpt || 'No full text available.'}
        </div>
      )}
    </li>
  )
}
