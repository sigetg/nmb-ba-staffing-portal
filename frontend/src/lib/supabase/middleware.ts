import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/', '/auth/login', '/auth/register', '/auth/setup', '/admin/login', '/health']

// Routes that require admin role
const adminRoutes = ['/admin']

// Routes that require BA role
const baRoutes = ['/dashboard']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

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

  const pathname = request.nextUrl.pathname

  // Check if route is public
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

  // Allow public routes without authentication
  if (isPublicRoute) {
    // If user is logged in and trying to access auth pages, redirect to appropriate dashboard
    // But allow /auth/setup so new signups can complete their profile
    if (user && pathname !== '/auth/setup' && (pathname.startsWith('/auth/') || pathname === '/admin/login' || pathname === '/')) {
      // Only query role when we need to redirect authenticated users away from login pages
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      const redirectUrl = userData?.role === 'admin' ? '/admin/dashboard' : '/dashboard'
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }
    return supabaseResponse
  }

  // For protected routes, check authentication
  if (!user || error) {
    // Redirect unauthenticated users to the unified home page login
    const redirectUrl = new URL('/', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Role-based authorization is handled by layouts (which use React.cache'd helpers).
  // Middleware only needs to ensure the user is authenticated for protected routes.

  return supabaseResponse
}
