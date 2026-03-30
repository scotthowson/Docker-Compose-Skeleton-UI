import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { KeyRound, Plus, Trash2, Search, Shield, Eye, EyeOff, AlertTriangle, X, Loader2, RefreshCw, BookOpen, Lock, FileKey, Terminal, ChevronDown, ChevronRight } from 'lucide-react'
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
  const [showGuide, setShowGuide] = useState(false)
  const [guideSection, setGuideSection] = useState<number | null>(null)
  const isConnected = useConnectionStore((s) => s.status === 'connected')

  useEffect(() => { if (isConnected) fetchSecrets() }, [fetchSecrets, isConnected])

  // Close topmost modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (deleteTarget) { setDeleteTarget(null); return }
      if (showAddModal) { setShowAddModal(false); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [deleteTarget, showAddModal])

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
            <h1 className="text-xl font-bold tracking-tight"><span className="text-gradient">Secrets</span></h1>
            <p className="text-sm text-slate-400">Encrypted key-value secret storage</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchSecrets()} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-white/5 border border-white/5 hover:bg-white/10 disabled:opacity-50 transition-all"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /><span className="hidden sm:inline">Refresh</span></button>
          <button onClick={() => setShowGuide(!showGuide)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
            <BookOpen size={14} />
            <span className="hidden sm:inline">Usage Guide</span>
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all press">
            <Plus size={14} /> Add Secret
          </button>
        </div>
      </div>

      {/* Secrets Usage Guide (collapsible) */}
      {showGuide && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden animate-fade-in">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Secrets Manager Guide</h2>
            </div>
            <button onClick={() => setShowGuide(false)} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
              <X size={14} className="text-slate-400" />
            </button>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-slate-400 mb-4">
              Encrypted key-value storage using <code className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded text-xs">AES-256-CBC</code>.
              Values are encrypted at rest and <span className="text-amber-400 font-medium">write-only</span> — you can set or delete secrets, but never read them back.
            </p>

            {/* How it works */}
            <div className="border border-white/[0.03] rounded-lg overflow-hidden">
              <button
                onClick={() => setGuideSection(guideSection === 0 ? null : 0)}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
              >
                {guideSection === 0 ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                <Lock size={14} className="text-amber-400" />
                <span className="text-xs font-medium text-slate-200">How Encryption Works</span>
              </button>
              {guideSection === 0 && (
                <div className="px-4 pb-3 text-[11px] text-slate-400 space-y-1.5 border-t border-white/[0.03] pt-3 ml-8">
                  <p>Each secret is individually encrypted using <span className="text-slate-300">AES-256-CBC</span> with a server-generated master key.</p>
                  <p>The master key is stored at <code className="text-slate-500 bg-white/5 px-1 rounded font-mono text-[10px]">.secrets/.master-key</code> with <code className="text-slate-500 bg-white/5 px-1 rounded font-mono text-[10px]">chmod 700</code> permissions.</p>
                  <p>Encrypted values are stored as <code className="text-slate-500 bg-white/5 px-1 rounded font-mono text-[10px]">.enc</code> files in the <code className="text-slate-500 bg-white/5 px-1 rounded font-mono text-[10px]">.secrets/</code> directory.</p>
                </div>
              )}
            </div>

            {/* Common uses */}
            <div className="border border-white/[0.03] rounded-lg overflow-hidden">
              <button
                onClick={() => setGuideSection(guideSection === 1 ? null : 1)}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
              >
                {guideSection === 1 ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                <FileKey size={14} className="text-cyan-400" />
                <span className="text-xs font-medium text-slate-200">Common Uses</span>
              </button>
              {guideSection === 1 && (
                <div className="px-4 pb-3 text-[11px] text-slate-400 space-y-1.5 border-t border-white/[0.03] pt-3 ml-8">
                  <p>Store sensitive values that your containers need but shouldn't be in compose files or .env:</p>
                  <ul className="space-y-1 list-disc list-inside text-slate-500">
                    <li>API keys (Cloudflare, SendGrid, Stripe)</li>
                    <li>Database passwords (MySQL root, PostgreSQL admin)</li>
                    <li>OAuth client secrets</li>
                    <li>TLS certificate private keys</li>
                    <li>Webhook signing secrets</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Usage in compose */}
            <div className="border border-white/[0.03] rounded-lg overflow-hidden">
              <button
                onClick={() => setGuideSection(guideSection === 2 ? null : 2)}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
              >
                {guideSection === 2 ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                <Terminal size={14} className="text-emerald-400" />
                <span className="text-xs font-medium text-slate-200">Reference in Compose Files</span>
              </button>
              {guideSection === 2 && (
                <div className="px-4 pb-3 text-[11px] text-slate-400 space-y-2 border-t border-white/[0.03] pt-3 ml-8">
                  <p>Reference secrets in your compose environment variables:</p>
                  <div className="bg-slate-950/60 rounded-lg p-3 font-mono text-[10px] space-y-1 border border-white/5">
                    <p className="text-slate-500"># docker-compose.yml</p>
                    <p className="text-slate-400">services:</p>
                    <p className="text-slate-400">{'  '}my-app:</p>
                    <p className="text-slate-400">{'    '}environment:</p>
                    <p className="text-slate-300">{'      '}- DB_PASSWORD=<span className="text-amber-400">{'${SECRETS_DB_PASSWORD}'}</span></p>
                    <p className="text-slate-300">{'      '}- API_KEY=<span className="text-amber-400">{'${SECRETS_STRIPE_KEY}'}</span></p>
                  </div>
                  <p className="text-slate-500 mt-1">DCS decrypts these at start time and injects them as environment variables. The values never touch disk. You can also use dot syntax (<code className="text-amber-400/70">{'${SECRETS.KEY}'}</code>) — it auto-converts.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search secrets..." className="w-full pl-10 pr-9 py-2.5 rounded-lg glass text-sm text-white placeholder-slate-500 border border-white/5 focus:border-emerald-500/50 focus:outline-none" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {error && <div className="glass rounded-lg p-3 text-rose-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}

      {/* Secret Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="glass rounded-xl p-4 h-20 skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <KeyRound className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">{search ? 'No secrets match your search' : 'No secrets stored yet'}</p>
          <p className="text-sm text-slate-500 mt-1">Add your first secret to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filtered.map((key, i) => (
            <div key={key} className="glass rounded-xl p-4 flex items-center justify-between group hover:border-amber-500/20 border border-transparent transition-all animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-sm font-mono text-white truncate">{key}</span>
              </div>
              <button onClick={() => setDeleteTarget(key)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all" title="Delete secret" aria-label="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div className="glass rounded-2xl p-6 w-full max-w-md mx-4 border border-white/10 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Secret</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleAdd() }} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Key Name</label>
                <input value={newKey} onChange={e => { setNewKey(e.target.value); setKeyError('') }} placeholder="MY_SECRET_KEY" className="w-full px-3 py-2 rounded-lg glass text-sm text-white font-mono placeholder-slate-500 border border-white/5 focus:border-emerald-500/50 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Value</label>
                <div className="relative">
                  <textarea value={newValue} onChange={e => setNewValue(e.target.value)} rows={3} className={`w-full px-3 py-2 rounded-lg glass text-sm text-white font-mono placeholder-slate-500 border border-white/5 focus:border-emerald-500/50 focus:outline-none resize-none ${!showValue ? 'text-security-disc' : ''}`} style={!showValue ? { WebkitTextSecurity: 'disc' } as React.CSSProperties : undefined} placeholder="Enter secret value..." />
                  <button type="button" onClick={() => setShowValue(!showValue)} className="absolute right-2 top-2 p-1 rounded text-slate-500 hover:text-slate-300">
                    {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {keyError && <p className="text-sm text-rose-400">{keyError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 rounded-lg glass text-sm text-slate-300 hover:bg-white/5 transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* Delete Confirmation */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDeleteTarget(null)}>
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
        </div>,
        document.body,
      )}
    </div>
  )
}
