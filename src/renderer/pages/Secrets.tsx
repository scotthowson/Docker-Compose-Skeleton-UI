import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  KeyRound, Plus, Trash2, Search, Shield, Eye, EyeOff, AlertTriangle, X, Loader2, RefreshCw,
  BookOpen, Lock, FileKey, Terminal, ChevronDown, ChevronRight, Wand2, Copy, Check, Link2, Layers,
} from 'lucide-react'
import { useSecretsStore } from '../stores/secretsStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { fetchSecretReferences } from '../api/endpoints'
import type { SecretReferencesResponse } from '../../shared/types'

// Same rule as the server (.lib/secrets.sh): a compose-safe variable name.
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/
const GENERATED_LENGTH = 32
const GENERATED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/** Random value that is safe inside compose files and .env (no quotes, $, spaces) */
function generateSecret(length = GENERATED_LENGTH): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => GENERATED_ALPHABET[b % GENERATED_ALPHABET.length]).join('')
}

function referenceFor(name: string): string {
  return `\${SECRETS_${name}}`
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

const GUIDE_SECTIONS = [
  {
    icon: Lock,
    color: 'text-amber-400',
    title: 'How it works',
    body: (
      <>
        <p>Each value is encrypted on the server with <span className="text-slate-300">AES-256-CBC</span> and a 256-bit master key stored at <code className="text-slate-500 bg-white/5 px-1 rounded font-mono text-[10px]">.secrets/.master-key</code> (mode 600). Values are write-only: you can replace or delete a secret, never read it back from the UI.</p>
        <p>The same store is used by the API, <code className="text-slate-500 bg-white/5 px-1 rounded font-mono text-[10px]">start.sh</code>, the stack manager and scheduled tasks, so a stack behaves the same however it is started.</p>
        <p>Back up <code className="text-slate-500 bg-white/5 px-1 rounded font-mono text-[10px]">.master-key</code> separately: backups and snapshots carry only the encrypted files.</p>
      </>
    ),
  },
  {
    icon: Terminal,
    color: 'text-emerald-400',
    title: 'Reference a secret',
    body: (
      <>
        <p>Use the placeholder shown on each card, <span className="text-amber-400 font-mono">{'${SECRETS_NAME}'}</span>, in a compose file or in a stack&apos;s <code className="text-slate-500 bg-white/5 px-1 rounded font-mono text-[10px]">.env</code>:</p>
        <div className="bg-slate-950/60 rounded-lg p-3 font-mono text-[10px] space-y-1 border border-white/5">
          <p className="text-slate-500"># docker-compose.yml</p>
          <p className="text-slate-400">services:</p>
          <p className="text-slate-400">{'  '}homarr:</p>
          <p className="text-slate-400">{'    '}environment:</p>
          <p className="text-slate-300">{'      '}- DB_PASSWORD=<span className="text-amber-400">{'${SECRETS_HOMARR_PASSWORD}'}</span></p>
          <p className="text-slate-500 pt-1"># Stacks/web-applications/.env</p>
          <p className="text-slate-300">API_KEY=<span className="text-amber-400">{'${SECRETS_STRIPE_KEY}'}</span></p>
        </div>
        <p>Names are letters, digits and underscores (UPPER_SNAKE is easiest to read) and must match exactly.</p>
      </>
    ),
  },
  {
    icon: FileKey,
    color: 'text-cyan-400',
    title: 'What happens at start',
    body: (
      <>
        <p>When a stack starts, DCS decrypts every referenced secret into the environment of the <span className="text-slate-300">docker compose</span> process only. The compose file and .env keep the placeholder.</p>
        <p>If a referenced secret does not exist the stack is <span className="text-rose-400">not started</span> and the missing names are reported, instead of running a service with an empty password.</p>
        <p>After changing a value, restart the stacks that use it: the card&apos;s <span className="text-slate-300">References</span> shows which ones.</p>
      </>
    ),
  },
]

export default function Secrets() {
  const { entries, keys, loading, saving, error, fetchSecrets, setSecret, deleteSecret } = useSecretsStore()
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const { addToast } = useToast()

  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [showValue, setShowValue] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [keyError, setKeyError] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [guideSection, setGuideSection] = useState<number | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [refsFor, setRefsFor] = useState<string | null>(null)
  const [refs, setRefs] = useState<Record<string, SecretReferencesResponse | 'loading' | 'error'>>({})

  useEffect(() => { if (isConnected) fetchSecrets() }, [fetchSecrets, isConnected])

  // Close the topmost modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (deleteTarget) { setDeleteTarget(null); return }
      if (showAddModal) { closeAdd(); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteTarget, showAddModal])

  const filtered = useMemo(
    () => entries.filter((e) => e.key.toLowerCase().includes(search.toLowerCase())),
    [entries, search],
  )

  const trimmedKey = newKey.trim()
  const keyValid = NAME_RE.test(trimmedKey)
  const keyExists = keys.includes(trimmedKey)

  const closeAdd = () => {
    setShowAddModal(false)
    setNewKey(''); setNewValue(''); setKeyError(''); setShowValue(false); setConfirmReplace(false)
  }

  const handleGenerate = () => {
    setNewValue(generateSecret())
    setShowValue(true)
  }

  const handleAdd = useCallback(async () => {
    if (!keyValid) {
      setKeyError('Use letters, digits and underscores, starting with a letter — e.g. HOMARR_PASSWORD')
      return
    }
    if (!newValue) { setKeyError('Value is required'); return }
    if (keyExists && !confirmReplace) { setConfirmReplace(true); return }
    const result = await setSecret(trimmedKey, newValue)
    if (result) {
      addToast({
        type: 'success',
        message: `${result.replaced ? 'Replaced' : 'Stored'} ${trimmedKey}. Reference it as ${result.reference}${result.replaced ? ' and restart stacks that use it.' : '.'}`,
      })
      setRefs((prev) => { const next = { ...prev }; delete next[trimmedKey]; return next })
      closeAdd()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyValid, keyExists, confirmReplace, newValue, trimmedKey, setSecret, addToast])

  const handleDelete = useCallback(async (key: string) => {
    const ok = await deleteSecret(key)
    if (ok) addToast({ type: 'success', message: `Deleted ${key}` })
    setDeleteTarget(null)
  }, [deleteSecret, addToast])

  const copyReference = async (key: string) => {
    try {
      await navigator.clipboard.writeText(referenceFor(key))
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
    } catch {
      addToast({ type: 'error', message: 'Clipboard is not available' })
    }
  }

  const toggleReferences = async (key: string) => {
    if (refsFor === key) { setRefsFor(null); return }
    setRefsFor(key)
    if (refs[key] && refs[key] !== 'error') return
    setRefs((prev) => ({ ...prev, [key]: 'loading' }))
    try {
      const r = await fetchSecretReferences(key)
      setRefs((prev) => ({ ...prev, [key]: r }))
    } catch {
      setRefs((prev) => ({ ...prev, [key]: 'error' }))
    }
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg glass text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500/40'

  return (
    <div className="space-y-6 animate-fade-in">
      <DisconnectedBanner />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight"><span className="text-gradient">Secrets</span></h1>
            <p className="text-sm text-slate-400">
              {entries.length > 0 ? `${entries.length} encrypted value${entries.length === 1 ? '' : 's'} · injected into stacks at start` : 'Encrypted key-value storage for stacks'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchSecrets()} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-white/5 border border-white/5 hover:bg-white/10 transition-colors disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={() => setShowGuide(!showGuide)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${showGuide ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'text-slate-300 bg-white/5 border-white/5 hover:bg-white/10'}`}>
            <BookOpen size={14} />
            <span className="hidden sm:inline">Usage Guide</span>
          </button>
          {isAdmin && (
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors">
              <Plus size={14} /> Add Secret
            </button>
          )}
        </div>
      </div>

      {/* Guide */}
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
            <p className="text-sm text-slate-400">
              Store passwords, API keys and tokens once, reference them as <span className="text-amber-400 font-mono text-xs">{'${SECRETS_NAME}'}</span> anywhere, and let DCS inject them when a stack starts. Only admins can manage secrets.
            </p>
            {GUIDE_SECTIONS.map((section, i) => {
              const Icon = section.icon
              const open = guideSection === i
              return (
                <div key={section.title} className="border border-white/[0.03] rounded-lg overflow-hidden">
                  <button onClick={() => setGuideSection(open ? null : i)} className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors">
                    {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                    <Icon size={14} className={section.color} />
                    <span className="text-xs font-medium text-slate-200">{section.title}</span>
                  </button>
                  {open && (
                    <div className="px-4 pb-3 text-[11px] text-slate-400 space-y-2 border-t border-white/[0.03] pt-3 ml-8 animate-fade-in">
                      {section.body}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search secrets..." className="w-full pl-10 pr-9 py-2.5 rounded-lg glass text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/30" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {error && <div className="glass rounded-lg p-3 text-rose-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}

      {/* Cards */}
      {loading && entries.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="glass rounded-xl p-4 h-24 skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <KeyRound className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">{search ? 'No secrets match your search' : 'No secrets stored yet'}</p>
          <p className="text-sm text-slate-500 mt-1">{isAdmin ? 'Add a secret, then reference it as ${SECRETS_NAME} in a compose file or .env' : 'An admin can add secrets here'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filtered.map((entry) => {
            const r = refs[entry.key]
            const open = refsFor === entry.key
            return (
              <div key={entry.key} className="glass rounded-xl p-4 group hover:border-amber-500/20 border border-transparent transition-all animate-fade-in">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-mono text-white truncate">{entry.key}</p>
                      <p className="text-[10px] text-slate-500 truncate">{entry.modified ? `Updated ${formatDate(entry.modified)}` : 'Encrypted'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => copyReference(entry.key)} title="Copy the placeholder for compose and .env files" className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                      {copied === entry.key ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button onClick={() => toggleReferences(entry.key)} title="Where is this secret used?" className={`p-1.5 rounded-lg transition-all ${open ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10'}`}>
                      <Link2 className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button onClick={() => setDeleteTarget(entry.key)} title="Delete" className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-[10px] font-mono text-slate-500 truncate">{referenceFor(entry.key)}</p>
                {open && (
                  <div className="mt-2 pt-2 border-t border-white/5 text-[11px] animate-fade-in">
                    {r === 'loading' || !r ? (
                      <p className="text-slate-500 flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Looking for references…</p>
                    ) : r === 'error' ? (
                      <p className="text-rose-400">Could not load references</p>
                    ) : r.stacks.length === 0 && !r.root_env ? (
                      <p className="text-slate-500">Not referenced yet. Add <span className="font-mono text-amber-400">{r.reference}</span> to a compose file or .env.</p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-slate-400 flex items-center gap-1.5"><Layers size={11} className="text-cyan-400" /> Used by</p>
                        <div className="flex flex-wrap gap-1">
                          {r.stacks.map((s) => (
                            <span key={s} className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono text-[10px]">{s}</span>
                          ))}
                          {r.root_env && <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-300 font-mono text-[10px]">root .env</span>}
                        </div>
                        <p className="text-slate-500">Restart these stacks after changing the value.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={closeAdd}>
          <div className="glass rounded-2xl p-6 w-full max-w-md mx-4 border border-white/10 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Secret</h2>
              <button onClick={closeAdd} className="p-1 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleAdd() }} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Name</label>
                <input
                  value={newKey}
                  onChange={(e) => { setNewKey(e.target.value.replace(/[\s-]+/g, '_')); setKeyError(''); setConfirmReplace(false) }}
                  placeholder="HOMARR_PASSWORD"
                  autoFocus
                  spellCheck={false}
                  className={`${inputClass} ${trimmedKey && !keyValid ? 'border-rose-500/40' : ''}`}
                />
                <p className="text-[10px] text-slate-500 mt-1 font-mono truncate">
                  {trimmedKey ? (keyValid ? `Reference: ${referenceFor(trimmedKey)}` : 'Letters, digits and underscores only, starting with a letter') : 'Letters, digits and underscores — UPPER_SNAKE reads best'}
                </p>
                {keyExists && <p className="text-[10px] text-amber-400 mt-1">A secret with this name exists; saving replaces its value.</p>}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-slate-400">Value</label>
                  <button type="button" onClick={handleGenerate} className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
                    <Wand2 size={12} /> Generate {GENERATED_LENGTH}-character value
                  </button>
                </div>
                <div className="relative">
                  <textarea
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    rows={3}
                    spellCheck={false}
                    className={`${inputClass} pr-10 resize-none ${showValue ? '' : 'text-security-disc'}`}
                    style={showValue ? undefined : ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)}
                  />
                  <button type="button" onClick={() => setShowValue(!showValue)} className="absolute right-2 top-2 p-1 rounded text-slate-500 hover:text-slate-300" title={showValue ? 'Hide' : 'Show'}>
                    {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Stored encrypted; never shown again after saving.</p>
              </div>
              {keyError && <p className="text-sm text-rose-400">{keyError}</p>}
              {confirmReplace && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  Replace the existing value of <span className="font-mono">{trimmedKey}</span>? Stacks that use it keep the old value until they are restarted.
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeAdd} className="flex-1 px-4 py-2 rounded-lg glass text-sm text-slate-300 hover:bg-white/5 transition-colors">Cancel</button>
                <button type="submit" disabled={saving || !trimmedKey || !newValue} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${confirmReplace ? 'bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/25' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25'}`}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {confirmReplace ? 'Replace' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* Delete confirmation */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDeleteTarget(null)}>
          <div className="glass rounded-2xl p-6 w-full max-w-sm mx-4 border border-rose-500/20 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-rose-400" /></div>
              <div>
                <h3 className="text-white font-semibold">Delete Secret</h3>
                <p className="text-sm text-slate-400">Stacks that reference it will refuse to start</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-4">Delete <span className="font-mono text-white">{deleteTarget}</span>? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 rounded-lg glass text-sm text-slate-300 hover:bg-white/5">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
