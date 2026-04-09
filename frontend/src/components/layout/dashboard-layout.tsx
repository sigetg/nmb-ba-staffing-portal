'use client'

import { useState, ReactNode } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Sidebar, Icons } from './sidebar'
import { Header } from './header'
import { createClient } from '@/lib/supabase/client'
import type { BAStatus } from '@/types'

interface DashboardLayoutProps {
  children: ReactNode
  user: {
    name?: string
    email?: string
    avatar?: string
    role: 'ba' | 'admin'
    baStatus?: BAStatus
  }
  impersonation?: { baName: string; baId: string } | null
}

const allBaNavItems = [
  { label: 'Dashboard', href: '/dashboard', icon: <Icons.Dashboard /> },
  { label: 'Find Jobs', href: '/dashboard/jobs', icon: <Icons.Jobs /> },
  { label: 'My Jobs', href: '/dashboard/my-jobs', icon: <Icons.Calendar /> },
  { label: 'Profile', href: '/dashboard/profile', icon: <Icons.User /> },
]

const adminNavItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: <Icons.Dashboard /> },
  { label: 'Jobs', href: '/admin/jobs', icon: <Icons.Jobs /> },
  { label: 'Brand Ambassadors', href: '/admin/bas', icon: <Icons.Users /> },
]

export function DashboardLayout({ children, user, impersonation }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const baNavItems = user.baStatus === 'approved'
    ? allBaNavItems
    : allBaNavItems.filter(item => item.label === 'Dashboard' || item.label === 'Profile')

  const navItems = user.role === 'admin' ? adminNavItems : baNavItems

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const sidebarHeader = (
    <div className="flex items-center gap-3">
      <Image
        src="/logo.jpg"
        alt="NMB Media"
        width={140}
        height={56}
        className="h-12 w-auto object-contain"
      />
      <p className="text-sm font-medium text-primary-400">
        {user.role === 'admin' ? 'Admin Portal' : 'BA Portal'}
      </p>
    </div>
  )

  const sidebarFooter = (
    <button
      onClick={handleLogout}
      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-primary-400 hover:bg-gray-100 transition-colors"
    >
      <span className="w-5 h-5">
        <Icons.Logout />
      </span>
      Logout
    </button>
  )

  return (
    <div className="flex h-screen bg-[#F8F9FB]">
      <div className="hidden lg:block">
        <Sidebar
          items={navItems}
          header={sidebarHeader}
          footer={sidebarFooter}
        />
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64">
            <Sidebar
              items={navItems}
              header={sidebarHeader}
              footer={sidebarFooter}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          user={user}
          onLogout={handleLogout}
          showMobileMenuButton
          onMobileMenuClick={() => setMobileMenuOpen(true)}
          impersonation={impersonation}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
