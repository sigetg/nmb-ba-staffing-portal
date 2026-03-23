import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout'
import { getBAUserWithProfile } from '@/lib/supabase/auth-helpers'

export default async function BADashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const result = await getBAUserWithProfile()

  if (!result) {
    redirect('/auth/login')
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

  return (
    <DashboardLayout
      user={{
        name: profile?.name || undefined,
        email: user.email,
        role: 'ba',
        baStatus: profile.status as 'pending' | 'approved' | 'rejected' | 'suspended',
      }}
    >
      {children}
    </DashboardLayout>
  )
}
