import { cache } from 'react'
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
