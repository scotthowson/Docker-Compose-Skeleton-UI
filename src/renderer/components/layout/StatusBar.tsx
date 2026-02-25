// =============================================================================
// StatusBar — Bottom bar: 1-row on desktop, 2-row on mobile
// =============================================================================

import { useEffect, useState, useCallback } from 'react'
import { Activity, Clock, Container, Cpu, HardDrive, MemoryStick, Wifi } from 'lucide-react'
import { useSystemStore } from '../../stores/systemStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { useHealthStore } from '../../stores/healthStore'

function formatUptime(seconds: number): string {
  if (seconds < 0) return '--'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)
  return parts.join(' ')
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function MemoryBar({ used, total }: { used: number; total: number }) {
  const percent = total > 0 ? ((total - used) / total) * 100 : 0
  const color = percent > 80 ? 'bg-rose-400' : percent > 60 ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded-full ${color} progress-bar`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[10px] text-slate-500 tabular-nums">{Math.round(percent)}%</span>
    </div>
  )
}

export function StatusBar() {
  const status = useSystemStore((s) => s.status)
  const version = useSystemStore((s) => s.version)
  const connectionStatus = useConnectionStore((s) => s.status)
  const lastConnected = useConnectionStore((s) => s.lastConnected)
  const healthReport = useHealthStore((s) => s.report)

  const [now, setNow] = useState(formatTime(new Date()))
  const [lastRefreshAgo, setLastRefreshAgo] = useState('')

  const updateRefreshAgo = useCallback(() => {
    if (!lastConnected) { setLastRefreshAgo(''); return }
    const diff = Math.floor((Date.now() - lastConnected) / 1000)
    if (diff < 5) setLastRefreshAgo('just now')
    else if (diff < 60) setLastRefreshAgo(`${diff}s ago`)
    else setLastRefreshAgo(`${Math.floor(diff / 60)}m ago`)
  }, [lastConnected])

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(formatTime(new Date()))
      updateRefreshAgo()
    }, 1000)
    return () => clearInterval(timer)
  }, [updateRefreshAgo])

  const uptime = status?.uptime_seconds != null ? formatUptime(status.uptime_seconds) : '--'
  const apiVersion = version?.api_version ?? '--'
  const containersRunning = status?.docker.containers.running ?? 0
  const containersTotal = status?.docker.containers.total ?? 0
  const isConnected = connectionStatus === 'connected'
  const memUsed = status?.system?.memory_mb?.available ?? 0
  const memTotal = status?.system?.memory_mb?.total ?? 0
  const healthStatus = healthReport?.status
  const cpuCount = status?.system?.cpu_count ?? 0
  const loadAvg = status?.system?.load_average?.[0] ?? 0
  const cpuPct = cpuCount > 0 ? Math.min(100, Math.round((loadAvg / cpuCount) * 100)) : 0

  return (
    <footer className="bg-slate-900/80 backdrop-blur-xl border-t border-white/[0.05] shrink-0 select-none font-mono">
      {/* ---- Desktop: single row ---- */}
      <div className="hidden md:flex items-center justify-between h-7 px-4 text-[10px]">
        {/* Left */}
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            <span className={isConnected ? 'text-slate-400' : 'text-slate-600'}>
              {isConnected ? 'Connected' : connectionStatus}
            </span>
          </span>

          {healthStatus && (
            <>
              <span className="text-white/[0.06]">|</span>
              <span className="flex items-center gap-1">
                <Activity size={9} className={
                  healthStatus === 'healthy' ? 'text-emerald-400' :
                  healthStatus === 'degraded' ? 'text-amber-400' : 'text-rose-400'
                } />
                <span className={`capitalize ${
                  healthStatus === 'healthy' ? 'text-emerald-400/80' :
                  healthStatus === 'degraded' ? 'text-amber-400/80' : 'text-rose-400/80'
                }`}>
                  {healthStatus}
                </span>
              </span>
            </>
          )}

          <span className="text-white/[0.06]">|</span>
          <span className="flex items-center gap-1 text-slate-600">
            <Clock size={9} />
            Uptime: <span className="text-slate-400">{uptime}</span>
          </span>

          <span className="text-white/[0.06]">|</span>
          <span className="text-slate-600">
            API <span className="text-slate-500">v{apiVersion}</span>
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2.5">
          {cpuCount > 0 && (
            <>
              <span className="flex items-center gap-1 text-slate-600"><Cpu size={9} /> CPU</span>
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className={`h-full rounded-full progress-bar ${cpuPct > 80 ? 'bg-rose-400' : cpuPct > 60 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${cpuPct}%` }} />
                </div>
                <span className="text-[10px] text-slate-500 tabular-nums">{cpuPct}%</span>
              </div>
              <span className="text-white/[0.06]">|</span>
            </>
          )}
          {memTotal > 0 && (
            <>
              <span className="flex items-center gap-1 text-slate-600"><MemoryStick size={9} /> RAM</span>
              <MemoryBar used={memUsed} total={memTotal} />
              <span className="text-white/[0.06]">|</span>
            </>
          )}

          <span className="flex items-center gap-1 text-slate-600">
            <Container size={9} />
            <span className="text-emerald-400/80">{containersRunning}</span>
            <span className="text-slate-700">/</span>
            <span className="text-slate-400">{containersTotal}</span>
          </span>

          {lastRefreshAgo && (
            <>
              <span className="text-white/[0.06]">|</span>
              <span className="flex items-center gap-1 text-slate-600">
                <Wifi size={9} className="text-emerald-500/60" />
                <span className="text-slate-500">{lastRefreshAgo}</span>
              </span>
            </>
          )}

          <span className="text-white/[0.06]">|</span>
          <span className="text-slate-500 tabular-nums">{now}</span>
        </div>
      </div>

      {/* ---- Mobile: two rows ---- */}
      <div className="flex md:hidden flex-col gap-1 px-3 py-2 text-[9px]">
        {/* Row 1: connection + health + containers + clock */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <span className={isConnected ? 'text-slate-400' : 'text-slate-600'}>
                {isConnected ? 'Connected' : connectionStatus}
              </span>
            </span>
            {healthStatus && (
              <>
                <span className="text-white/[0.06]">|</span>
                <span className="flex items-center gap-1">
                  <Activity size={8} className={
                    healthStatus === 'healthy' ? 'text-emerald-400' :
                    healthStatus === 'degraded' ? 'text-amber-400' : 'text-rose-400'
                  } />
                  <span className={`capitalize ${
                    healthStatus === 'healthy' ? 'text-emerald-400/80' :
                    healthStatus === 'degraded' ? 'text-amber-400/80' : 'text-rose-400/80'
                  }`}>
                    {healthStatus}
                  </span>
                </span>
              </>
            )}
          </div>
          <span className="text-slate-500 tabular-nums">{now}</span>
        </div>

        {/* Row 2: containers + uptime + last refresh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-slate-600">
              <Container size={8} />
              <span className="text-emerald-400/80">{containersRunning}</span>
              <span className="text-slate-700">/</span>
              <span className="text-slate-400">{containersTotal}</span>
            </span>
            <span className="text-white/[0.06]">|</span>
            <span className="flex items-center gap-1 text-slate-600">
              <Clock size={8} />
              <span className="text-slate-400">{uptime}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {lastRefreshAgo && (
              <span className="flex items-center gap-1 text-slate-600">
                <Wifi size={8} className="text-emerald-500/60" />
                <span className="text-slate-500">{lastRefreshAgo}</span>
              </span>
            )}
            <span className="text-slate-600">v{apiVersion}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
