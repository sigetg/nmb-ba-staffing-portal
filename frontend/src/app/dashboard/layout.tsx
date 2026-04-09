import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout'
import { getBAUserWithProfile, getUserWithRole } from '@/lib/supabase/auth-helpers'
import { createClient } from '@/lib/supabase/server'

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

    return (
      <DashboardLayout
        user={{
          name: profile.name || undefined,
          email: authResult.user.email,
          role: 'ba',
          baStatus: profile.status as 'pending' | 'approved' | 'rejected' | 'suspended',
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
