import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from './server'

/**
 * Cached auth helpers using React.cache() to deduplicate
 * getUser() and role/profile queries within a single server request.
 */

export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getUserWithRole = cache(async () => {
  const user = await getAuthUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  return { user, role: data?.role as string | undefined }
})

export const getBAUserWithProfile = cache(async () => {
  const result = await getUserWithRole()
  if (!result) return null
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('ba_profiles')
    .select('*')
    .eq('user_id', result.user.id)
    .single()
  return { ...result, profile }
})

/**
 * Returns the effective BA profile, checking for admin impersonation first.
 * If an admin is impersonating a BA (cookie present + admin role), returns the
 * impersonated BA's profile. Otherwise falls back to the logged-in user's profile.
 */
export const getEffectiveBAProfile = cache(async () => {
  const cookieStore = await cookies()
  const impersonateId = cookieStore.get('impersonate_ba_id')?.value

  if (impersonateId) {
    const result = await getUserWithRole()
    if (result && result.role === 'admin') {
      const supabase = await createClient()
      const { data: profile } = await supabase
        .from('ba_profiles')
        .select('*')
        .eq('id', impersonateId)
        .single()
      if (profile) {
        return { ...result, profile, isImpersonating: true }
      }
    }
  }

  const result = await getBAUserWithProfile()
  if (!result) return null
  return { ...result, isImpersonating: false }
})
