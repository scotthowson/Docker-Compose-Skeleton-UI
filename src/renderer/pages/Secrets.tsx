import React, { useState, useEffect, useCallback } from 'react'
import { KeyRound, Plus, Trash2, Search, Shield, Eye, EyeOff, AlertTriangle, X, Loader2, RefreshCw } from 'lucide-react'
import { useSecretsStore } from '../stores/secretsStore'
import { useConnectionStore } from '../stores/connectionStore'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'

export default function Secrets() {
  const { keys, loading, saving, error, fetchSecrets, setSecret, deleteSecret } = useSecretsStore()
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [showValue, setShowValue] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [keyError, setKeyError] = useState('')
  const isConnected = useConnectionStore((s) => s.status === 'connected')

  useEffect(() => { if (isConnected) fetchSecrets() }, [fetchSecrets, isConnected])

  const filtered = keys.filter(k => k.toLowerCase().includes(search.toLowerCase()))

  const validateKey = (k: string) => /^[a-zA-Z0-9_-]+$/.test(k)

  const handleAdd = useCallback(async () => {
    if (!validateKey(newKey)) { setKeyError('Only alphanumeric, dashes, and underscores'); return }
    if (!newValue) { setKeyError('Value is required'); return }
    const ok = await setSecret(newKey, newValue)
    if (ok) { setShowAddModal(false); setNewKey(''); setNewValue(''); setKeyError('') }
  }, [newKey, newValue, setSecret])

  const handleDelete = useCallback(async (key: string) => {
    await deleteSecret(key)
    setDeleteTarget(null)
  }, [deleteSecret])

  return (
    <div className="space-y-6 animate-fade-in">
      <DisconnectedBanner />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Secrets</h1>
            <p className="text-sm text-slate-400">Encrypted key-value secret storage</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchSecrets()} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition-all"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /><span className="hidden sm:inline">Refresh</span></button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors">
            <Plus className="w-4 h-4" /> Add Secret
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="glass-subtle rounded-xl p-4 flex items-start gap-3 border border-amber-500/20">
        <Shield className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-300">Secret values are encrypted at rest using AES-256-CBC and are never transmitted after being stored. You can only overwrite or delete secrets — not read them back.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search secrets..." className="w-full pl-10 pr-4 py-2.5 rounded-lg glass text-sm text-white placeholder-slate-500 border border-white/5 focus:border-amber-500/30 focus:outline-none" />
      </div>

      {error && <div className="glass-subtle rounded-lg p-3 text-rose-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}

      {/* Secret Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="glass rounded-xl p-4 h-20 skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <KeyRound className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">{search ? 'No secrets match your search' : 'No secrets stored yet'}</p>
          <p className="text-sm text-slate-500 mt-1">Add your first secret to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((key, i) => (
            <div key={key} className="glass rounded-xl p-4 flex items-center justify-between group hover:border-amber-500/20 border border-transparent transition-all" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-sm font-mono text-white truncate">{key}</span>
              </div>
              <button onClick={() => setDeleteTarget(key)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div className="glass rounded-2xl p-6 w-full max-w-md mx-4 border border-white/10 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Secret</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Key Name</label>
                <input value={newKey} onChange={e => { setNewKey(e.target.value); setKeyError('') }} placeholder="MY_SECRET_KEY" className="w-full px-3 py-2 rounded-lg glass text-sm text-white font-mono placeholder-slate-500 border border-white/5 focus:border-amber-500/30 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Value</label>
                <div className="relative">
                  <textarea value={newValue} onChange={e => setNewValue(e.target.value)} rows={3} className={`w-full px-3 py-2 rounded-lg glass text-sm text-white font-mono placeholder-slate-500 border border-white/5 focus:border-amber-500/30 focus:outline-none resize-none ${!showValue ? 'text-security-disc' : ''}`} style={!showValue ? { WebkitTextSecurity: 'disc' } as React.CSSProperties : undefined} placeholder="Enter secret value..." />
                  <button onClick={() => setShowValue(!showValue)} className="absolute right-2 top-2 p-1 rounded text-slate-500 hover:text-slate-300">
                    {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {keyError && <p className="text-sm text-rose-400">{keyError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 rounded-lg glass text-sm text-slate-300 hover:bg-white/5 transition-colors">Cancel</button>
                <button onClick={handleAdd} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDeleteTarget(null)}>
          <div className="glass rounded-2xl p-6 w-full max-w-sm mx-4 border border-rose-500/20 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-rose-400" /></div>
              <div>
                <h3 className="text-white font-semibold">Delete Secret</h3>
                <p className="text-sm text-slate-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-4">Are you sure you want to delete <span className="font-mono text-white">{deleteTarget}</span>?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 rounded-lg glass text-sm text-slate-300 hover:bg-white/5">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-sm font-medium disabled:opacity-50">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
