import type { AppMode } from './components/ChatSidebar'

export const SITE_ORIGIN = 'https://the-hindu-bot.netlify.app'
export const SITE_NAME = 'The Hindu Bot.AI'
export const SITE_DESCRIPTION =
  'Ask questions against The Hindu newspaper archive. Answers are grounded in indexed pages and cite their sources.'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`
  let el = document.head.querySelector(selector) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.rel = 'canonical'
    document.head.appendChild(el)
  }
  el.href = href
}

export function applyDocumentSeo(mode: AppMode) {
  const admin = mode === 'admin'
  const title =
    admin
      ? `Admin · ${SITE_NAME}`
      : mode === 'archive'
        ? `Newspaper archive · ${SITE_NAME}`
        : `${SITE_NAME} — Ask the newspaper archive`

  document.title = title
  upsertMeta('name', 'description', SITE_DESCRIPTION)
  upsertMeta('name', 'robots', admin ? 'noindex, nofollow' : 'index, follow')
  upsertMeta('property', 'og:title', title)
  upsertMeta('property', 'og:description', SITE_DESCRIPTION)
  upsertMeta('property', 'og:url', admin ? `${SITE_ORIGIN}/admin` : `${SITE_ORIGIN}/`)
  upsertCanonical(admin ? `${SITE_ORIGIN}/admin` : `${SITE_ORIGIN}/`)
}
