'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const COOKIE_NAME = 'impersonate_ba_id'
const COOKIE_TTL_SECONDS = 4 * 60 * 60 // 4 hours

export async function startImpersonation(baProfileId: string) {
  const supabase = await createClient()

  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'admin') throw new Error('Unauthorized')

  // Verify BA profile exists
  const { data: profile } = await supabase
    .from('ba_profiles')
    .select('id')
    .eq('id', baProfileId)
    .single()

  if (!profile) throw new Error('BA profile not found')

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, baProfileId, {
    httpOnly: false, // Client-side pages need to read it
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_TTL_SECONDS,
    path: '/',
  })
}

export async function stopImpersonation() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
