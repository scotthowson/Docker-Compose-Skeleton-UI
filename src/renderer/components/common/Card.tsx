// =============================================================================
// Card — Glassmorphic card wrapper with optional glow and hover effects
// =============================================================================

import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  glow?: 'emerald' | 'cyan' | 'rose' | 'amber' | 'none'
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg'
}

const glowClasses: Record<string, string> = {
  emerald: 'glow-emerald',
  cyan: 'glow-cyan',
  rose: 'glow-rose',
  amber: 'glow-amber',
  none: '',
}

const paddingClasses: Record<string, string> = {
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
}

export function Card({
  children,
  className = '',
  glow = 'none',
  hover = false,
  padding = 'md',
}: CardProps) {
  return (
    <div
      className={`
        bg-white/5 backdrop-blur-xl
        border border-white/10 rounded-xl
        ${paddingClasses[padding]}
        ${glowClasses[glow]}
        ${hover ? 'hover:bg-white/10 hover:border-white/[0.15] transition-all duration-200 cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
