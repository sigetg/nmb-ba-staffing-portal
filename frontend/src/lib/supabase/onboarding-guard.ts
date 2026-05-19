import { redirect } from 'next/navigation'
import { getEffectiveBAProfile } from './auth-helpers'

/**
 * Server-side guard for routes that require approved + onboarded BAs.
 * Redirects to:
 *   - /dashboard if not approved
 *   - /dashboard/welcome if approved but missing W-9, driver's license, or PayPal connection
 */
export async function requireOnboardedBA() {
  const result = await getEffectiveBAProfile()
  if (!result?.profile) {
    redirect('/dashboard')
  }
  const { profile } = result

  if (profile.status !== 'approved') {
    redirect('/dashboard')
  }

  if (!isOnboardingComplete(profile)) {
    redirect('/dashboard/welcome')
  }

  return result
}

export function isOnboardingComplete(profile: {
  w9_submitted_at?: string | null
  dl_uploaded_at?: string | null
  payout_info_submitted_at?: string | null
} | null | undefined): boolean {
  return !!(
    profile?.w9_submitted_at &&
    profile?.dl_uploaded_at &&
    profile?.payout_info_submitted_at
  )
}
