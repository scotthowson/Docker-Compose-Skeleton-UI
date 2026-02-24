// =============================================================================
// OverviewCards — Quick stats grid (4 columns) for the Dashboard
// =============================================================================

import React, { useEffect, useRef, useState } from 'react'
import { Layers, Box, HardDrive, HeartPulse } from 'lucide-react'
import { useSystemStore } from '../../stores/systemStore'
import { useHealthStore } from '../../stores/healthStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { useSettingsStore } from '../../stores/settingsStore'

// ---------------------------------------------------------------------------
// AnimatedCounter — Smoothly animates between numeric values using rAF
// ---------------------------------------------------------------------------

interface AnimatedCounterProps {
  value: number
  duration?: number
  className?: string
}

function AnimatedCounter({ value, duration = 800, className = '' }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const previousValue = useRef(value)
  const rafId = useRef<number | null>(null)
  const startTime = useRef<number | null>(null)

  useEffect(() => {
    const from = previousValue.current
    const to = value

    // Nothing to animate
    if (from === to) {
      setDisplayValue(to)
      return
    }

    // Cancel any in-flight animation
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current)
    }

    // Snapshot the current displayed value as the starting point when
    // interrupting mid-animation, so the counter picks up smoothly
    const animateFrom = displayValue !== to ? displayValue : from

    startTime.current = null

    // Cubic ease-out for natural deceleration
    const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3)

    const step = (timestamp: number) => {
      if (startTime.current === null) startTime.current = timestamp
      const elapsed = timestamp - startTime.current
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easeOut(progress)

      const current = animateFrom + (to - animateFrom) * easedProgress
      setDisplayValue(Math.round(current))

      if (progress < 1) {
        rafId.current = requestAnimationFrame(step)
      } else {
        // Ensure we land exactly on target
        setDisplayValue(to)
        previousValue.current = to
        rafId.current = null
      }
    }

    rafId.current = requestAnimationFrame(step)

    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
        // When cleanup fires due to value change, snapshot where we are
        previousValue.current = displayValue
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return (
    <span className={`tabular-nums ${className}`}>
      {displayValue}
    </span>
  )
}

// ---------------------------------------------------------------------------

interface CardProps {
  icon: React.ReactNode
  label: string
  value: string | number | React.ReactNode
  subtitle?: string
  accentColor: 'emerald' | 'cyan' | 'amber' | 'rose'
  trend?: 'up' | 'down' | 'stable'
  loading?: boolean
  index?: number
  onClick?: () => void
  pulse?: boolean
}

const accentBorderMap: Record<CardProps['accentColor'], string> = {
  emerald: 'border-t-emerald-500',
  cyan: 'border-t-cyan-500',
  amber: 'border-t-amber-500',
  rose: 'border-t-rose-500',
}

const accentBgMap: Record<CardProps['accentColor'], string> = {
  emerald: 'bg-emerald-500/10 text-emerald-400',
  cyan: 'bg-cyan-500/10 text-cyan-400',
  amber: 'bg-amber-500/10 text-amber-400',
  rose: 'bg-rose-500/10 text-rose-400',
}

const trendIcons: Record<NonNullable<CardProps['trend']>, { symbol: string; color: string }> = {
  up: { symbol: '\u2191', color: 'text-emerald-400' },
  down: { symbol: '\u2193', color: 'text-rose-400' },
  stable: { symbol: '\u2192', color: 'text-slate-400' },
}

function StatCard({ icon, label, value, subtitle, accentColor, trend, loading, index = 0, onClick, pulse }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-xl border-t-2 ${accentBorderMap[accentColor]}
        border bg-slate-900/60 backdrop-blur-md
        p-5 transition-all duration-300 hover:bg-slate-900/80 hover:border-white/10
        hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5
        animate-fade-in
        ${onClick ? 'cursor-pointer' : ''}
        ${pulse ? 'border-amber-500/30 animate-pulse' : 'border-white/5'}
      `}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {loading ? (
        <div className="animate-pulse">
          <div className="flex items-start justify-between">
            <div className="h-10 w-10 rounded-lg bg-slate-700/50" />
            <div className="h-4 w-4 rounded bg-slate-700/30" />
          </div>
          <div className="mt-4">
            <div className="h-3 w-20 rounded bg-slate-700/40" />
            <div className="mt-2 h-7 w-14 rounded bg-slate-700/50" />
            <div className="mt-1 h-2.5 w-28 rounded bg-slate-800/40" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div className={`rounded-lg p-2.5 ${accentBgMap[accentColor]}`}>
              {icon}
            </div>
            {trend && (
              <span className={`text-sm font-medium ${trendIcons[trend].color}`}>
                {trendIcons[trend].symbol}
              </span>
            )}
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-white tracking-tight tabular-nums">
              {typeof value === 'number' ? (
                <AnimatedCounter value={value} />
              ) : (
                value
              )}
            </p>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
        </>
      )}

      {/* Subtle gradient glow */}
      <div className={`
        pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 rounded-full opacity-10 blur-2xl
        ${accentColor === 'emerald' ? 'bg-emerald-500' : ''}
        ${accentColor === 'cyan' ? 'bg-cyan-500' : ''}
        ${accentColor === 'amber' ? 'bg-amber-500' : ''}
        ${accentColor === 'rose' ? 'bg-rose-500' : ''}
      `} />
    </div>
  )
}

export default function OverviewCards() {
  // Read store data directly — no loading flags, just check if data is null
  const status = useSystemStore((s) => s.status)
  const report = useHealthStore((s) => s.report)
  const connectionStatus = useConnectionStore((s) => s.status)
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)

  // Check disk usage for pulse warning
  const diskPercent = status?.system.disk.percent
    ? parseInt(status.system.disk.percent.replace('%', ''), 10)
    : 0
  const diskWarning = diskPercent >= 85

  // Status data hasn't arrived yet — show loading skeletons for first 3 cards
  const statusLoading = !status

  // --- Stacks ---
  const runningStacks = status?.stacks.running ?? 0
  const totalStacks = status?.stacks.total ?? 0
  const stackTrend: CardProps['trend'] =
    totalStacks === 0 ? 'stable' : runningStacks === totalStacks ? 'up' : 'down'

  // --- Containers ---
  const runningContainers = status?.docker.containers.running ?? 0
  const totalContainers = status?.docker.containers.total ?? 0
  const stoppedContainers = status?.docker.containers.stopped ?? 0
  const containerTrend: CardProps['trend'] =
    stoppedContainers > 0 ? 'down' : runningContainers > 0 ? 'up' : 'stable'

  // --- Images ---
  const imageCount = status?.docker.images ?? 0

  // --- Health ---
  // When no report AND not connected, show "Unknown"
  // When no report AND connected (still loading), show "Checking..."
  // When report exists, show real status
  const hasReport = !!report
  const isDisconnected = connectionStatus !== 'connected'
  const healthStatus = hasReport
    ? report.status
    : isDisconnected
      ? ('unknown' as const)
      : ('loading' as const)

  const healthLabel = hasReport
    ? report.status === 'healthy' ? 'Healthy'
      : report.status === 'degraded' ? 'Degraded'
      : 'Critical'
    : isDisconnected ? 'Unknown' : 'Checking...'

  const healthAccent: CardProps['accentColor'] = hasReport
    ? report.status === 'healthy' ? 'emerald'
      : report.status === 'degraded' ? 'amber'
      : 'rose'
    : isDisconnected ? 'rose' : 'amber'

  const healthTrend: CardProps['trend'] = hasReport
    ? report.status === 'healthy' ? 'up'
      : report.status === 'degraded' ? 'stable'
      : 'down'
    : isDisconnected ? 'down' : 'stable'

  // Only show skeleton when connected and still waiting for first data
  const healthLoading = !hasReport && connectionStatus === 'connected'

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Layers className="h-5 w-5" />}
        label="Total Stacks"
        value={
          <span className="tabular-nums">
            <AnimatedCounter value={runningStacks} />
            {' / '}
            <AnimatedCounter value={totalStacks} />
          </span>
        }
        subtitle={`${runningStacks} running`}
        accentColor={runningStacks === totalStacks && totalStacks > 0 ? 'emerald' : 'amber'}
        trend={stackTrend}
        loading={statusLoading}
        index={0}
        onClick={() => setCurrentPage('stacks')}
      />
      <StatCard
        icon={<Box className="h-5 w-5" />}
        label="Running Containers"
        value={runningContainers}
        subtitle={`${totalContainers} total, ${stoppedContainers} stopped`}
        accentColor={stoppedContainers > 0 ? 'amber' : 'emerald'}
        trend={containerTrend}
        loading={statusLoading}
        index={1}
        onClick={() => setCurrentPage('containers')}
      />
      <StatCard
        icon={<HardDrive className="h-5 w-5" />}
        label="Docker Images"
        value={imageCount}
        subtitle={diskWarning ? `Disk ${diskPercent}% used` : undefined}
        accentColor={diskWarning ? 'amber' : 'cyan'}
        trend="stable"
        loading={statusLoading}
        index={2}
        onClick={() => setCurrentPage('images')}
        pulse={diskWarning}
      />
      <StatCard
        icon={<HeartPulse className="h-5 w-5" />}
        label="System Health"
        value={healthLabel}
        subtitle={
          hasReport
            ? `${report.summary.healthy} healthy, ${report.summary.unhealthy} unhealthy`
            : isDisconnected
              ? 'API not reachable'
              : 'Loading health data...'
        }
        accentColor={healthAccent}
        trend={healthTrend}
        loading={healthLoading}
        index={3}
        onClick={() => setCurrentPage('health')}
      />
    </div>
  )
}
