'use client'

import { HTMLAttributes, forwardRef } from 'react'
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react'

export type AlertVariant = 'info' | 'success' | 'warning' | 'error'

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
  title?: string
  onClose?: () => void
}

const variantStyles: Record<AlertVariant, { bg: string; border: string; icon: string }> = {
  info: {
    bg: 'bg-primary-50',
    border: 'border-primary-200',
    icon: 'text-primary-400',
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-600',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: 'text-yellow-600',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-600',
  },
}

const icons: Record<AlertVariant, React.ReactNode> = {
  info: <Info className="w-5 h-5" />,
  success: <CheckCircle2 className="w-5 h-5" />,
  warning: <AlertTriangle className="w-5 h-5" />,
  error: <XCircle className="w-5 h-5" />,
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'info', title, onClose, className = '', children, ...props }, ref) => {
    const styles = variantStyles[variant]

    return (
      <div
        ref={ref}
        role="alert"
        className={`
          flex gap-3 p-4 rounded-lg border
          ${styles.bg} ${styles.border}
          ${className}
        `}
        {...props}
      >
        <div className={`flex-shrink-0 ${styles.icon}`}>{icons[variant]}</div>
        <div className="flex-1">
          {title && (
            <h4 className="font-medium text-gray-900 mb-1">
              {title}
            </h4>
          )}
          <div className="text-sm text-gray-700">{children}</div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-primary-400"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    )
  }
)

Alert.displayName = 'Alert'
