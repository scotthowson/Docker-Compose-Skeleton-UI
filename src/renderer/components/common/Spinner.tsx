// =============================================================================
// Spinner — Emerald colored spinning circle with size variants
// =============================================================================

import React from 'react'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses: Record<string, string> = {
  sm: 'h-4 w-4 border-[2px]',
  md: 'h-6 w-6 border-[2.5px]',
  lg: 'h-8 w-8 border-[3px]',
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={`
        inline-block
        rounded-full
        border-emerald-400/30
        border-t-emerald-400
        animate-spin
        ${sizeClasses[size]}
        ${className}
      `}
      role="status"
      aria-label="Loading"
    />
  )
}
