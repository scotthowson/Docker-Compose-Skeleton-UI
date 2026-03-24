// =============================================================================
// Button — Themed button with variants, sizes, loading state, and icon support
// =============================================================================

import React from 'react'
import { Spinner } from './Spinner'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

const variantClasses: Record<string, string> = {
  primary: `
    bg-emerald-500/20 text-emerald-400 border border-emerald-500/30
    hover:bg-emerald-500/30 hover:border-emerald-500/50
    active:bg-emerald-500/40
    shadow-[0_0_12px_rgba(52,211,153,0.1)]
    hover:shadow-[0_0_20px_rgba(52,211,153,0.2)]
  `,
  secondary: `
    bg-white/5 text-slate-300 border border-white/10
    hover:bg-white/10 hover:border-white/[0.15] hover:text-slate-100
    active:bg-white/[0.12]
  `,
  danger: `
    bg-rose-500/15 text-rose-400 border border-rose-500/25
    hover:bg-rose-500/25 hover:border-rose-500/40
    active:bg-rose-500/35
  `,
  ghost: `
    bg-transparent text-slate-400 border border-transparent
    hover:bg-white/5 hover:text-slate-200
    active:bg-white/[0.10]
  `,
}

const sizeClasses: Record<string, string> = {
  sm: 'text-xs px-2.5 py-1.5 gap-1.5 rounded-lg',
  md: 'text-sm px-4 py-2 gap-2 rounded-lg',
  lg: 'text-sm px-5 py-2.5 gap-2 rounded-xl',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center
        font-medium
        backdrop-blur-sm
        transition-all duration-200 ease-in-out
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 'md' : 'sm'} />
      ) : icon ? (
        <span className="shrink-0 flex items-center">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
    </button>
  )
}
