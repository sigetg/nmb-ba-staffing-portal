'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * Rendered by server layouts when auth state can't be loaded (null user
 * despite middleware letting the request through). Bounces the browser to
 * `/auth/reset`, which is a server route that clears every Supabase
 * session cookie and redirects to `/`. We can't reliably clear cookies
 * from JS (Chrome rejects `document.cookie` overwrites that don't match
 * the original `Secure` attribute), so we delegate to the server.
 */
export function SessionReset() {
  useEffect(() => {
    window.location.replace('/auth/reset')
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen p-8 text-center">
      <div>
        <p className="text-gray-600">Resetting your session…</p>
        <p className="mt-2 text-xs text-gray-400">
          If this page doesn’t move,{' '}
          <Link href="/auth/reset" className="underline">click here</Link>.
        </p>
      </div>
    </div>
  )
}
