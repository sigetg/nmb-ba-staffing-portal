import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/', '/auth/login', '/auth/register', '/auth/setup', '/auth/callback', '/auth/confirm', '/auth/forgot-password', '/auth/reset-password', '/admin/login', '/health', '/privacy', '/terms']

// Routes that require admin role (used for future role-based routing)
const _adminRoutes = ['/admin']

// Routes that require BA role (used for future role-based routing)
const _baRoutes = ['/dashboard']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Snapshot the request cookies BEFORE supabase mutates them so we can
  // recover from a transient refresh-token race (see below).
  const originalCookies = request.cookies.getAll().map(c => ({ name: c.name, value: c.value }))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired - important for Server Components
  const { data: { user }, error } = await supabase.auth.getUser()

  // Supabase's rotating refresh token gets consumed by whichever request
  // wins the race when the Next.js client fires parallel RSC prefetches.
  // The loser sees refresh_token_already_used; supabase-js then writes
  // cookie-clearing Set-Cookie headers and returns user=null. The session
  // is still valid in the browser via the winner's new cookies — so we
  // suppress the cookie clearing and treat the user as authenticated for
  // routing. The next request will succeed.
  const errorCode = (error as { code?: string } | null | undefined)?.code
  const isTransientRefresh = errorCode === 'refresh_token_already_used'

  // Track consecutive transient-refresh failures so we can recover users whose
  // refresh token is permanently revoked (e.g., consumed by a parallel request
  // that committed cookies first, leaving this browser with a forever-stale
  // token). Without this, the loop becomes: middleware treats user as
  // transient-authenticated → redirects to /dashboard → server-component
  // getUser also fails → layout redirects to / → repeat. After a few hits we
  // force-clear the supabase auth cookies so the user lands on the login page.
  const TRANSIENT_COUNT_COOKIE = '_auth_t'
  const TRANSIENT_LIMIT = 3
  const priorTransientCount = parseInt(
    request.cookies.get(TRANSIENT_COUNT_COOKIE)?.value || '0',
    10
  )

  if (isTransientRefresh && priorTransientCount >= TRANSIENT_LIMIT) {
    // Stuck: nuke the supabase auth cookies and bounce to the login page.
    const reset = NextResponse.redirect(new URL('/', request.url))
    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith('sb-')) {
        reset.cookies.set(c.name, '', { path: '/', maxAge: 0 })
      }
    }
    reset.cookies.set(TRANSIENT_COUNT_COOKIE, '', { path: '/', maxAge: 0 })
    return reset
  }

  if (isTransientRefresh) {
    // Restore the request cookies (setAll mutated them) and rebuild a
    // clean response without the cleared-cookie headers.
    for (const existing of request.cookies.getAll()) {
      if (!originalCookies.find(o => o.name === existing.name)) {
        request.cookies.delete(existing.name)
      }
    }
    for (const c of originalCookies) {
      request.cookies.set(c.name, c.value)
    }
    supabaseResponse = NextResponse.next({ request })
    // Increment the counter; short TTL so it self-clears once the user
    // navigates past the race condition.
    supabaseResponse.cookies.set(
      TRANSIENT_COUNT_COOKIE,
      String(priorTransientCount + 1),
      { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 120 }
    )
  } else if (priorTransientCount > 0) {
    // Auth state resolved (success or genuine logout) — reset the counter.
    supabaseResponse.cookies.set(TRANSIENT_COUNT_COOKIE, '', { path: '/', maxAge: 0 })
  }

  // For routing purposes, treat transient-refresh users as logged in.
  const isAuthenticated = !!user || isTransientRefresh

  const pathname = request.nextUrl.pathname

  // Check if route is public
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

  // Allow public routes without authentication
  if (isPublicRoute) {
    // If user is logged in and trying to access auth pages, redirect to appropriate dashboard
    // But allow /auth/setup so new signups can complete their profile
    if (isAuthenticated && pathname !== '/auth/setup' && pathname !== '/auth/reset-password' && pathname !== '/auth/confirm' && (pathname.startsWith('/auth/') || pathname === '/admin/login' || pathname === '/')) {
      // Only query role when we have a real user. During a transient
      // refresh race we don't know the role — default to /dashboard;
      // the BA dashboard layout will bounce admins to /admin/dashboard.
      let redirectUrl = '/dashboard'
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()
        redirectUrl = userData?.role === 'admin' ? '/admin/dashboard' : '/dashboard'
      }
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }
    return supabaseResponse
  }

  // For protected routes, check authentication
  if (!isAuthenticated) {
    // Redirect unauthenticated users to the unified home page login
    const redirectUrl = new URL('/', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If impersonation cookie is present on /dashboard routes, verify user is admin
  const impersonateCookie = request.cookies.get('impersonate_ba_id')?.value
  if (impersonateCookie && pathname.startsWith('/dashboard') && user) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'admin') {
      // Not admin — delete the cookie and redirect
      supabaseResponse.cookies.delete('impersonate_ba_id')
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}
