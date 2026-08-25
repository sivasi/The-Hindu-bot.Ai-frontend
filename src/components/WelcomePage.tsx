import type { ReactNode } from 'react'

type WelcomePageProps = {
  children?: ReactNode
}

const DESK = [
  {
    kicker: 'Chat',
    title: 'Ask the paper',
    blurb:
      'Answers come only from The Hindu of 1 January through 23 August 2026. Later updates will cover today and the past three years.',
  },
  {
    kicker: 'Sources',
    title: 'Every reply cites',
    blurb: 'Retrieved excerpts sit under the answer so you can check the clip and open the page.',
  },
  {
    kicker: 'Archive',
    title: 'Read the issue',
    blurb: 'Browse newspaper PDFs by date and jump from a citation to the printed page.',
  },
] as const

export function WelcomePage({ children }: WelcomePageProps) {
  return (
    <section className="welcome-page" aria-label="Welcome">
      <p className="auth-eyebrow">1 January – 23 August 2026</p>
      <h2 className="welcome-headline">The Hindu, as a desk you can ask</h2>
      <p className="about-lead welcome-lead">
        This website turns The Hindu archive into an interactive edition. Chat
        answers only from issues dated 1 January through 23 August 2026. Later
        updates will cover the present date and the past three years. Put a
        question where the lead headline sits — and the paper answers with
        citations from indexed article chunks.
      </p>

      <div className="welcome-feature-row" aria-label="What you can do">
        {DESK.map((item) => (
          <article key={item.title} className="feature-cell feature-tone-offwhite">
            <p className="feature-kicker">{item.kicker}</p>
            <h3 className="feature-title">{item.title}</h3>
            <p className="feature-blurb">{item.blurb}</p>
          </article>
        ))}
      </div>

      <div className="about-how">
        <h3 className="about-subhead">How the desk works</h3>
        <ol className="about-steps">
          <li>
            <span className="about-step-num">1</span>
            <div>
              <p className="about-step-title">Sign in</p>
              <p className="about-step-body">
                Open Chat with Google. Your threads appear in the Inside column.
              </p>
            </div>
          </li>
          <li>
            <span className="about-step-num">2</span>
            <div>
              <p className="about-step-title">Ask the lead</p>
              <p className="about-step-body">
                Type a question in the headline slot. A new chat is saved on your first Ask.
              </p>
            </div>
          </li>
          <li>
            <span className="about-step-num">3</span>
            <div>
              <p className="about-step-title">Read with citations</p>
              <p className="about-step-body">
                Follow the answer and sources — or open Archive to read the newspaper PDF.
              </p>
            </div>
          </li>
        </ol>
      </div>

      {children}
    </section>
  )
}
