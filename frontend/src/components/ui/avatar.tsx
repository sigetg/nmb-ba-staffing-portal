'use client'

import { ImgHTMLAttributes, forwardRef } from 'react'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null
  name?: string
  size?: AvatarSize
}

const sizeStyles: Record<AvatarSize, { container: string; text: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-xs' },
  sm: { container: 'w-8 h-8', text: 'text-sm' },
  md: { container: 'w-10 h-10', text: 'text-base' },
  lg: { container: 'w-12 h-12', text: 'text-lg' },
  xl: { container: 'w-16 h-16', text: 'text-xl' },
}

function getInitials(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function getColorFromName(name?: string): string {
  if (!name) return 'bg-gray-400'
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
  ]
  const index = name.charCodeAt(0) % colors.length
  return colors[index]
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, name, size = 'md', className = '', alt, ...props }, ref) => {
    const styles = sizeStyles[size]

    if (src) {
      return (
        <div
          ref={ref}
          className={`relative inline-block rounded-full overflow-hidden ${styles.container} ${className}`}
        >
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            className="w-full h-full object-cover"
            {...props}
          />
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={`
          inline-flex items-center justify-center
          rounded-full
          ${getColorFromName(name)}
          text-white font-medium
          ${styles.container}
          ${styles.text}
          ${className}
        `}
      >
        {getInitials(name)}
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'
