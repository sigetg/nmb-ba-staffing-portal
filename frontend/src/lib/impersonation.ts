const COOKIE_NAME = 'impersonate_ba_id'

/**
 * Client-side: reads the impersonate_ba_id cookie from document.cookie.
 * Returns the BA profile UUID or null.
 */
export function getImpersonatedBAId(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`)
  )
  return match ? decodeURIComponent(match[1]) : null
}
