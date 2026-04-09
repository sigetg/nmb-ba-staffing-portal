'use client'

import { useEffect, useCallback, HTMLAttributes, forwardRef } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

export function Modal({
  isOpen,
  onClose,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose()
      }
    },
    [onClose, closeOnEscape]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleEscape])

  if (!isOpen) return null

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        className={`
          relative z-10 w-full ${sizeStyles[size]}
          bg-white
          rounded-xl shadow-xl
          mx-4 max-h-[90vh] overflow-auto
        `}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  )

  if (typeof window === 'undefined') return null

  return createPortal(modalContent, document.body)
}

type ModalHeaderProps = HTMLAttributes<HTMLDivElement>

export const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`px-6 py-4 border-b border-gray-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
)

ModalHeader.displayName = 'ModalHeader'

type ModalTitleProps = HTMLAttributes<HTMLHeadingElement>

export const ModalTitle = forwardRef<HTMLHeadingElement, ModalTitleProps>(
  ({ className = '', children, ...props }, ref) => (
    <h2
      ref={ref}
      className={`text-lg font-semibold text-heading ${className}`}
      {...props}
    >
      {children}
    </h2>
  )
)

ModalTitle.displayName = 'ModalTitle'

type ModalContentProps = HTMLAttributes<HTMLDivElement>

export const ModalContent = forwardRef<HTMLDivElement, ModalContentProps>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`px-6 py-4 ${className}`} {...props}>
      {children}
    </div>
  )
)

ModalContent.displayName = 'ModalContent'

type ModalFooterProps = HTMLAttributes<HTMLDivElement>

export const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`px-6 py-4 border-t border-gray-200 flex justify-end gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
)

ModalFooter.displayName = 'ModalFooter'
