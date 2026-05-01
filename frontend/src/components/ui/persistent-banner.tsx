import Link from 'next/link'
import { Alert } from './alert'

interface PersistentBannerProps {
  variant?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  message: string
  ctaLabel?: string
  ctaHref?: string
}

export function PersistentBanner({
  variant = 'warning',
  title,
  message,
  ctaLabel,
  ctaHref,
}: PersistentBannerProps) {
  return (
    <div className="mb-6">
      <Alert variant={variant} title={title}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p>{message}</p>
          {ctaLabel && ctaHref && (
            <Link
              href={ctaHref}
              className="inline-block px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors text-sm font-medium whitespace-nowrap"
            >
              {ctaLabel}
            </Link>
          )}
        </div>
      </Alert>
    </div>
  )
}
