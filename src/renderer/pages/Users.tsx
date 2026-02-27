// =============================================================================
// Users — Admin user management page with invite codes and user listing
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Users as UsersIcon, UserPlus, Shield, ShieldCheck, ShieldX,
  Copy, Check, Trash2, Clock, Loader2, RefreshCw, Plus,
  AlertTriangle, KeyRound, Mail,
} from 'lucide-react'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import {
  authListUsers, authListInvites, authCreateInvite, authRevokeUser,
} from '../api/endpoints'
import type { ApiUser, InviteCode } from '../../shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  if (!dateStr) return '--'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return dateStr }
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const now = Date.now()
    const diff = now - d.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return formatDate(dateStr)
  } catch { return '' }
}

function isExpired(dateStr: string): boolean {
  if (!dateStr) return false
  try { return new Date(dateStr).getTime() < Date.now() } catch { return false }
}

// ---------------------------------------------------------------------------
// User Management Page
// ---------------------------------------------------------------------------

export default function Users() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { addToast } = useToast()

  const [users, setUsers] = useState<ApiUser[]>([])
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [newInviteRole, setNewInviteRole] = useState<'user' | 'admin'>('user')
  const [showConfirmRevoke, setShowConfirmRevoke] = useState<string | null>(null)

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, invitesRes] = await Promise.all([
        authListUsers(),
        authListInvites(),
      ])
      setUsers(usersRes.users ?? [])
      setInvites(invitesRes.invites ?? [])
    } catch {
      // Data may not be available if auth isn't configured
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isConnected) fetchData()
  }, [isConnected, fetchData])

  // Generate invite code
  const handleCreateInvite = useCallback(async () => {
    setInviteLoading(true)
    try {
      const result = await authCreateInvite(newInviteRole)
      if (result.success) {
        addToast({ type: 'success', message: `Invite code created! Role: ${newInviteRole}` })
        fetchData()
      } else {
        addToast({ type: 'error', message: 'Failed to create invite code' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast({ type: 'error', message: `Failed to create invite: ${msg}`, duration: 6000 })
    } finally {
      setInviteLoading(false)
    }
  }, [newInviteRole, addToast, fetchData])

  // Revoke user
  const handleRevokeUser = useCallback(async (username: string) => {
    setRevokeTarget(username)
    try {
      const result = await authRevokeUser(username)
      if (result.success) {
        addToast({ type: 'success', message: `User "${username}" has been revoked.` })
        fetchData()
      } else {
        addToast({ type: 'error', message: result.message || 'Failed to revoke user' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast({ type: 'error', message: `Failed to revoke: ${msg}`, duration: 6000 })
    } finally {
      setRevokeTarget(null)
      setShowConfirmRevoke(null)
    }
  }, [addToast, fetchData])

  // Copy invite code to clipboard
  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code)
      addToast({ type: 'info', message: 'Invite code copied to clipboard!' })
      setTimeout(() => setCopiedCode(null), 2000)
    })
  }, [addToast])

  // Disconnected state
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24">
        <Loader2 className="w-8 h-8 text-slate-600 animate-spin mb-4" />
        <p className="text-sm text-slate-500">Waiting for server connection...</p>
      </div>
    )
  }

  const activeInvites = invites.filter((i) => !i.used && !isExpired(i.expires_at))
  const usedInvites = invites.filter((i) => i.used)

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-2xl font-bold tracking-tight">
            <span className="text-gradient">User Management</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage registered users and invite codes
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={<UsersIcon className="h-5 w-5 text-emerald-400" />}
          label="Registered Users"
          value={users.length}
          color="emerald"
        />
        <SummaryCard
          icon={<KeyRound className="h-5 w-5 text-cyan-400" />}
          label="Active Invites"
          value={activeInvites.length}
          color="cyan"
        />
        <SummaryCard
          icon={<ShieldCheck className="h-5 w-5 text-amber-400" />}
          label="Admin Users"
          value={users.filter((u) => u.role === 'admin').length}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
        {/* ---- Users List ---- */}
        <div className="glass-card p-4 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Registered Users
              </h2>
              <span className="text-xs text-slate-600">({users.length})</span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-slate-600 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-600">
              <UsersIcon className="h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm">No users registered yet</p>
              <p className="text-xs text-slate-600 mt-1">Create an invite code to get started</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
              {users.map((user) => (
                <div
                  key={user.username}
                  className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/[0.04] px-4 py-3 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                      ${user.role === 'admin'
                        ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400 ring-1 ring-amber-500/20'
                        : 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400 ring-1 ring-emerald-500/20'
                      }
                    `}>
                      {user.username[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{user.username}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`
                          inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                          ${user.role === 'admin'
                            ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                          }
                        `}>
                          {user.role === 'admin' ? <Shield className="h-2.5 w-2.5" /> : <ShieldCheck className="h-2.5 w-2.5" />}
                          {user.role}
                        </span>
                        <span className="text-[10px] text-slate-600 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {timeAgo(user.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Revoke button */}
                  {showConfirmRevoke === user.username ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRevokeUser(user.username)}
                        disabled={revokeTarget === user.username}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/20 hover:bg-rose-500/25 transition-all disabled:opacity-50"
                      >
                        {revokeTarget === user.username ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setShowConfirmRevoke(null)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowConfirmRevoke(user.username)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                      title="Revoke access"
                    >
                      <ShieldX className="h-3 w-3" />
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---- Invite Codes ---- */}
        <div className="glass-card p-4 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Invite Codes
              </h2>
            </div>
          </div>

          {/* Create invite form */}
          <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="flex-1 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-cyan-400 flex-shrink-0" />
              <span className="text-xs text-slate-400">Generate new invite as:</span>
              <select
                value={newInviteRole}
                onChange={(e) => setNewInviteRole(e.target.value as 'user' | 'admin')}
                className="px-2 py-1 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-slate-300 focus:outline-none focus:border-cyan-500/30"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              onClick={handleCreateInvite}
              disabled={inviteLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 transition-all disabled:opacity-50"
            >
              {inviteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Generate
            </button>
          </div>

          {/* Active invites */}
          {activeInvites.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">
                Active ({activeInvites.length})
              </p>
              <div className="space-y-2">
                {activeInvites.map((invite) => (
                  <InviteCard
                    key={invite.code}
                    invite={invite}
                    copiedCode={copiedCode}
                    onCopy={handleCopyCode}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Used invites */}
          {usedInvites.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">
                Used ({usedInvites.length})
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
                {usedInvites.map((invite) => (
                  <div
                    key={invite.code}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.01] border border-white/[0.03] opacity-70"
                  >
                    <div className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-emerald-400" />
                      <code className="text-[11px] font-mono text-slate-500">{invite.code.slice(0, 8)}...</code>
                      <span className={`
                        px-1.5 py-0.5 rounded-full text-[9px] font-semibold
                        ${invite.role === 'admin' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}
                      `}>
                        {invite.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {invite.used_by && (
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <UsersIcon className="h-2.5 w-2.5" />
                          {invite.used_by}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invites.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-600">
              <KeyRound className="h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm">No invite codes yet</p>
              <p className="text-xs text-slate-600 mt-1">Generate an invite to allow new user registration</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function SummaryCard({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  const glowMap: Record<string, string> = {
    emerald: 'glow-emerald',
    cyan: 'glow-cyan',
    amber: 'glow-amber',
  }
  return (
    <div className={`glass-card p-5 flex items-center gap-4 ${glowMap[color] ?? ''}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  )
}

function InviteCard({ invite, copiedCode, onCopy }: {
  invite: InviteCode
  copiedCode: string | null
  onCopy: (code: string) => void
}) {
  const expired = isExpired(invite.expires_at)

  return (
    <div className={`
      flex items-center justify-between rounded-lg px-4 py-3 border transition-colors
      ${expired
        ? 'bg-rose-500/5 border-rose-500/10'
        : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]'
      }
    `}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <code className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded">
          {invite.code}
        </code>
        <span className={`
          px-2 py-0.5 rounded-full text-[10px] font-semibold
          ${invite.role === 'admin'
            ? 'bg-amber-500/10 text-amber-400'
            : 'bg-emerald-500/10 text-emerald-400'
          }
        `}>
          {invite.role}
        </span>
        {expired && (
          <span className="flex items-center gap-1 text-[10px] text-rose-400">
            <AlertTriangle className="h-2.5 w-2.5" />
            Expired
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-600 flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {formatDate(invite.expires_at)}
        </span>
        <button
          onClick={() => onCopy(invite.code)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all"
          title="Copy invite code"
        >
          {copiedCode === invite.code
            ? <Check className="h-3.5 w-3.5 text-emerald-400" />
            : <Copy className="h-3.5 w-3.5" />
          }
        </button>
      </div>
    </div>
  )
}
