// =============================================================================
// Skeleton — Loading placeholder with animated shimmer effect
// =============================================================================

import React from 'react'

interface SkeletonProps {
  lines?: number
  type?: 'text' | 'card' | 'table'
  className?: string
}

function ShimmerBar({ className = '' }: { className?: string }) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-md bg-slate-800/60
        ${className}
      `}
    >
      <div
        className="
          absolute inset-0
          bg-gradient-to-r from-transparent via-slate-700/30 to-transparent
          animate-[shimmer_1.5s_infinite]
        "
        style={{
          animation: 'shimmer 1.5s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

function TextSkeleton({ lines = 3, className = '' }: { lines: number; className: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerBar
          key={i}
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  )
}

function CardSkeleton({ className = '' }: { className: string }) {
  return (
    <div
      className={`
        bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5
        space-y-4
        ${className}
      `}
    >
      {/* Header area */}
      <div className="flex items-center gap-3">
        <ShimmerBar className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <ShimmerBar className="h-4 w-2/5" />
          <ShimmerBar className="h-3 w-1/4" />
        </div>
      </div>
      {/* Content area */}
      <div className="space-y-2.5">
        <ShimmerBar className="h-3 w-full" />
        <ShimmerBar className="h-3 w-5/6" />
        <ShimmerBar className="h-3 w-4/6" />
      </div>
    </div>
  )
}

function TableSkeleton({ lines = 5, className = '' }: { lines: number; className: string }) {
  return (
    <div
      className={`
        rounded-xl border border-white/[0.06] overflow-hidden
        ${className}
      `}
    >
      {/* Table header */}
      <div className="flex gap-4 px-4 py-3 bg-white/[0.04] border-b border-white/[0.06]">
        <ShimmerBar className="h-3 w-24" />
        <ShimmerBar className="h-3 w-32" />
        <ShimmerBar className="h-3 w-20" />
        <ShimmerBar className="h-3 w-16" />
      </div>
      {/* Table rows */}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`
            flex gap-4 px-4 py-3
            border-b border-white/[0.03] last:border-b-0
            ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}
          `}
        >
          <ShimmerBar className="h-4 w-24" />
          <ShimmerBar className="h-4 w-32" />
          <ShimmerBar className="h-4 w-20" />
          <ShimmerBar className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

export function Skeleton({ lines = 3, type = 'text', className = '' }: SkeletonProps) {
  switch (type) {
    case 'card':
      return <CardSkeleton className={className} />
    case 'table':
      return <TableSkeleton lines={lines} className={className} />
    case 'text':
    default:
      return <TextSkeleton lines={lines} className={className} />
  }
}
