import type { AppMode } from './components/ChatSidebar'

export const SITE_ORIGIN = 'https://the-hindu-bot.netlify.app'
export const SITE_NAME = 'The Hindu Bot.AI'
export const SITE_DESCRIPTION =
  'Ask questions against The Hindu newspaper archive. Answers are grounded in indexed pages and cite their sources.'
export const ARCHIVE_PATH = '/archive'
export const CHAT_PATH = '/chat'

function cleanPath(pathname = window.location.pathname): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed || '/'
}

function isPath(path: string, pathname = window.location.pathname): boolean {
  return cleanPath(pathname) === path
}

function enterPath(path: string, replace = false): void {
  const already = cleanPath() === path && !window.location.hash
  if (already) return
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
}

function leavePath(path: string): void {
  if (!isPath(path)) return
  window.history.replaceState(null, '', '/')
}

export function isArchiveLocation(pathname = window.location.pathname): boolean {
  return isPath(ARCHIVE_PATH, pathname)
}

export function enterArchivePath(replace = false): void {
  enterPath(ARCHIVE_PATH, replace)
}

export function leaveArchivePath(): void {
  leavePath(ARCHIVE_PATH)
}

export function isChatLocation(pathname = window.location.pathname): boolean {
  return isPath(CHAT_PATH, pathname)
}

export function enterChatPath(replace = false): void {
  enterPath(CHAT_PATH, replace)
}

export function leaveChatPath(): void {
  leavePath(CHAT_PATH)
}

export function canonicalUrlForMode(mode: AppMode): string {
  if (mode === 'archive') return `${SITE_ORIGIN}${ARCHIVE_PATH}`
  if (mode === 'chat') return `${SITE_ORIGIN}${CHAT_PATH}`
  if (mode === 'admin') return `${SITE_ORIGIN}/admin`
  return `${SITE_ORIGIN}/`
}

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
        : mode === 'chat'
          ? `Ask the paper · ${SITE_NAME}`
          : `${SITE_NAME} — Ask the newspaper archive`

  document.title = title
  const url = canonicalUrlForMode(mode)
  upsertMeta('name', 'description', SITE_DESCRIPTION)
  upsertMeta('name', 'robots', admin ? 'noindex, nofollow' : 'index, follow')
  upsertMeta('property', 'og:title', title)
  upsertMeta('property', 'og:description', SITE_DESCRIPTION)
  upsertMeta('property', 'og:url', url)
  upsertCanonical(url)
}
