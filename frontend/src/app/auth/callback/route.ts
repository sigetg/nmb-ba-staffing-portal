import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

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
