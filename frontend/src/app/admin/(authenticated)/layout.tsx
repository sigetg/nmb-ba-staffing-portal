import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout'
import { getUserWithRole } from '@/lib/supabase/auth-helpers'
import { SessionReset } from '@/components/auth/session-reset'

export default async function AdminAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const result = await getUserWithRole()

  if (!result) {
    // Don't redirect — see comment in /dashboard/layout.tsx.
    return <SessionReset />
  }

  const { user, role } = result

  // Redirect non-admins
  if (role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <DashboardLayout
      user={{
        email: user.email,
        role: 'admin',
      }}
    >
      {children}
    </DashboardLayout>
  )
}
