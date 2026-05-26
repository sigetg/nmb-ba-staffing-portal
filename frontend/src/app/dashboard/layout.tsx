import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout'
import { PersistentBanner } from '@/components/ui'
import { getBAUserWithProfile } from '@/lib/supabase/auth-helpers'
import { isOnboardingComplete } from '@/lib/supabase/onboarding-guard'
import { SessionReset } from '@/components/auth/session-reset'

export default async function BADashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const result = await getBAUserWithProfile()

  if (!result) {
    // Don't redirect — middleware would bounce us right back if it still
    // sees auth cookies, producing a loop. Render a client-side resetter
    // that clears `sb-*` cookies in the browser and then navigates to `/`.
    return <SessionReset />
  }

  const { user, role, profile } = result

  // Redirect admins to admin dashboard
  if (role === 'admin') {
    redirect('/admin/dashboard')
  }

  // If no profile, redirect to setup
  if (!profile) {
    redirect('/auth/setup')
  }

  const onboardingComplete = isOnboardingComplete(profile)
  const needsPayoutSetup =
    profile.status === 'approved' && onboardingComplete && !profile.payout_info_submitted_at

  return (
    <DashboardLayout
      user={{
        name: profile?.name || undefined,
        email: user.email,
        role: 'ba',
        baStatus: profile.status as 'pending' | 'approved' | 'rejected' | 'suspended',
        onboardingComplete,
      }}
    >
      {needsPayoutSetup && (
        <PersistentBanner
          variant="warning"
          title="Connect PayPal to get paid"
          message="You can browse and work jobs now, but we can't pay you until you connect PayPal."
          ctaLabel="Connect PayPal"
          ctaHref="/dashboard/profile#payout"
        />
      )}
      {children}
    </DashboardLayout>
  )
}
