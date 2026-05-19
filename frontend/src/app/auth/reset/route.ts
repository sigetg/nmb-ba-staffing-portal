import { NextResponse, type NextRequest } from 'next/server'

/**
 * Wipes every Supabase session cookie (and the impersonation cookie, plus
 * the legacy `_auth_t` counter from PR #23) and redirects to `/`.
 *
 * The frontend client component <SessionReset /> navigates here when a
 * server layout can't load the user. Server-issued `Set-Cookie: name=;
 * Max-Age=0` reliably evicts cookies regardless of their `Secure` or
 * `SameSite` attributes — which is exactly the bug we hit trying to clear
 * them via `document.cookie` from JS.
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.url))

  for (const c of request.cookies.getAll()) {
    if (c.name.startsWith('sb-') || c.name === '_auth_t' || c.name === 'impersonate_ba_id') {
      response.cookies.set(c.name, '', { path: '/', maxAge: 0 })
    }
  }

  response.headers.set('cache-control', 'private, no-store')
  return response
}
