'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ReactNode, useTransition, useState } from 'react'
import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  User,
  Users,
  CheckCircle2,
  CreditCard,
  Settings,
  LogOut,
  MapPin,
  Clock,
  BarChart3,
  Loader2,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: ReactNode
}

interface SidebarProps {
  items: NavItem[]
  header?: ReactNode
  footer?: ReactNode
}

export function Sidebar({ items, header, footer }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault()
    setPendingHref(href)
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <aside className="flex flex-col w-64 h-full bg-white border-r border-gray-200">
      {header && (
        <div className="p-4 border-b border-gray-200">
          {header}
        </div>
      )}

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/')
          const isLoading = isPending && pendingHref === item.href

          return (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              className={`
                flex items-center gap-3 px-3 py-2
                text-sm font-medium
                transition-colors duration-150
                ${
                  isActive
                    ? 'border-l-[3px] border-primary-400 bg-primary-50 text-primary-400 font-semibold'
                    : 'border-l-[3px] border-transparent text-gray-700 hover:bg-gray-50 hover:text-primary-400'
                }
                ${isLoading ? 'opacity-70' : ''}
              `}
            >
              <span className="w-5 h-5 flex-shrink-0">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : item.icon}
              </span>
              {item.label}
            </a>
          )
        })}
      </nav>

      {footer && (
        <div className="p-4 border-t border-gray-200">
          {footer}
        </div>
      )}
    </aside>
  )
}

export const Icons = {
  Dashboard: () => <LayoutDashboard className="w-5 h-5" />,
  Jobs: () => <Briefcase className="w-5 h-5" />,
  Calendar: () => <Calendar className="w-5 h-5" />,
  User: () => <User className="w-5 h-5" />,
  Users: () => <Users className="w-5 h-5" />,
  CheckCircle: () => <CheckCircle2 className="w-5 h-5" />,
  CreditCard: () => <CreditCard className="w-5 h-5" />,
  Settings: () => <Settings className="w-5 h-5" />,
  Logout: () => <LogOut className="w-5 h-5" />,
  Location: () => <MapPin className="w-5 h-5" />,
  Clock: () => <Clock className="w-5 h-5" />,
  Chart: () => <BarChart3 className="w-5 h-5" />,
}
