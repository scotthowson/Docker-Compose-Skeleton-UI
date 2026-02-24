// =============================================================================
// Badge — Status badges with variant colors and optional pulsing dot
// =============================================================================

import React from 'react'

interface BadgeProps {
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  children: React.ReactNode
  dot?: boolean
  size?: 'sm' | 'md'
}

const variantStyles: Record<string, { bg: string; text: string; dot: string }> = {
  success: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  warning: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  error: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
  },
  info: {
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-400',
    dot: 'bg-cyan-400',
  },
  neutral: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-400',
    dot: 'bg-slate-400',
  },
}

const sizeStyles: Record<string, { badge: string; dotSize: string }> = {
  sm: {
    badge: 'text-[10px] px-1.5 py-0.5 gap-1',
    dotSize: 'h-1.5 w-1.5',
  },
  md: {
    badge: 'text-xs px-2 py-1 gap-1.5',
    dotSize: 'h-2 w-2',
  },
}

export function Badge({ variant, children, dot = false, size = 'md' }: BadgeProps) {
  const { bg, text, dot: dotColor } = variantStyles[variant]
  const { badge: badgeSize, dotSize } = sizeStyles[size]

  return (
    <span
      className={`
        inline-flex items-center
        rounded-full font-medium
        ${bg} ${text} ${badgeSize}
      `}
    >
      {dot && (
        <span className="relative flex">
          <span
            className={`absolute inset-0 rounded-full ${dotColor} opacity-50 animate-ping`}
          />
          <span className={`relative inline-flex rounded-full ${dotColor} ${dotSize}`} />
        </span>
      )}
      {children}
    </span>
  )
}
