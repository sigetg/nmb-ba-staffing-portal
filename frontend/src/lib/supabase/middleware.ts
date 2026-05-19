import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/', '/auth/login', '/auth/register', '/auth/setup', '/auth/callback', '/auth/confirm', '/auth/forgot-password', '/auth/reset-password', '/auth/reset', '/admin/login', '/health', '/privacy', '/terms']

// Routes that require admin role (used for future role-based routing)
const _adminRoutes = ['/admin']

// Routes that require BA role (used for future role-based routing)
const _baRoutes = ['/dashboard']

/**
 * Build a redirect response with cache headers that prevent Railway's edge
 * (or any intermediary) from caching an authenticated-user redirect and
 * serving it back to a different cookie state. Every redirect out of this
 * middleware must go through here.
 */
function buildRedirect(request: NextRequest, to: string) {
  const res = NextResponse.redirect(new URL(to, request.url))
  res.headers.set('cache-control', 'private, no-store')
  res.headers.set('vary', 'cookie')
  return res
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // /auth/reset is the server route that wipes Supabase session cookies.
  // It must not be re-auth-gated or its Set-Cookie clearing response would
  // be swallowed by a middleware redirect, leaving the user looped.
  if (pathname === '/auth/reset') {
    return NextResponse.next({ request })
  }

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
  }

  // For routing purposes, treat transient-refresh users as logged in.
  const isAuthenticated = !!user || isTransientRefresh

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
      return buildRedirect(request, redirectUrl)
    }
    return supabaseResponse
  }

  // For protected routes, check authentication
  if (!isAuthenticated) {
    // Redirect unauthenticated users to the unified home page login
    const redirectUrl = new URL('/', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    const res = NextResponse.redirect(redirectUrl)
    res.headers.set('cache-control', 'private, no-store')
    res.headers.set('vary', 'cookie')
    return res
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
      const res = buildRedirect(request, '/')
      res.cookies.set('impersonate_ba_id', '', { path: '/', maxAge: 0 })
      return res
    }
  }

  return supabaseResponse
}
