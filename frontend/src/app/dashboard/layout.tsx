import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout'
import { getBAUserWithProfile, getUserWithRole } from '@/lib/supabase/auth-helpers'
import { createClient } from '@/lib/supabase/server'
import { SessionReset } from '@/components/auth/session-reset'

export default async function BADashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const impersonateId = cookieStore.get('impersonate_ba_id')?.value

  // Impersonation path: admin viewing as a BA
  if (impersonateId) {
    const authResult = await getUserWithRole()
    if (!authResult || authResult.role !== 'admin') {
      // Not admin — clear cookie and redirect
      cookieStore.delete('impersonate_ba_id')
      redirect('/')
    }

    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('ba_profiles')
      .select('*')
      .eq('id', impersonateId)
      .single()

    if (!profile) {
      cookieStore.delete('impersonate_ba_id')
      redirect('/admin/dashboard')
    }

    const onboardingComplete = !!(
      profile.w9_submitted_at && profile.dl_uploaded_at && profile.payout_info_submitted_at
    )

    return (
      <DashboardLayout
        user={{
          name: profile.name || undefined,
          email: authResult.user.email,
          role: 'ba',
          baStatus: profile.status as 'pending' | 'approved' | 'rejected' | 'suspended',
          onboardingComplete,
        }}
        impersonation={{ baName: profile.name, baId: profile.id }}
      >
        {children}
      </DashboardLayout>
    )
  }

  // Normal path
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

  const onboardingComplete = !!(
    profile.w9_submitted_at && profile.dl_uploaded_at && profile.payout_info_submitted_at
  )

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
      {children}
    </DashboardLayout>
  )
}
