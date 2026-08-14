import { useState } from 'react'
import { getManualPdfUrl } from '../api'
import type { Source } from '../types'

type SourceItemProps = {
  source: Source
  index: number
  compact?: boolean
}

export function SourceItem({ source, index, compact = false }: SourceItemProps) {
  const [open, setOpen] = useState(false)
  const pageLabel = `p.${source.pageNumber}`
  const pdfUrl = getManualPdfUrl(source.pageNumber)
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
          <span className="source-compact-heading">{heading}</span>
          <span className="source-compact-page">{pageLabel}</span>
        </a>
      </li>
    )
  }

  const chunkLabel = `Chunk ${source.chunkIndex}/${source.chunkTotal}`
  const fullPageLabel = source.section
    ? `Page ${source.pageNumber} · ${source.section}`
    : `Page ${source.pageNumber}`

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
        Open page {source.pageNumber} in paper »
      </a>
      {open && (
        <div className="source-full animate-fade-up">
          {source.pageContent || source.excerpt || 'No full text available.'}
        </div>
      )}
    </li>
  )
}
