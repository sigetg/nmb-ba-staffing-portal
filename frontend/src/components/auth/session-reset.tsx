'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * Rendered by server layouts when auth state can't be loaded (null user
 * despite middleware letting the request through). Instead of redirecting —
 * which would loop against middleware that still sees auth cookies — we
 * render this and let the BROWSER clear every `sb-*` cookie and navigate
 * to `/`. The next request has no auth, so middleware renders the login
 * page and the loop is broken.
 */
export function SessionReset() {
  useEffect(() => {
    const host = window.location.hostname
    // Match the path/domain attributes supabase-js used when setting cookies.
    // Try a few variants so we hit them regardless of how they were set.
    const expire = 'Thu, 01 Jan 1970 00:00:00 GMT'
    for (const c of document.cookie.split(';')) {
      const name = c.split('=')[0]?.trim()
      if (!name || !name.startsWith('sb-')) continue
      document.cookie = `${name}=; Path=/; Expires=${expire}; SameSite=Lax`
      document.cookie = `${name}=; Path=/; Domain=${host}; Expires=${expire}; SameSite=Lax`
      // Also try a leading-dot domain in case it was set that way.
      document.cookie = `${name}=; Path=/; Domain=.${host}; Expires=${expire}; SameSite=Lax`
    }
    window.location.replace('/')
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen p-8 text-center">
      <div>
        <p className="text-gray-600">Resetting your session…</p>
        <p className="mt-2 text-xs text-gray-400">
          If this page doesn’t move,{' '}
          <Link href="/" className="underline">click here</Link>.
        </p>
      </div>
    </div>
  )
}
