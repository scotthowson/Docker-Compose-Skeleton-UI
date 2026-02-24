// =============================================================================
// Dashboard — Advanced overview page with live data, disk mounts, quick actions
// =============================================================================

import React from 'react'
import { WifiOff, Wifi, Loader2, Server, RefreshCw } from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import {
  fetchServerStatus, fetchHealthReport, fetchEvents, fetchVersion,
  fetchContainers, fetchDisks, fetchSystemInfo,
} from '../api/endpoints'
import { useConnectionStore } from '../stores/connectionStore'
import { useSystemStore } from '../stores/systemStore'
import { useHealthStore } from '../stores/healthStore'
import { useLogStore } from '../stores/logStore'
import OverviewCards from '../components/dashboard/OverviewCards'
import HealthSummary from '../components/dashboard/HealthSummary'
import ResourceChart from '../components/dashboard/ResourceChart'
import RecentEvents from '../components/dashboard/RecentEvents'
import DiskMonitor from '../components/dashboard/DiskMonitor'
import QuickActions from '../components/dashboard/QuickActions'
import ContainerOverview from '../components/dashboard/ContainerOverview'
import ServerInfo from '../components/dashboard/ServerInfo'
import type { ContainerInfo, DiskInfo } from '../../shared/types'
import type { ContainerListResponse } from '../api/endpoints'

// ---------------------------------------------------------------------------
// Disconnected hero — gorgeous animated illustration
// ---------------------------------------------------------------------------

function DisconnectedHero() {
  const connectionStatus = useConnectionStore((s) => s.status)
  const serverUrl = useConnectionStore((s) => s.serverUrl)
  const connect = useConnectionStore((s) => s.connect)
  const reconnectAttempts = useConnectionStore((s) => s.reconnectAttempts)

  const isConnecting = connectionStatus === 'connecting'
  const isError = connectionStatus === 'error'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] relative">
      {/* Background ambient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-emerald-500/[0.04] blur-3xl animate-breathe" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-cyan-500/[0.03] blur-3xl animate-breathe" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-violet-500/[0.02] blur-3xl animate-breathe" style={{ animationDelay: '4s' }} />
      </div>

      {/* Main illustration */}
      <div className="relative mb-8 w-40 h-40 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-40 h-40 rounded-full border border-white/[0.04] animate-spin-slow" />
        </div>
        <div className="absolute inset-[-16px] flex items-center justify-center">
          <div className="w-[calc(100%+32px)] h-[calc(100%+32px)] rounded-full border border-dashed border-white/[0.03]" style={{ animation: 'spin 20s linear infinite reverse' }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-orbit">
            <div className="w-2 h-2 rounded-full bg-emerald-400/60" />
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-orbit-reverse">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/40" />
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-center w-24 h-24">
          <div className={`
            absolute inset-0 rounded-2xl
            ${isConnecting ? 'bg-amber-500/10 border-amber-500/20' : isError ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-500/10 border-slate-500/20'}
            border backdrop-blur-sm transition-colors duration-500
          `} />
          {isConnecting ? (
            <Loader2 size={36} className="relative z-10 text-amber-400 animate-spin" />
          ) : isError ? (
            <WifiOff size={36} className="relative z-10 text-rose-400" />
          ) : (
            <Server size={36} className="relative z-10 text-slate-400 animate-pulse-glow" />
          )}
        </div>
      </div>

      <div className="text-center max-w-md animate-fade-in-up relative z-10">
        <h2 className="text-2xl font-bold mb-2">
          {isConnecting ? (
            <span className="text-gradient-warm">Connecting...</span>
          ) : isError ? (
            <span className="text-rose-400">Connection Failed</span>
          ) : (
            <span className="text-slate-300">Waiting for Server</span>
          )}
        </h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          {isConnecting
            ? 'Establishing connection to the API server...'
            : isError
              ? <>Unable to reach <span className="font-mono text-slate-400">{serverUrl}</span>. Make sure the server is running.</>
              : <>Connect to your Docker Compose Skeleton API to see live dashboard data.</>
          }
        </p>
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className={`
            inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium
            ${isConnecting ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : isError ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              : 'bg-slate-500/10 border-slate-500/20 text-slate-400'}
          `}>
            <span className="relative flex h-2 w-2">
              {isConnecting && <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnecting ? 'bg-amber-400' : isError ? 'bg-rose-400' : 'bg-slate-500'}`} />
            </span>
            {isConnecting ? 'Connecting' : isError ? `Attempt ${reconnectAttempts}` : 'Disconnected'}
          </div>
        </div>
        {(isError || connectionStatus === 'disconnected') && (
          <button
            onClick={() => connect()}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <RefreshCw size={15} />
            Retry Connection
          </button>
        )}
      </div>

      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const connectionStatus = useConnectionStore((s) => s.status)
  const isConnected = connectionStatus === 'connected'
  const reportPollSuccess = useConnectionStore((s) => s.reportPollSuccess)
  const reportPollFailure = useConnectionStore((s) => s.reportPollFailure)

  const setSystemStatus = useSystemStore((s) => s.setStatus)
  const setSystemVersion = useSystemStore((s) => s.setVersion)
  const setSystemInfo = useSystemStore((s) => s.setSystem)
  const systemStatus = useSystemStore((s) => s.status)

  const setHealthReport = useHealthStore((s) => s.setReport)
  const healthReport = useHealthStore((s) => s.report)

  const setEvents = useLogStore((s) => s.setEvents)
  const events = useLogStore((s) => s.events)

  // Poll success/error callbacks for connection health monitoring
  const onPollSuccess = React.useCallback(() => {
    reportPollSuccess()
  }, [reportPollSuccess])

  const onPollError = React.useCallback(() => {
    reportPollFailure()
  }, [reportPollFailure])

  // --- Poll /status every 5s ---
  const statusPoll = usePolling(fetchServerStatus, 5000, {
    enabled: isConnected,
    onError: onPollError,
  })

  React.useEffect(() => {
    if (statusPoll.data) {
      setSystemStatus(statusPoll.data)
      onPollSuccess()
    }
  }, [statusPoll.data, setSystemStatus, onPollSuccess])

  // --- Poll /health every 5s ---
  const healthPoll = usePolling(fetchHealthReport, 5000, {
    enabled: isConnected,
    onError: onPollError,
  })

  React.useEffect(() => {
    if (healthPoll.data) {
      setHealthReport(healthPoll.data)
      onPollSuccess()
    }
  }, [healthPoll.data, setHealthReport, onPollSuccess])

  // --- Poll /events every 3s ---
  const eventsPoll = usePolling(fetchEvents, 3000, {
    enabled: isConnected,
    onError: onPollError,
  })

  React.useEffect(() => {
    if (eventsPoll.data) {
      setEvents(eventsPoll.data.events)
      onPollSuccess()
    }
  }, [eventsPoll.data, setEvents, onPollSuccess])

  // --- Poll /version once (10min interval) ---
  const versionPoll = usePolling(fetchVersion, 600000, {
    enabled: isConnected,
    onError: onPollError,
  })

  React.useEffect(() => {
    if (versionPoll.data) {
      setSystemVersion(versionPoll.data)
      onPollSuccess()
    }
  }, [versionPoll.data, setSystemVersion, onPollSuccess])

  // --- Poll /system every 60s (provides cpu_count for CPU gauge) ---
  const systemInfoPoll = usePolling(fetchSystemInfo, 60000, {
    enabled: isConnected,
    onError: onPollError,
  })

  React.useEffect(() => {
    if (systemInfoPoll.data) {
      setSystemInfo(systemInfoPoll.data)
      onPollSuccess()
    }
  }, [systemInfoPoll.data, setSystemInfo, onPollSuccess])

  // --- Poll /containers every 10s ---
  const containersPoll = usePolling<ContainerListResponse>(fetchContainers, 10000, {
    enabled: isConnected,
    onError: onPollError,
  })

  const containers: ContainerInfo[] = containersPoll.data?.containers ?? []

  // --- Poll /disks every 30s ---
  const disksPoll = usePolling(fetchDisks, 30000, {
    enabled: isConnected,
    onError: onPollError,
  })

  const disks: DiskInfo[] = disksPoll.data?.disks ?? []

  // Show disconnected hero when not connected AND no cached data
  const hasNoData = !systemStatus && !healthReport && events.length === 0
  const showDisconnected = !isConnected && hasNoData

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-gradient">Dashboard</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {systemStatus
              ? <><span className="text-slate-400">{systemStatus.hostname}</span>{' \u2014 uptime '}{formatUptime(systemStatus.uptime_seconds)}</>
              : 'Overview of your Docker environment'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isConnected && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
              <Wifi size={13} className="text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Live</span>
            </div>
          )}
        </div>
      </div>

      {showDisconnected ? (
        <DisconnectedHero />
      ) : (
        <div className="space-y-6">
          {/* Row 1: Overview Cards */}
          <OverviewCards />

          {/* Row 2: Health + Resources */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <HealthSummary />
            <ResourceChart />
          </div>

          {/* Row 3: Containers + Server Info + Disks */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <ContainerOverview containers={containers} />
            <ServerInfo />
            <DiskMonitor disks={disks} />
          </div>

          {/* Row 4: Events + Quick Actions */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RecentEvents collapsible />
            </div>
            <QuickActions collapsible />
          </div>
        </div>
      )}
    </div>
  )
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)
  return parts.join(' ')
}
