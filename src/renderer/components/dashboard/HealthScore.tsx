import React, { useState, useEffect } from 'react'
import { HeartPulse, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { fetchHealthScore } from '../../api/endpoints'
import type { HealthScoreResponse } from '../../../shared/types'
import { useSettingsStore } from '../../stores/settingsStore'

const gradeColors: Record<string, string> = {
  A: 'text-emerald-400',
  B: 'text-cyan-400',
  C: 'text-amber-400',
  D: 'text-orange-400',
  F: 'text-rose-400',
}

const scoreStrokeColors: Record<string, string> = {
  A: '#10b981',
  B: '#06b6d4',
  C: '#f59e0b',
  D: '#f97316',
  F: '#f43f5e',
}

function getGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

export function HealthScore() {
  const [data, setData] = useState<HealthScoreResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const setCurrentPage = useSettingsStore(s => s.setCurrentPage)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const res = await fetchHealthScore()
        if (mounted) setData(res)
      } catch { /* ignore */ }
      if (mounted) setLoading(false)
    }
    load()
    const interval = setInterval(load, 30000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  const score = data?.score ?? 0
  const grade = data?.grade ?? getGrade(score)
  const strokeColor = scoreStrokeColors[grade] || '#64748b'

  // SVG circle parameters
  const size = 120
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const factors = data?.factors

  return (
    <div
      className="glass rounded-xl p-5 cursor-pointer hover:border-emerald-500/20 border border-transparent transition-all"
      onClick={() => setCurrentPage('health')}
    >
      <div className="flex items-center gap-2 mb-4">
        <HeartPulse className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-medium text-slate-300">Health Score</span>
      </div>

      <div className="flex items-center gap-6">
        {/* Circular Gauge */}
        <div className="relative shrink-0">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background ring */}
            <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
            {/* Progress ring */}
            {!loading && (
              <circle
                cx={size/2} cy={size/2} r={radius} fill="none"
                stroke={strokeColor} strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-1000 ease-out"
              />
            )}
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {loading ? (
              <div className="w-8 h-8 rounded-full skeleton" />
            ) : (
              <>
                <span className="text-2xl font-bold text-white">{score}</span>
                <span className={`text-sm font-semibold ${gradeColors[grade] || 'text-slate-400'}`}>{grade}</span>
              </>
            )}
          </div>
        </div>

        {/* Factor Breakdown */}
        <div className="flex-1 space-y-2.5">
          {loading ? (
            [1,2,3,4].map(i => <div key={i} className="h-4 skeleton rounded" />)
          ) : factors && (
            <>
              <FactorBar label="Stacks" value={factors.stacks.score} />
              <FactorBar label="Resources" value={factors.resources.score} />
              <FactorBar label="Images" value={factors.images.score} />
              <FactorBar label="Uptime" value={factors.uptime.score} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FactorBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-7 text-right">{value}</span>
    </div>
  )
}
