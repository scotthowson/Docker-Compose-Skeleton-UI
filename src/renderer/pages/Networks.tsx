// =============================================================================
// Networks — Full network management with creation, deletion, topology
// =============================================================================

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Network, RefreshCw, Plus, Trash2, X, Check,
  Globe, Lock, AlertCircle, Loader2, Unplug, Plug, Eye,
  Search, ChevronDown, ChevronUp,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import {
  fetchNetworks, fetchNetworkDetail,
  createNetwork, deleteNetwork,
  disconnectFromNetwork,
} from '../api/endpoints'
import { useNetworkStore } from '../stores/networkStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import type {
  NetworkListResponse,
  NetworkInfo, NetworkDetail,
} from '../../shared/types'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { CopyButton } from '../components/common/CopyButton'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BUILTIN_NETWORKS = ['bridge', 'host', 'none']

// ---------------------------------------------------------------------------
// Create Network Modal
// ---------------------------------------------------------------------------

function CreateNetworkModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [driver, setDriver] = useState('bridge')
  const [subnet, setSubnet] = useState('')
  const [gateway, setGateway] = useState('')
  const [internal, setInternal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const isValid = name.trim().length > 0 && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name.trim())

  const handleCreate = async () => {
    if (!isValid || creating) return
    setCreating(true)
    setError('')
    try {
      await createNetwork({
        name: name.trim(),
        driver,
        subnet: subnet.trim() || undefined,
        gateway: gateway.trim() || undefined,
        internal,
      })
      onCreated()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create network')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg mx-4 glass p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <Network size={18} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Create Docker Network</h3>
              <p className="text-[10px] text-slate-500">Configure a new isolated network</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Network Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              placeholder="my-network"
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          {/* Driver */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Driver</label>
            <div className="flex gap-2">
              {['bridge', 'overlay', 'macvlan', 'host'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDriver(d)}
                  className={`
                    rounded-lg px-3 py-2 text-xs font-medium border transition-all
                    ${driver === d
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]'
                    }
                  `}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Subnet & Gateway */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Subnet <span className="text-slate-600">(optional)</span>
              </label>
              <input
                type="text"
                value={subnet}
                onChange={(e) => setSubnet(e.target.value)}
                placeholder="172.20.0.0/16"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Gateway <span className="text-slate-600">(optional)</span>
              </label>
              <input
                type="text"
                value={gateway}
                onChange={(e) => setGateway(e.target.value)}
                placeholder="172.20.0.1"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono text-xs"
              />
            </div>
          </div>

          {/* Internal toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setInternal(!internal)}
              className={`
                flex items-center justify-center w-5 h-5 rounded border transition-all
                ${internal
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'bg-white/5 border-white/20 hover:border-white/30'
                }
              `}
            >
              {internal && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <div className="flex items-center gap-1.5">
              <Lock size={12} className="text-slate-500" />
              <span className="text-xs text-slate-400">Internal network (no external access)</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2.5">
              <AlertCircle size={14} className="text-rose-400 shrink-0" />
              <p className="text-xs text-rose-300">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid || creating}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all press"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {creating ? 'Creating...' : 'Create Network'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Network Detail Panel
// ---------------------------------------------------------------------------

function NetworkDetailPanel({ network, onClose, onRefresh, isAdmin }: {
  network: NetworkInfo
  onClose: () => void
  onRefresh: () => void
  isAdmin: boolean
}) {
  const [detail, setDetail] = useState<NetworkDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [error, setError] = useState('')

  const isBuiltIn = BUILTIN_NETWORKS.includes(network.name)

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchNetworkDetail(network.name)
      .then((d) => { if (mounted) setDetail(d) })
      .catch(() => { if (mounted) setError('Failed to load details') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [network.name])

  const handleDisconnect = async (containerName: string) => {
    setDisconnecting(containerName)
    try {
      await disconnectFromNetwork(network.name, containerName)
      onRefresh()
      const d = await fetchNetworkDetail(network.name)
      setDetail(d)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setDisconnecting(null)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto scrollbar-thin bg-slate-900/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-11 h-11 rounded-xl ring-1 ${
              isBuiltIn ? 'bg-slate-500/10 ring-slate-500/20' : 'bg-cyan-500/10 ring-cyan-500/20'
            }`}>
              {detail?.internal ? <Lock size={20} className="text-amber-400" /> : <Network size={20} className={isBuiltIn ? 'text-slate-400' : 'text-cyan-400'} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 font-mono">{network.name}</h2>
              <p className="text-xs text-slate-500 font-mono">{network.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-slate-500" />
          </div>
        ) : error ? (
          <div className="p-8">
            <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3">
              <AlertCircle size={16} className="text-rose-400" />
              <p className="text-sm text-rose-300">{error}</p>
            </div>
          </div>
        ) : detail ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-white/[0.06]">
            {/* Left column — Network Properties */}
            <div className="p-8 space-y-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Network Properties</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Driver</p>
                  <span className="inline-flex rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-400">
                    {detail.driver}
                  </span>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Scope</p>
                  <p className="text-sm font-medium text-slate-200">{detail.scope}</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Subnet</p>
                  <p className="text-sm text-slate-200 font-mono">{detail.subnet || 'Auto-assigned'}</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Gateway</p>
                  <p className="text-sm text-slate-200 font-mono">{detail.gateway || 'Auto-assigned'}</p>
                </div>
              </div>

              {/* Internal badge */}
              {detail.internal && (
                <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                  <Lock size={14} className="text-amber-400" />
                  <span className="text-xs text-amber-300 font-medium">Internal network — no external connectivity</span>
                </div>
              )}

              {/* Full ID */}
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Full Network ID</p>
                <p className="text-xs text-slate-300 font-mono break-all">{detail.id}</p>
              </div>
            </div>

            {/* Right column — Connected Containers */}
            <div className="p-8">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Plug size={12} className="text-slate-500" />
                Connected Containers ({detail.containers.length})
              </h3>

              {detail.containers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Unplug size={28} className="text-slate-700 mb-3" />
                  <p className="text-sm text-slate-500">No containers connected</p>
                  <p className="text-xs text-slate-600 mt-1">Connect containers to this network using Docker CLI</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {detail.containers.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3.5 hover:bg-white/[0.05] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200 font-mono truncate">{c.name}</p>
                          <span className="inline-flex items-center gap-1">
                            <span className="text-[10px] text-slate-500 font-mono">{c.ipv4 || 'No IP assigned'}</span>
                            {c.ipv4 && <CopyButton text={c.ipv4} size={10} />}
                          </span>
                        </div>
                      </div>
                      {!isBuiltIn && isAdmin && (
                        <button
                          onClick={() => handleDisconnect(c.name)}
                          disabled={disconnecting === c.name}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-all disabled:opacity-50 shrink-0 ml-3"
                          title="Disconnect from network"
                        >
                          {disconnecting === c.name ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <Unplug size={11} />
                          )}
                          Disconnect
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

function DeleteConfirmModal({ name, onClose, onConfirm }: {
  name: string
  onClose: () => void
  onConfirm: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      await deleteNetwork(name)
      onConfirm()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete network')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md mx-4 glass p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20">
            <Trash2 size={18} className="text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Delete Network</h3>
            <p className="text-[10px] text-slate-500">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Are you sure you want to delete <span className="font-mono text-slate-200">{name}</span>?
        </p>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 mb-4">
            <AlertCircle size={14} className="text-rose-400 shrink-0" />
            <p className="text-xs text-rose-300">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-rose-500 hover:bg-rose-400 shadow-lg shadow-rose-500/25 disabled:opacity-50 transition-all"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Network Card
// ---------------------------------------------------------------------------

function NetworkCard({ net, onInspect, onDelete, isAdmin }: {
  net: NetworkInfo
  onInspect: () => void
  onDelete: () => void
  isAdmin: boolean
}) {
  const isBuiltIn = BUILTIN_NETWORKS.includes(net.name)
  const containerCount = net.containers.length

  return (
    <div
      className={`
        group glass glass-hover cursor-pointer overflow-hidden transition-all duration-300
        border-l-2 ${
          isBuiltIn ? 'border-l-slate-600/50' :
          containerCount > 0 ? 'border-l-emerald-500/70' : 'border-l-cyan-500/50'
        }
      `}
      onClick={onInspect}
    >
      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 mr-3">
            <div className="flex items-center gap-2">
              {net.driver === 'host' ? (
                <Globe size={14} className="text-amber-400 shrink-0" />
              ) : net.name === 'none' ? (
                <Unplug size={14} className="text-slate-500 shrink-0" />
              ) : (
                <Network size={14} className={isBuiltIn ? 'text-slate-400' : 'text-cyan-400'} />
              )}
              <h3 className="text-sm font-semibold text-slate-100 truncate group-hover:text-white transition-colors font-mono">
                {net.name}
              </h3>
            </div>
            <p className="text-[10px] text-slate-600 mt-0.5 font-mono truncate">{net.id.slice(0, 12)}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isBuiltIn && isAdmin && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="p-1.5 rounded-md text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                title="Delete network"
              >
                <Trash2 size={12} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onInspect() }}
              className="p-1.5 rounded-md text-slate-600 hover:text-cyan-400 hover:bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-all"
              title="Inspect"
            >
              <Eye size={12} />
            </button>
          </div>
        </div>

        {/* Driver + Scope tags */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
            {net.driver}
          </span>
          <span className="inline-flex rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            {net.scope}
          </span>
          {isBuiltIn && (
            <span className="inline-flex rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-medium text-slate-400">
              built-in
            </span>
          )}
        </div>

        {/* Connected containers */}
        <div className="pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 mb-2">
            <Plug size={11} className="text-slate-500" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">
              {containerCount} container{containerCount !== 1 ? 's' : ''}
            </span>
          </div>
          {containerCount > 0 ? (
            <div className="flex flex-wrap gap-1">
              {net.containers.slice(0, 5).map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-white/[0.06]"
                >
                  <span className="w-1 h-1 rounded-full bg-emerald-400" />
                  {c}
                </span>
              ))}
              {containerCount > 5 && (
                <span className="text-[10px] text-slate-600">+{containerCount - 5} more</span>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-slate-600 italic">No containers connected</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Networks() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [inspectNetwork, setInspectNetwork] = useState<NetworkInfo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'driver' | 'containers'>('name')
  const [sortAsc, setSortAsc] = useState(true)

  const userRole = useAuthStore((s) => s.userRole)
  const isAdmin = userRole === 'admin'

  const setNetworksStore = useNetworkStore((s) => s.setNetworks)
  const isConnected = useConnectionStore((s) => s.status) === 'connected'

  const {
    data: networksData,
    loading: networksLoading,
    refresh: refreshNetworks,
  } = usePolling<NetworkListResponse>(fetchNetworks, 30000, { enabled: isConnected })

  useEffect(() => {
    if (networksData) setNetworksStore(networksData.networks)
  }, [networksData, setNetworksStore])

  const networks: NetworkInfo[] = networksData?.networks ?? []

  // Filter & sort networks
  const filteredNetworks = useMemo(() => {
    let list = [...networks]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((n) =>
        n.name.toLowerCase().includes(q) ||
        n.driver.toLowerCase().includes(q) ||
        n.containers.some((c) => c.toLowerCase().includes(q))
      )
    }
    list.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortBy === 'driver') cmp = a.driver.localeCompare(b.driver)
      else cmp = b.containers.length - a.containers.length
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [networks, searchQuery, sortBy, sortAsc])

  const userNetworks = networks.filter((n) => !BUILTIN_NETWORKS.includes(n.name))
  const totalContainers = networks.reduce((sum, n) => sum + n.containers.length, 0)

  return (
    <div className="space-y-3 md:space-y-6">
      <DisconnectedBanner />
      {/* Modals */}
      {showCreateModal && (
        <CreateNetworkModal
          onClose={() => setShowCreateModal(false)}
          onCreated={refreshNetworks}
        />
      )}
      {inspectNetwork && (
        <NetworkDetailPanel
          network={inspectNetwork}
          onClose={() => setInspectNetwork(null)}
          onRefresh={refreshNetworks}
          isAdmin={isAdmin}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          name={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={refreshNetworks}
        />
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base md:text-xl font-bold text-slate-100">Networks</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Docker network topology and container connections
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="
                flex items-center gap-2 rounded-lg px-3.5 py-2
                text-sm font-medium text-emerald-400
                bg-emerald-500/10 border border-emerald-500/20
                hover:bg-emerald-500/20 hover:border-emerald-500/30
                transition-all duration-200
              "
            >
              <Plus size={15} />
              New Network
            </button>
          )}
          <button
            onClick={refreshNetworks}
            disabled={networksLoading}
            className="
              flex items-center gap-2 rounded-lg px-3.5 py-2
              text-sm font-medium text-slate-300
              bg-white/5 border border-white/10
              hover:bg-white/10 hover:border-white/15
              disabled:opacity-50 transition-all duration-200
            "
          >
            <RefreshCw size={15} className={networksLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats row — 3 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Network size={14} className="text-cyan-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Total Networks</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-100">{networks.length}</p>
        </div>
        <div className="glass-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Plus size={14} className="text-emerald-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">User Networks</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-100">{userNetworks.length}</p>
        </div>
        <div className="glass-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Plug size={14} className="text-amber-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Connections</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-100">{totalContainers}</p>
        </div>
      </div>

      {/* Search + Sort bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search networks..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/15 transition-all"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['name', 'driver', 'containers'] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                if (sortBy === s) setSortAsc(!sortAsc)
                else { setSortBy(s); setSortAsc(true) }
              }}
              className={`
                flex items-center gap-1 rounded-lg px-2.5 py-2 text-[11px] font-medium border transition-all
                ${sortBy === s
                  ? 'bg-white/[0.06] border-white/[0.1] text-slate-200'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
                }
              `}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {sortBy === s && (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
            </button>
          ))}
        </div>
      </div>

      {/* Network cards */}
      {networksLoading && networks.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-800/40 rounded-xl h-[180px] border border-white/[0.04]" />
          ))}
        </div>
      ) : filteredNetworks.length === 0 ? (
        <div className="glass-subtle rounded-xl p-12 text-center">
          <Network size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            {searchQuery ? 'No networks match your search' : 'No networks found'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
          {filteredNetworks.map((net) => (
            <NetworkCard
              key={net.id}
              net={net}
              onInspect={() => setInspectNetwork(net)}
              onDelete={() => setDeleteTarget(net.name)}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  )
}
