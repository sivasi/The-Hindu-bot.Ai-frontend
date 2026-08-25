export const PUBLISHER_EMAIL = 'adityasivasi@gmail.com'
export const ADMIN_PATH = '/admin'

function cleanPath(pathname = window.location.pathname): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed || '/'
}

export function isPublisherEmail(email?: string | null): boolean {
  return String(email || '').trim().toLowerCase() === PUBLISHER_EMAIL
}

export function isAdminLocation(
  pathname = window.location.pathname,
  hash = window.location.hash,
): boolean {
  if (cleanPath(pathname) === ADMIN_PATH) return true
  return hash === '#/admin' || hash === '#admin'
}

export function enterAdminPath(replace = false): void {
  const already = cleanPath() === ADMIN_PATH && !window.location.hash
  if (already) return
  if (replace) window.history.replaceState(null, '', ADMIN_PATH)
  else window.history.pushState(null, '', ADMIN_PATH)
}

export function leaveAdminPath(): void {
  if (!isAdminLocation()) return
  window.history.replaceState(null, '', '/')
}
