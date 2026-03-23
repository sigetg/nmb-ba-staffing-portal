'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Menu, LogOut } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'

interface HeaderProps {
  user?: {
    name?: string
    email?: string
    avatar?: string
  }
  onLogout?: () => void
  showMobileMenuButton?: boolean
  onMobileMenuClick?: () => void
}

export function Header({
  user,
  onLogout,
  showMobileMenuButton = false,
  onMobileMenuClick,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        <div className="flex items-center gap-4">
          {showMobileMenuButton && (
            <button
              type="button"
              onClick={onMobileMenuClick}
              className="lg:hidden p-2 rounded-lg text-primary-400 hover:bg-gray-100"
            >
              <Menu className="w-6 h-6" />
            </button>
          )}

          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <Image
              src="/logo.jpg"
              alt="NMB Media"
              width={120}
              height={48}
              className="h-10 w-auto object-contain"
              priority
            />
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user.name || user.email}
                </p>
                {user.name && (
                  <p className="text-xs text-primary-400">
                    {user.email}
                  </p>
                )}
              </div>
              <Avatar
                src={user.avatar}
                name={user.name || user.email}
                size="md"
              />
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="hidden sm:flex p-2 rounded-lg text-primary-400 hover:bg-gray-100"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="px-4 py-2 text-sm font-medium text-white bg-primary-400 rounded-lg hover:bg-primary-500"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
