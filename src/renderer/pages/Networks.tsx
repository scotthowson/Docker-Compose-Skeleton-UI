// =============================================================================
// Networks — Full network & volume management with creation, deletion, topology
// =============================================================================

import { useState, useEffect, useMemo } from 'react'
import {
  Network, HardDrive, RefreshCw, Plus, Trash2, X, Check,
  Globe, Lock, AlertCircle, Loader2, Unplug, Plug, Eye,
  Search, ChevronDown, ChevronUp, Info,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import {
  fetchNetworks, fetchVolumes, fetchNetworkDetail,
  createNetwork, deleteNetwork, connectToNetwork,
  disconnectFromNetwork, deleteVolume,
} from '../api/endpoints'
import { useNetworkStore } from '../stores/networkStore'
import { useConnectionStore } from '../stores/connectionStore'
import type {
  NetworkListResponse, VolumeListResponse,
  NetworkInfo, VolumeInfo, NetworkDetail,
} from '../../shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

const BUILTIN_NETWORKS = ['bridge', 'host', 'none']

type TabId = 'networks' | 'volumes'

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
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-all"
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
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-all font-mono text-xs"
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
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-all font-mono text-xs"
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
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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

function NetworkDetailPanel({ network, onClose, onRefresh }: {
  network: NetworkInfo
  onClose: () => void
  onRefresh: () => void
}) {
  const [detail, setDetail] = useState<NetworkDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [error, setError] = useState('')

  const isBuiltIn = BUILTIN_NETWORKS.includes(network.name)

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
      // Refetch detail
      const d = await fetchNetworkDetail(network.name)
      setDetail(d)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-xl mx-4 glass p-6 animate-scale-in max-h-[80vh] overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className={`flex items-center justify-center w-9 h-9 rounded-xl ring-1 ${
              isBuiltIn ? 'bg-slate-500/10 ring-slate-500/20' : 'bg-cyan-500/10 ring-cyan-500/20'
            }`}>
              {detail?.internal ? <Lock size={18} className="text-amber-400" /> : <Network size={18} className={isBuiltIn ? 'text-slate-400' : 'text-cyan-400'} />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">{network.name}</h3>
              <p className="text-[10px] text-slate-500">{network.id.slice(0, 12)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-slate-500" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2.5">
            <AlertCircle size={14} className="text-rose-400" />
            <p className="text-xs text-rose-300">{error}</p>
          </div>
        ) : detail ? (
          <div className="space-y-4">
            {/* Network info grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Driver</p>
                <span className="inline-flex rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-xs font-medium text-cyan-400">
                  {detail.driver}
                </span>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Scope</p>
                <p className="text-sm text-slate-200">{detail.scope}</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Subnet</p>
                <p className="text-sm text-slate-200 font-mono">{detail.subnet || 'Auto'}</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Gateway</p>
                <p className="text-sm text-slate-200 font-mono">{detail.gateway || 'Auto'}</p>
              </div>
            </div>

            {/* Internal badge */}
            {detail.internal && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                <Lock size={12} className="text-amber-400" />
                <span className="text-xs text-amber-300">Internal network — no external connectivity</span>
              </div>
            )}

            {/* Connected containers */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Plug size={12} className="text-slate-500" />
                Connected Containers ({detail.containers.length})
              </h4>
              {detail.containers.length === 0 ? (
                <p className="text-xs text-slate-600 italic py-3">No containers connected</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.containers.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <div>
                          <p className="text-xs text-slate-200 font-mono">{c.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{c.ipv4 || 'No IP assigned'}</p>
                        </div>
                      </div>
                      {!isBuiltIn && (
                        <button
                          onClick={() => handleDisconnect(c.name)}
                          disabled={disconnecting === c.name}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-50"
                          title="Disconnect"
                        >
                          {disconnecting === c.name ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <Unplug size={10} />
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

function DeleteConfirmModal({ type, name, onClose, onConfirm }: {
  type: 'network' | 'volume'
  name: string
  onClose: () => void
  onConfirm: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      if (type === 'network') {
        await deleteNetwork(name)
      } else {
        await deleteVolume(name)
      }
      onConfirm()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to delete ${type}`)
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
            <h3 className="text-sm font-semibold text-slate-100">Delete {type === 'network' ? 'Network' : 'Volume'}</h3>
            <p className="text-[10px] text-slate-500">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Are you sure you want to delete <span className="font-mono text-slate-200">{name}</span>?
          {type === 'volume' && (
            <span className="text-rose-400 block mt-1">All data stored in this volume will be permanently lost.</span>
          )}
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

function NetworkCard({ net, onInspect, onDelete }: {
  net: NetworkInfo
  onInspect: () => void
  onDelete: () => void
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
            {!isBuiltIn && (
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
  const [activeTab, setActiveTab] = useState<TabId>('networks')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [inspectNetwork, setInspectNetwork] = useState<NetworkInfo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'network' | 'volume'; name: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'driver' | 'containers'>('name')
  const [sortAsc, setSortAsc] = useState(true)

  const setNetworksStore = useNetworkStore((s) => s.setNetworks)
  const setVolumesStore = useNetworkStore((s) => s.setVolumes)
  const isConnected = useConnectionStore((s) => s.status) === 'connected'

  const {
    data: networksData,
    loading: networksLoading,
    refresh: refreshNetworks,
  } = usePolling<NetworkListResponse>(fetchNetworks, 30000, { enabled: isConnected })

  const {
    data: volumesData,
    loading: volumesLoading,
    refresh: refreshVolumes,
  } = usePolling<VolumeListResponse>(fetchVolumes, 30000, { enabled: isConnected })

  useEffect(() => {
    if (networksData) setNetworksStore(networksData.networks)
  }, [networksData, setNetworksStore])

  useEffect(() => {
    if (volumesData) setVolumesStore(volumesData.volumes)
  }, [volumesData, setVolumesStore])

  const networks: NetworkInfo[] = networksData?.networks ?? []
  const volumes: VolumeInfo[] = volumesData?.volumes ?? []
  const isLoading = activeTab === 'networks' ? networksLoading : volumesLoading

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

  // Filter & sort volumes
  const filteredVolumes = useMemo(() => {
    let list = [...volumes]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((v) => v.name.toLowerCase().includes(q))
    }
    list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [volumes, searchQuery])

  const userNetworks = networks.filter((n) => !BUILTIN_NETWORKS.includes(n.name))
  const totalContainers = networks.reduce((sum, n) => sum + n.containers.length, 0)
  const totalVolumeSize = volumes.reduce((sum, v) => sum + v.size_bytes, 0)

  function handleRefresh() {
    refreshNetworks()
    refreshVolumes()
  }

  const tabs: { id: TabId; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'networks', label: 'Networks', icon: Network, count: networksData?.total ?? networks.length },
    { id: 'volumes', label: 'Volumes', icon: HardDrive, count: volumesData?.total ?? volumes.length },
  ]

  return (
    <div className="space-y-6">
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
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          type={deleteTarget.type}
          name={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleRefresh}
        />
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Networks & Volumes</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Docker network topology and volume storage management
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'networks' && (
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
            onClick={handleRefresh}
            disabled={isLoading}
            className="
              flex items-center gap-2 rounded-lg px-3.5 py-2
              text-sm font-medium text-slate-300
              bg-white/5 border border-white/10
              hover:bg-white/10 hover:border-white/15
              disabled:opacity-50 transition-all duration-200
            "
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="glass-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Network size={14} className="text-cyan-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Total Networks</span>
          </div>
          <p className="text-2xl font-bold text-slate-100">{networks.length}</p>
        </div>
        <div className="glass-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Plus size={14} className="text-emerald-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">User Networks</span>
          </div>
          <p className="text-2xl font-bold text-slate-100">{userNetworks.length}</p>
        </div>
        <div className="glass-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Plug size={14} className="text-amber-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Connections</span>
          </div>
          <p className="text-2xl font-bold text-slate-100">{totalContainers}</p>
        </div>
        <div className="glass-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <HardDrive size={14} className="text-violet-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Volume Storage</span>
          </div>
          <p className="text-2xl font-bold text-slate-100">{formatBytes(totalVolumeSize)}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.03] backdrop-blur-lg rounded-xl p-1 border border-white/[0.06]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchQuery('') }}
              className={`
                flex items-center gap-2 flex-1 justify-center
                rounded-lg px-4 py-2.5 text-sm font-medium
                transition-all duration-200
                ${
                  isActive
                    ? 'bg-white/[0.08] text-slate-100 shadow-sm border border-white/[0.08]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                }
              `}
            >
              <Icon size={16} className={isActive ? 'text-emerald-400' : 'text-slate-500'} />
              {tab.label}
              <span
                className={`
                  ml-1 rounded-full px-2 py-0.5 text-xs font-medium
                  ${isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-slate-500'}
                `}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search + Sort bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full pl-9 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/15 transition-all"
          />
        </div>
        {activeTab === 'networks' && (
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
        )}
      </div>

      {/* Networks tab */}
      {activeTab === 'networks' && (
        <>
          {networksLoading && networks.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-slate-500" />
            </div>
          ) : filteredNetworks.length === 0 ? (
            <div className="glass-subtle rounded-xl p-12 text-center">
              <Network size={32} className="text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                {searchQuery ? 'No networks match your search' : 'No networks found'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredNetworks.map((net) => (
                <NetworkCard
                  key={net.id}
                  net={net}
                  onInspect={() => setInspectNetwork(net)}
                  onDelete={() => setDeleteTarget({ type: 'network', name: net.name })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Volumes tab */}
      {activeTab === 'volumes' && (
        <div className="glass-subtle rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <HardDrive size={16} className="text-cyan-400" />
              Docker Volumes
            </h3>
            <div className="flex items-center gap-1.5">
              <Info size={11} className="text-slate-600" />
              <span className="text-[10px] text-slate-600">
                {filteredVolumes.length} volume{filteredVolumes.length !== 1 ? 's' : ''} &middot; {formatBytes(totalVolumeSize)} total
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Mountpoint
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider w-16">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredVolumes.length === 0 && !volumesLoading && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                      {searchQuery ? 'No volumes match your search' : 'No volumes found'}
                    </td>
                  </tr>
                )}
                {volumesLoading && volumes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                      <Loader2 size={16} className="inline animate-spin mr-2" />
                      Loading volumes...
                    </td>
                  </tr>
                )}
                {filteredVolumes.map((vol) => (
                  <tr key={vol.name} className="group hover:bg-white/[0.03] transition-colors duration-150">
                    <td className="px-5 py-3 font-mono text-slate-200 text-xs">{vol.name}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-xs font-medium text-cyan-400">
                        {vol.driver}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs font-mono truncate max-w-[300px]" title={vol.mountpoint}>
                      {vol.mountpoint}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-300 text-xs font-mono">
                      {formatBytes(vol.size_bytes)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setDeleteTarget({ type: 'volume', name: vol.name })}
                        className="p-1.5 rounded-md text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete volume"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
