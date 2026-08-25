import { useMemo, useState } from 'react'
import { getManualPdfUrl } from '../api'
import {
  currentYearMonth,
  formatIssueDay,
  formatIssueWeekday,
  groupIssuesByMonth,
} from '../archive'
import type { ArchiveIssue } from '../types'

type ArchiveFeedProps = {
  issues: ArchiveIssue[]
  loading?: boolean
  error?: string | null
  activeDate?: string | null
  onOpenIssue: (date: string) => void
}

function DateGrid({
  issues,
  activeDate,
  onOpenIssue,
}: {
  issues: ArchiveIssue[]
  activeDate?: string | null
  onOpenIssue: (date: string) => void
}) {
  return (
    <ul className="archive-date-grid">
      {issues.map((issue) => {
        const active = issue.date === activeDate
        return (
          <li key={issue.date}>
            <a
              className={`archive-date-link${active ? ' archive-date-link-active' : ''}`}
              href={issue.url || getManualPdfUrl(undefined, issue.date)}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => onOpenIssue(issue.date)}
            >
              <span className="archive-date-day">{formatIssueDay(issue.date)}</span>
              <span className="archive-date-meta">{formatIssueWeekday(issue.date)}</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

export function ArchiveFeed({
  issues,
  loading,
  error,
  activeDate,
  onOpenIssue,
}: ArchiveFeedProps) {
  const months = useMemo(() => groupIssuesByMonth(issues), [issues])
  const thisMonthKey = useMemo(() => {
    const now = currentYearMonth()
    if (months.some((month) => month.key === now)) return now
    return months[0]?.key ?? null
  }, [months])
  const [openMonth, setOpenMonth] = useState<string | null>(null)

  if (loading) {
    return (
      <section className="discover-page archive-page" aria-label="Archive">
        <p className="discover-status">Loading archive…</p>
        <div className="loading-bar" aria-hidden />
      </section>
    )
  }

  if (error) {
    return (
      <section className="discover-page archive-page" aria-label="Archive">
        <div role="alert" className="banner-warn animate-fade-up">
          {error}
        </div>
      </section>
    )
  }

  if (!issues.length) {
    return (
      <section className="discover-page archive-page" aria-label="Archive">
        <p className="discover-status">No newspaper issues are available yet.</p>
      </section>
    )
  }

  const thisMonth = months.find((month) => month.key === thisMonthKey) ?? null
  const previousMonths = months.filter((month) => month.key !== thisMonthKey)

  return (
    <section className="discover-page archive-page" aria-label="Newspaper archive">
      {thisMonth ? (
        <div className="archive-month">
          <h2 className="archive-month-title">{thisMonth.label}</h2>
          <DateGrid
            issues={thisMonth.issues}
            activeDate={activeDate}
            onOpenIssue={onOpenIssue}
          />
        </div>
      ) : null}

      {previousMonths.length ? (
        <div className="archive-past">
          <p className="archive-past-kicker">Earlier editions</p>
          <ul className="archive-month-list">
            {previousMonths.map((month) => {
              const expanded = openMonth === month.key
              return (
                <li key={month.key} className="archive-month-block">
                  <button
                    type="button"
                    className={`archive-month-toggle${expanded ? ' is-open' : ''}`}
                    aria-expanded={expanded}
                    onClick={() =>
                      setOpenMonth((current) =>
                        current === month.key ? null : month.key,
                      )
                    }
                  >
                    <span>{month.label}</span>
                    <span className="archive-month-count">
                      {month.issues.length} issues
                    </span>
                  </button>
                  {expanded ? (
                    <DateGrid
                      issues={month.issues}
                      activeDate={activeDate}
                      onOpenIssue={onOpenIssue}
                    />
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
