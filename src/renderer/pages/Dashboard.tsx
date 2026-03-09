// =============================================================================
// Dashboard — Advanced overview page with live data, disk mounts, quick actions
// =============================================================================

import React, { useRef, useEffect, useState } from 'react'
import { WifiOff, Wifi, Loader2, Server, RefreshCw, ChevronDown } from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import {
  fetchEvents, fetchVersion,
  fetchContainers, fetchDisks, fetchSystemInfo,
  fetchStacks, fetchImageUpdates, fetchBackupStatus,
  fetchLogStats, fetchMaintenanceReport, fetchNotificationHistory,
  fetchAutomations, fetchMetricsTrends,
} from '../api/endpoints'
import { useConnectionStore } from '../stores/connectionStore'
import { useSystemStore } from '../stores/systemStore'
import { useHealthStore } from '../stores/healthStore'
import { useLogStore } from '../stores/logStore'
import OverviewCards from '../components/dashboard/OverviewCards'
import HealthSummary from '../components/dashboard/HealthSummary'
import ResourceChart from '../components/dashboard/ResourceChart'
import type { ResourceHistoryPoint } from '../components/dashboard/ResourceChart'
import RecentEvents from '../components/dashboard/RecentEvents'
import DiskMonitor from '../components/dashboard/DiskMonitor'
import QuickActions from '../components/dashboard/QuickActions'
import ContainerOverview from '../components/dashboard/ContainerOverview'
import ServerInfo from '../components/dashboard/ServerInfo'
import StackStatusGrid from '../components/dashboard/StackStatusGrid'
import ImageUpdateAlert from '../components/dashboard/ImageUpdateAlert'
import BackupStatusCard from '../components/dashboard/BackupStatusCard'
import TopResourceConsumers from '../components/dashboard/TopResourceConsumers'
import LogHealthSummary from '../components/dashboard/LogHealthSummary'
import MaintenanceSummary from '../components/dashboard/MaintenanceSummary'
import NotificationStatus from '../components/dashboard/NotificationStatus'
import ActiveAutomations from '../components/dashboard/ActiveAutomations'
import PersistentTrends from '../components/dashboard/PersistentTrends'
import { useNotificationStore } from '../stores/notificationStore'
import { useStackStore } from '../stores/stackStore'
import { useToast } from '../components/common/Toast'
import type { ContainerInfo, DiskInfo, HealthReport } from '../../shared/types'
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

  const setSystemVersion = useSystemStore((s) => s.setVersion)
  const setSystemInfo = useSystemStore((s) => s.setSystem)
  const systemStatus = useSystemStore((s) => s.status)
  const systemInfo = useSystemStore((s) => s.system)

  const healthReport = useHealthStore((s) => s.report)

  const setEvents = useLogStore((s) => s.setEvents)
  const events = useLogStore((s) => s.events)
  const setStacks = useStackStore((s) => s.setStacks)

  // Resource history for trending charts (cap at 60 data points)
  const resourceHistoryRef = useRef<ResourceHistoryPoint[]>([])

  // Track previous health status for notification triggers
  const prevHealthStatusRef = useRef<HealthReport['status'] | null>(null)

  // Welcome toast after first-time setup
  const { addToast } = useToast()
  useEffect(() => {
    if (sessionStorage.getItem('dcs-just-setup')) {
      sessionStorage.removeItem('dcs-just-setup')
      addToast({ type: 'success', message: 'Welcome! Your server is configured and ready.', duration: 6000 })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll success/error callbacks for connection health monitoring
  const onPollSuccess = React.useCallback(() => {
    reportPollSuccess()
  }, [reportPollSuccess])

  const onPollError = React.useCallback((err: Error) => {
    reportPollFailure()
  }, [reportPollFailure])

  // =========================================================================
  // Data from stores (populated by GlobalPoller)
  // =========================================================================

  // Build resource history from systemStatus changes (fed by GlobalPoller)
  React.useEffect(() => {
    if (!systemStatus) return

    const cpuCount = systemInfo?.cpu_count ?? 1
    const loadAvg1 = systemStatus.system.load_average[0] ?? 0
    const cpuPercent = Math.min(100, Math.round((loadAvg1 / cpuCount) * 100))

    const memTotal = systemStatus.system.memory_mb.total
    const memAvailable = systemStatus.system.memory_mb.available
    const memUsed = Math.max(0, memTotal - memAvailable)
    const memPercent = memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0

    const now = new Date()
    const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

    const point: ResourceHistoryPoint = {
      time: timeLabel,
      cpu: cpuPercent,
      mem: memPercent,
    }

    const history = resourceHistoryRef.current
    history.push(point)
    if (history.length > 60) {
      history.splice(0, history.length - 60)
    }
  }, [systemStatus, systemInfo])

  // Health state change notifications (fed by GlobalPoller)
  useEffect(() => {
    if (!healthReport) return
    const current = healthReport.status
    const prev = prevHealthStatusRef.current

    // Only fire on transitions (not on first load)
    if (prev !== null && prev !== current) {
      const { preferences, addNotification } = useNotificationStore.getState()
      if (preferences.healthAlerts) {
        if (current === 'degraded' || current === 'critical') {
          addNotification({
            type: current === 'critical' ? 'error' : 'warning',
            title: current === 'critical' ? 'System Health Critical' : 'System Health Degraded',
            message: `${healthReport.summary.unhealthy} of ${healthReport.summary.total} containers unhealthy`,
            persist: true,
            action: { label: 'View Health', page: 'health' },
          })
        } else if (current === 'healthy' && (prev === 'degraded' || prev === 'critical')) {
          addNotification({
            type: 'success',
            title: 'System Health Restored',
            message: `All ${healthReport.summary.total} containers are healthy`,
            persist: true,
            action: { label: 'View Health', page: 'health' },
          })
        }
      }
    }

    prevHealthStatusRef.current = current
  }, [healthReport])

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

  // =========================================================================
  // New widget polls
  // =========================================================================

  // --- Poll /stacks every 15s ---
  const stacksPoll = usePolling(fetchStacks, 15000, {
    enabled: isConnected,
    onError: onPollError,
  })

  // Sync stacks to store for CommandPalette access
  React.useEffect(() => {
    if (stacksPoll.data?.stacks) {
      setStacks(stacksPoll.data.stacks)
    }
  }, [stacksPoll.data, setStacks])

  // --- Poll /images/check-updates every 120s ---
  const imageUpdatesPoll = usePolling(fetchImageUpdates, 120000, {
    enabled: isConnected,
    onError: onPollError,
  })

  // --- Poll /backups/status every 30s ---
  const backupStatusPoll = usePolling(fetchBackupStatus, 30000, {
    enabled: isConnected,
    onError: onPollError,
  })

  // --- Poll /logs/stats every 30s ---
  const logStatsPoll = usePolling(fetchLogStats, 30000, {
    enabled: isConnected,
    onError: onPollError,
  })

  // --- Poll /maintenance/report every 60s ---
  const maintenancePoll = usePolling(fetchMaintenanceReport, 60000, {
    enabled: isConnected,
    onError: onPollError,
  })

  // --- Poll /notifications/history every 30s ---
  const notifHistoryPoll = usePolling(fetchNotificationHistory, 30000, {
    enabled: isConnected,
    onError: onPollError,
  })

  // --- Poll /automations every 60s ---
  const automationsPoll = usePolling(fetchAutomations, 60000, {
    enabled: isConnected,
    onError: onPollError,
  })

  // --- Poll /metrics/trends every 60s ---
  const fetchTrends1h = React.useCallback(() => fetchMetricsTrends('1h'), [])
  const trendsPoll = usePolling(fetchTrends1h, 60000, {
    enabled: isConnected,
    onError: onPollError,
  })

  // Show disconnected hero when not connected AND no cached data
  const hasNoData = !systemStatus && !healthReport && events.length === 0
  const showDisconnected = !isConnected && hasNoData

  return (
    <div className="space-y-3 md:space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-lg md:text-2xl font-bold tracking-tight">
            <span className="text-gradient">Dashboard</span>
          </h1>
          <p className="mt-1 text-xs md:text-sm text-slate-500">
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
        <div className="space-y-3 md:space-y-5">
          {/* Overview Cards — always visible */}
          <OverviewCards />

          {/* Stacks */}
          <DashboardSection label="Stacks" storageKey="stacks">
            <StackStatusGrid stacks={stacksPoll.data?.stacks ?? null} error={stacksPoll.error} onRetry={stacksPoll.refresh} />
          </DashboardSection>

          {/* Health & Resources */}
          <DashboardSection label="Health & Resources" storageKey="health-resources">
            <div className="grid grid-cols-1 gap-3 md:gap-6 lg:grid-cols-2">
              <HealthSummary />
              <ResourceChart history={resourceHistoryRef.current} />
            </div>
          </DashboardSection>

          {/* Infrastructure */}
          <DashboardSection label="Infrastructure" storageKey="infrastructure">
            <div className="grid grid-cols-1 gap-3 md:gap-6 lg:grid-cols-3">
              <ContainerOverview containers={containers} />
              <ServerInfo />
              <DiskMonitor disks={disks} />
            </div>
          </DashboardSection>

          {/* Trends & Consumers */}
          <DashboardSection label="Trends" storageKey="trends">
            <div className="grid grid-cols-1 gap-3 md:gap-6 lg:grid-cols-2">
              <PersistentTrends data={trendsPoll.data ?? null} error={trendsPoll.error} onRetry={trendsPoll.refresh} />
              <TopResourceConsumers />
            </div>
          </DashboardSection>

          {/* Updates & Backup */}
          <DashboardSection label="Updates & Backup" storageKey="updates-backup">
            <div className="grid grid-cols-1 gap-3 md:gap-6 lg:grid-cols-2">
              <ImageUpdateAlert data={imageUpdatesPoll.data ?? null} error={imageUpdatesPoll.error} onRetry={imageUpdatesPoll.refresh} />
              <BackupStatusCard data={backupStatusPoll.data ?? null} error={backupStatusPoll.error} onRetry={backupStatusPoll.refresh} />
            </div>
          </DashboardSection>

          {/* Monitoring */}
          <DashboardSection label="Monitoring" storageKey="monitoring">
            <div className="grid grid-cols-1 gap-3 md:gap-6 lg:grid-cols-3">
              <LogHealthSummary data={logStatsPoll.data ?? null} error={logStatsPoll.error} onRetry={logStatsPoll.refresh} />
              <MaintenanceSummary data={maintenancePoll.data ?? null} error={maintenancePoll.error} onRetry={maintenancePoll.refresh} />
              <NotificationStatus data={notifHistoryPoll.data ?? null} error={notifHistoryPoll.error} onRetry={notifHistoryPoll.refresh} />
            </div>
          </DashboardSection>

          {/* Automation & Actions */}
          <DashboardSection label="Automation & Actions" storageKey="automation-actions">
            <div className="grid grid-cols-1 gap-3 md:gap-6 lg:grid-cols-3">
              <ActiveAutomations data={automationsPoll.data ?? null} error={automationsPoll.error} onRetry={automationsPoll.refresh} />
              <RecentEvents />
              <QuickActions />
            </div>
          </DashboardSection>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardSection — collapsible row group
// ---------------------------------------------------------------------------

function DashboardSection({ label, storageKey, children }: {
  label: string
  storageKey: string
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(`dash-section-${storageKey}`) === 'true' } catch { return false }
  })

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(`dash-section-${storageKey}`, String(next)) } catch {}
  }

  return (
    <div>
      <button
        onClick={toggle}
        className="flex items-center gap-2 mb-3 group cursor-pointer select-none press"
      >
        <ChevronDown
          size={14}
          className={`text-slate-600 group-hover:text-slate-400 transition-all duration-200 ${collapsed ? '-rotate-90' : ''}`}
        />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 group-hover:text-slate-400 transition-colors">
          {label}
        </span>
      </button>
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
        collapsed ? 'max-h-0 opacity-0' : 'max-h-[3000px] opacity-100'
      }`}>
        {children}
      </div>
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
