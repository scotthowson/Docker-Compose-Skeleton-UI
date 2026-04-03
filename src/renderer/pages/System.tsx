// =============================================================================
// System — System info, Docker disk usage, and Maintenance operations
// =============================================================================

import React, { useState, useEffect } from 'react'
import {
  Monitor, Cpu, MemoryStick, HardDrive, Server, RefreshCw,
  Trash2, AlertTriangle, CheckCircle, XCircle, Loader2,
  Gauge, Database, Zap, Wrench, ChevronDown, Download,
  Lock, User, Eye, EyeOff, Package, Shield,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { fetchSystemInfo, runDockerPrune, runImagePrune, terminalAuth, checkOsUpdates, applyOsUpdates, getOsUpdateStatus } from '../api/endpoints'
import { useSystemStore } from '../stores/systemStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import type { SystemInfo, DockerDiskUsage, OsUpdateCheckResponse } from '../../shared/types'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { useToast } from '../components/common/Toast'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMb(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`
  }
  return `${mb.toFixed(0)} MB`
}

// ---------------------------------------------------------------------------
// Section Card
// ---------------------------------------------------------------------------

function SectionCard({ icon, title, children }: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="glass rounded-xl border border-white/5 hover:border-white/10 transition-all duration-200">
      <div className="px-5 py-4 border-b border-white/[0.03] flex items-center gap-2.5">
        {icon}
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function KvRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.03] last:border-b-0">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-slate-200 font-mono">{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Maintenance Panel
// ---------------------------------------------------------------------------

function MaintenancePanel() {
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const [pruning, setPruning] = useState(false)
  const [imagePruning, setImagePruning] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [confirmAction, setConfirmAction] = useState<'prune' | 'image-prune' | null>(null)

  // Hide entire panel for non-admin users
  if (!isAdmin) return null

  const handlePrune = async () => {
    setConfirmAction(null)
    setPruning(true)
    setResult(null)
    try {
      const res = await runDockerPrune()
      setResult({
        success: res.success,
        message: res.success ? 'Docker system prune completed successfully' : (res.output || 'Prune failed'),
      })
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Prune failed' })
    } finally {
      setPruning(false)
    }
  }

  const handleImagePrune = async () => {
    setConfirmAction(null)
    setImagePruning(true)
    setResult(null)
    try {
      const res = await runImagePrune()
      setResult({
        success: res.success,
        message: res.success ? 'Image prune completed successfully' : (res.output || 'Image prune failed'),
      })
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Image prune failed' })
    } finally {
      setImagePruning(false)
    }
  }

  return (
    <SectionCard
      icon={<Wrench size={16} className="text-amber-400" />}
      title="Maintenance"
    >
      <p className="text-xs text-slate-500 mb-4">
        Clean up unused Docker resources to reclaim disk space.
      </p>

      {/* Result banner */}
      {result && (
        <div className={`
          flex items-center gap-2 rounded-lg p-3 mb-4 text-sm animate-fade-in
          ${result.success
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
          }
        `}>
          {result.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
          <span>{result.message}</span>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 mb-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                {confirmAction === 'prune' ? 'Run Docker System Prune?' : 'Run Image Prune?'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {confirmAction === 'prune'
                  ? 'This will remove all stopped containers, unused networks, dangling images, and build cache.'
                  : 'This will remove unused Docker images to free disk space.'}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={confirmAction === 'prune' ? handlePrune : handleImagePrune}
                  className="
                    rounded-lg px-3 py-1.5 text-xs font-medium
                    bg-amber-500/20 text-amber-300 border border-amber-500/30
                    hover:bg-amber-500/30 transition-colors
                  "
                >
                  Yes, proceed
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="
                    rounded-lg px-3 py-1.5 text-xs font-medium
                    text-slate-400 border border-white/10
                    hover:bg-white/5 transition-colors
                  "
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => setConfirmAction('prune')}
          disabled={pruning || imagePruning}
          className="
            flex items-center gap-3 rounded-xl p-4
            bg-slate-800/40 border border-white/[0.03]
            hover:bg-slate-800/60 hover:border-white/10
            disabled:opacity-50 transition-all duration-200
            text-left group
          "
        >
          <div className="rounded-lg p-2.5 bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/15 transition-colors">
            {pruning ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">System Prune</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Remove stopped containers, networks, cache</p>
          </div>
        </button>

        <button
          onClick={() => setConfirmAction('image-prune')}
          disabled={pruning || imagePruning}
          className="
            flex items-center gap-3 rounded-xl p-4
            bg-slate-800/40 border border-white/[0.03]
            hover:bg-slate-800/60 hover:border-white/10
            disabled:opacity-50 transition-all duration-200
            text-left group
          "
        >
          <div className="rounded-lg p-2.5 bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/15 transition-colors">
            {imagePruning ? <Loader2 size={18} className="animate-spin" /> : <HardDrive size={18} />}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">Image Prune</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Remove unused Docker images</p>
          </div>
        </button>
      </div>
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// OS Package Updates Panel
// ---------------------------------------------------------------------------

function OsUpdatesPanel() {
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const { addToast } = useToast()

  // Auth state — store password in memory for sudo -S during session
  const [termToken, setTermToken] = useState<string | null>(() => {
    try {
      const raw = sessionStorage.getItem('terminal-session')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (parsed.expiresAt && parsed.expiresAt > Date.now()) return parsed.token
      return null
    } catch { return null }
  })
  const [sudoPassword, setSudoPassword] = useState<string | null>(null)
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authing, setAuthing] = useState(false)
  const [authError, setAuthError] = useState('')

  // Update state
  const [updateData, setUpdateData] = useState<OsUpdateCheckResponse | null>(null)
  const [checking, setChecking] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyOutput, setApplyOutput] = useState<string | null>(null)
  const [showPackages, setShowPackages] = useState(false)

  if (!isAdmin) return null

  const handleAuth = async () => {
    if (!authUsername.trim() || !authPassword) return
    setAuthing(true)
    setAuthError('')
    try {
      const res = await terminalAuth(authUsername.trim(), authPassword)
      if (res.success && res.token) {
        setTermToken(res.token)
        setSudoPassword(authPassword)  // Keep password in memory for sudo -S
        sessionStorage.setItem('terminal-session', JSON.stringify({
          token: res.token,
          username: res.username,
          expiresAt: Date.now() + (res.expires_in * 1000),
        }))
        setAuthPassword('')
        addToast({ type: 'success', message: `Authenticated as ${res.username}` })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed'
      if (msg.includes('429')) setAuthError('Too many attempts. Try again in 15 minutes.')
      else if (msg.includes('401')) setAuthError('Invalid Linux username or password.')
      else setAuthError(msg)
    } finally {
      setAuthing(false)
    }
  }

  const handleCheck = async () => {
    if (!termToken) return
    setChecking(true)
    try {
      const res = await checkOsUpdates(termToken, sudoPassword || undefined)
      setUpdateData(res)
      if (res.available) {
        addToast({ type: 'info', message: `${res.count} package update${res.count !== 1 ? 's' : ''} available` })
      } else {
        addToast({ type: 'success', message: 'System is up to date' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Check failed'
      if (msg.includes('401')) { setTermToken(null); sessionStorage.removeItem('terminal-session') }
      addToast({ type: 'error', message: msg })
    } finally {
      setChecking(false)
    }
  }

  const handleApply = async () => {
    if (!termToken) return
    setApplying(true)
    setApplyOutput(null)
    try {
      // Start background update
      await applyOsUpdates(termToken, sudoPassword || undefined)
      addToast({ type: 'info', message: 'OS update started — this may take a few minutes' })

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const status = await getOsUpdateStatus()
          if (status.status === 'complete') {
            clearInterval(pollInterval)
            setApplying(false)
            setApplyOutput(status.output || null)
            if (status.success) {
              addToast({ type: 'success', message: status.message || 'System updated successfully' })
              setUpdateData(null)
            } else {
              addToast({ type: 'error', message: status.message || 'Update completed with errors' })
            }
          }
        } catch {
          // Poll failed — keep trying
        }
      }, 3000)

      // Safety timeout: stop polling after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval)
        setApplying(false)
      }, 600000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed'
      if (msg.includes('401')) { setTermToken(null); setSudoPassword(null); sessionStorage.removeItem('terminal-session') }
      addToast({ type: 'error', message: msg })
      setApplying(false)
    }
  }

  return (
    <SectionCard
      icon={<Download size={16} className="text-emerald-400" />}
      title="OS Package Updates"
    >
      {/* Not authenticated — show auth form */}
      {!termToken ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-2.5">
            <Shield size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Linux system credentials are required to check and apply OS updates. Your password is sent securely to the server and validated against your system account.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={authUsername}
                onChange={(e) => { setAuthUsername(e.target.value); setAuthError('') }}
                placeholder="Linux username"
                className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={authPassword}
                onChange={(e) => { setAuthPassword(e.target.value); setAuthError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                placeholder="Password"
                className="w-full pl-9 pr-9 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          {authError && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
              <XCircle size={12} />
              {authError}
            </div>
          )}
          <button
            onClick={handleAuth}
            disabled={authing || !authUsername.trim() || !authPassword}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 disabled:opacity-50 transition-all press"
          >
            {authing ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
            Authenticate
          </button>
        </div>
      ) : (
        /* Authenticated — show update controls */
        <div className="space-y-3">
          {/* Status banner */}
          {updateData ? (
            updateData.available ? (
              <div className="flex items-center justify-between rounded-lg bg-cyan-500/5 border border-cyan-500/15 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-cyan-400" />
                  <span className="text-sm font-medium text-cyan-400">{updateData.count} update{updateData.count !== 1 ? 's' : ''} available</span>
                  <span className="text-[10px] text-slate-500">via {updateData.package_manager}</span>
                </div>
                <button
                  onClick={() => setShowPackages(!showPackages)}
                  className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPackages ? 'Hide' : 'Show'} packages
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-3 py-2.5">
                <CheckCircle size={14} className="text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">System is up to date</span>
                <span className="text-[10px] text-slate-500">via {updateData.package_manager}</span>
              </div>
            )
          ) : (
            <p className="text-xs text-slate-500">Click "Check for Updates" to scan for available OS package updates.</p>
          )}

          {/* Package list */}
          {showPackages && updateData?.packages && updateData.packages.length > 0 && (
            <div className="rounded-lg bg-slate-950/60 border border-white/5 max-h-48 overflow-y-auto scrollbar-thin">
              <div className="divide-y divide-white/[0.03]">
                {updateData.packages.map((pkg) => (
                  <div key={pkg.package} className="flex items-center justify-between px-3 py-1.5 text-xs">
                    <span className="text-slate-300 font-mono truncate">{pkg.package}</span>
                    <span className="text-slate-500 font-mono text-[10px] shrink-0 ml-3">{pkg.version}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Update output log */}
          {applyOutput && (
            <div className="rounded-lg bg-slate-950/60 border border-white/5 max-h-64 overflow-y-auto scrollbar-thin">
              <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Update Log</span>
              </div>
              <pre className="p-3 text-[10px] font-mono text-slate-400 leading-relaxed whitespace-pre-wrap">{applyOutput}</pre>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCheck}
              disabled={checking || applying}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10 disabled:opacity-50 transition-all press"
            >
              {checking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Check for Updates
            </button>
            {updateData?.available && (
              <button
                onClick={handleApply}
                disabled={applying || checking}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all press"
              >
                {applying ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {applying ? 'Updating...' : 'Apply Updates'}
              </button>
            )}
            <button
              onClick={() => { setTermToken(null); setSudoPassword(null); sessionStorage.removeItem('terminal-session'); setUpdateData(null); setApplyOutput(null) }}
              className="text-[10px] text-slate-500 hover:text-slate-300 ml-auto transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function System() {
  const setSystem = useSystemStore((s) => s.setSystem)
  const isConnected = useConnectionStore((s) => s.status) === 'connected'

  const { data, loading, error, refresh } = usePolling<SystemInfo>(fetchSystemInfo, 30000, {
    enabled: isConnected,
  })

  useEffect(() => {
    if (data) setSystem(data)
  }, [data, setSystem])

  const info = data
  const diskUsage: DockerDiskUsage[] = info?.docker_disk_usage ?? []

  return (
    <div className="space-y-3 md:space-y-6">
      <DisconnectedBanner />
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/5">
            <Monitor className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold"><span className="text-gradient">System Information</span></h1>
            <p className="text-sm text-slate-400 mt-0.5">Server resources, Docker runtime, and maintenance tools</p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="
            flex items-center gap-2 rounded-lg px-3.5 py-2
            text-sm font-medium text-slate-300
            bg-white/5 border border-white/10
            hover:bg-white/10 hover:border-white/15
            disabled:opacity-50 transition-all duration-200
          "
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="glass rounded-xl p-4 border border-rose-500/20">
          <p className="text-sm text-rose-400">Failed to fetch system info: {error.message}</p>
        </div>
      )}

      {/* Loading placeholder */}
      {loading && !info && (
        <div className="glass rounded-xl border border-white/5 p-8 text-center">
          <RefreshCw size={20} className="inline animate-spin text-slate-500 mr-2" />
          <span className="text-sm text-slate-500">Loading system information...</span>
        </div>
      )}

      {/* Info cards grid */}
      {info && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Server Info */}
          <SectionCard
            icon={<Server size={16} className="text-emerald-400" />}
            title="Server"
          >
            <KvRow label="Hostname" value={info.hostname} />
            <KvRow label="Kernel" value={info.kernel} />
            <KvRow label="Docker Version" value={info.docker_version} />
          </SectionCard>

          {/* CPU & Memory */}
          <SectionCard
            icon={<Cpu size={16} className="text-cyan-400" />}
            title="Hardware"
          >
            <KvRow label="CPU Cores" value={info.cpu_count} />
            <KvRow label="Total Memory" value={formatMb(info.memory_total_mb)} />
            <KvRow label="Swap" value={formatMb(info.swap_total_mb)} />
          </SectionCard>
        </div>
      )}

      {/* Docker disk usage table */}
      {diskUsage.length > 0 && (
        <SectionCard
          icon={<Database size={16} className="text-cyan-400" />}
          title="Docker Disk Usage"
        >
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Active</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Size</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Reclaimable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {diskUsage.map((row) => (
                  <tr key={row.type} className="hover:bg-white/[0.03] transition-colors duration-150">
                    <td className="px-5 py-3 text-slate-200 font-medium text-xs">{row.type}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-300 text-xs">{row.total}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-300 text-xs">{row.active}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-300 text-xs">{row.size}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                        {row.reclaimable}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* OS Package Updates */}
      {isConnected && <OsUpdatesPanel />}

      {/* Maintenance Panel */}
      {isConnected && <MaintenancePanel />}
    </div>
  )
}
