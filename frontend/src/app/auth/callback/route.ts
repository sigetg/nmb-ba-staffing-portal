import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  // Use forwarded host/proto headers to get the real origin behind reverse proxies (e.g. Railway)
  const headersList = await headers()
  const forwardedHost = headersList.get('x-forwarded-host')
  const forwardedProto = headersList.get('x-forwarded-proto') ?? 'https'
  const host = forwardedHost ?? headersList.get('host') ?? 'localhost:3000'
  const origin = `${forwardedProto}://${host}`

  if (!code) {
    return NextResponse.redirect(new URL('/?error=auth_error', origin))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/?error=auth_error', origin))
  }

  // Check if this is a password recovery flow
  if (data.session?.user?.recovery_sent_at) {
    return NextResponse.redirect(new URL('/auth/reset-password', origin))
  }

  // Email confirmation flow — check if user has completed profile setup
  const { data: userData } = await supabase
    .from('users')
    .select('first_name')
    .eq('id', data.session.user.id)
    .single()

  if (!userData?.first_name) {
    return NextResponse.redirect(new URL('/auth/setup', origin))
  }

  return NextResponse.redirect(new URL('/dashboard', origin))
}
