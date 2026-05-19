import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'

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
export async function GET(request: NextRequest) {
  // Behind Railway's edge proxy, `request.url` resolves to the internal
  // pod address (https://localhost:8080). Build the redirect against the
  // forwarded host so the browser actually follows it.
  const h = await headers()
  const forwardedProto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const origin = `${forwardedProto}://${host}`

  const response = NextResponse.redirect(new URL('/', origin))

  for (const c of request.cookies.getAll()) {
    if (c.name.startsWith('sb-') || c.name === '_auth_t' || c.name === 'impersonate_ba_id') {
      response.cookies.set(c.name, '', { path: '/', maxAge: 0 })
    }
  }

  response.headers.set('cache-control', 'private, no-store')
  return response
}
