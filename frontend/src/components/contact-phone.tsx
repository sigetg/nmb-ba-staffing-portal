'use client'

import { Phone } from 'lucide-react'
import { useContactPhone } from '@/hooks/useContactPhone'
import { formatPhoneNumber, telHref } from '@/lib/utils'

/**
 * Prominent banner for the active-job page. Renders nothing when no number is set.
 */
export function ContactPhoneBanner() {
  const phone = useContactPhone()
  if (!phone) return null

  return (
    <a
      href={telHref(phone)}
      className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary-50 border border-primary-200 px-4 py-3 text-primary-600 font-medium hover:bg-primary-100 transition-colors"
    >
      <Phone className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm sm:text-base">
        Need help? Call <span className="font-semibold">{formatPhoneNumber(phone)}</span>
      </span>
    </a>
  )
}

type Variant = 'inline' | 'footer'

/**
 * Single-line "Need help? Call …" used outside the active-job page.
 * Fetches the number client-side via the supabase hook.
 */
export function ContactHelpLine({ variant = 'inline' }: { variant?: Variant }) {
  const phone = useContactPhone()
  return <ContactHelpLineStatic phone={phone} variant={variant} />
}

/**
 * Same UI as ContactHelpLine but receives the phone as a prop. Use this on
 * server-rendered pages that fetch via lib/contact-phone.ts so we don't fire
 * a redundant client-side request.
 */
export function ContactHelpLineStatic({
  phone,
  variant = 'inline',
}: {
  phone: string | null | undefined
  variant?: Variant
}) {
  if (!phone) return null

  if (variant === 'footer') {
    return (
      <a
        href={telHref(phone)}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
      >
        <Phone className="w-3 h-3" />
        Need help? Call {formatPhoneNumber(phone)}
      </a>
    )
  }

  return (
    <a
      href={telHref(phone)}
      className="inline-flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-600"
    >
      <Phone className="w-4 h-4" />
      Need help? Call {formatPhoneNumber(phone)}
    </a>
  )
}
