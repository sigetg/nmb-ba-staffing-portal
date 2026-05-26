import { redirect } from 'next/navigation'
import { getBAUserWithProfile } from './auth-helpers'

/**
 * Server-side guard for routes that require approved + onboarded BAs.
 * Redirects to:
 *   - /dashboard if not approved
 *   - /dashboard/welcome if approved but missing W-9 or driver's license
 *
 * PayPal is no longer part of the onboarding gate — BAs can browse and apply
 * for jobs without it, but won't get paid until they connect it. The
 * dashboard layout shows a persistent banner when `payout_info_submitted_at`
 * is null.
 */
export async function requireOnboardedBA() {
  const result = await getBAUserWithProfile()
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
} | null | undefined): boolean {
  return !!(profile?.w9_submitted_at && profile?.dl_uploaded_at)
}
