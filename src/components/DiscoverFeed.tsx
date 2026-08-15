import { getManualPdfUrl } from '../api'
import type { ExamArticle } from '../types'
import { MarkdownAnswer } from './MarkdownAnswer'

type DiscoverFeedProps = {
  section: string
  articles: ExamArticle[]
  loading?: boolean
  error?: string | null
}

export function DiscoverFeed({
  section,
  articles,
  loading,
  error,
}: DiscoverFeedProps) {
  if (loading) {
    return (
      <section className="discover-page" aria-label="Discover">
        <p className="discover-status">Loading {section}…</p>
        <div className="loading-bar" aria-hidden />
      </section>
    )
  }

  if (error) {
    return (
      <section className="discover-page" aria-label="Discover">
        <div role="alert" className="banner-warn animate-fade-up">
          {error}
        </div>
      </section>
    )
  }

  if (!articles.length) {
    return (
      <section className="discover-page" aria-label="Discover">
        <p className="discover-status">
          No curated articles in {section} yet.
        </p>
      </section>
    )
  }

  return (
    <section className="discover-page" aria-label={`${section} articles`}>
      <div className="discover-feed chat-thread" aria-label={section}>
        {articles.map((article, index) => (
          <DiscoverArticle
            key={article.id || `${article.title}-${index}`}
            article={article}
          />
        ))}
      </div>
    </section>
  )
}

function DiscoverArticle({ article }: { article: ExamArticle }) {
  const body =
    article.refinedBody?.trim() ||
    article.summary?.trim() ||
    ''
  const pdfUrl =
    typeof article.pageNumber === 'number' && article.pageNumber > 0
      ? getManualPdfUrl(article.pageNumber)
      : null

  return (
    <article className="chat-turn chat-turn-assistant discover-article">
      <p className="chat-turn-label">{article.section || 'Article'}</p>
      <h2 className="discover-headline">{article.title}</h2>
      {body ? (
        <div className="discover-para">
          <MarkdownAnswer content={body} />
        </div>
      ) : null}
      <div className="discover-article-meta">
        {typeof article.pageNumber === 'number' ? (
          pdfUrl ? (
            <a
              className="source-pdf-link"
              href={pdfUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open page {article.pageNumber} in paper »
            </a>
          ) : (
            <span className="discover-page-num">p.{article.pageNumber}</span>
          )
        ) : null}
      </div>
    </article>
  )
}
