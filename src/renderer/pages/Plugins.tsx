import React, { useState, useEffect, useCallback } from 'react'
import { Puzzle, Plus, Trash2, ToggleLeft, ToggleRight, GitBranch, LayoutTemplate, Zap, Package, X, Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'
import { usePluginStore } from '../stores/pluginStore'
import { useConnectionStore } from '../stores/connectionStore'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'

export default function Plugins() {
  const { plugins, loading, installing, error, fetchPlugins, installPlugin, removePlugin, togglePlugin } = usePluginStore()
  const [showInstall, setShowInstall] = useState(false)
  const [gitUrl, setGitUrl] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const isConnected = useConnectionStore((s) => s.status === 'connected')

  useEffect(() => { if (isConnected) fetchPlugins() }, [fetchPlugins, isConnected])

  const handleInstall = useCallback(async () => {
    if (!gitUrl) return
    const ok = await installPlugin(gitUrl)
    if (ok) { setShowInstall(false); setGitUrl('') }
  }, [gitUrl, installPlugin])

  return (
    <div className="space-y-6 animate-fade-in">
      <DisconnectedBanner />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center"><Puzzle className="w-5 h-5 text-cyan-400" /></div>
          <div><h1 className="text-xl font-bold text-white">Plugins</h1><p className="text-sm text-slate-400">Extend DCS with custom templates and hooks</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchPlugins()} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition-all"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /><span className="hidden sm:inline">Refresh</span></button>
          <button onClick={() => setShowInstall(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"><Plus className="w-4 h-4" /> Install Plugin</button>
        </div>
      </div>

      {error && <div className="glass-subtle rounded-lg p-3 text-rose-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2].map(i => <div key={i} className="glass rounded-xl p-5 h-36 skeleton" />)}</div>
      ) : plugins.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No plugins installed</p>
          <p className="text-sm text-slate-500 mt-1">Install plugins from git repositories to add custom templates and hooks</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plugins.map((p, i) => (
            <div key={p.name} className="glass rounded-xl p-5 border border-transparent hover:border-cyan-500/20 transition-all" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${p.enabled ? 'bg-cyan-500/20' : 'bg-slate-700/50'}`}>
                    <Puzzle className={`w-4 h-4 ${p.enabled ? 'text-cyan-400' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{p.name}</span>
                      <span className="text-xs text-slate-500">v{p.version}</span>
                    </div>
                    {p.author && <span className="text-xs text-slate-500">{p.author}</span>}
                  </div>
                </div>
                <button onClick={() => togglePlugin(p.name)} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
                  {p.enabled ? <ToggleRight className="w-6 h-6 text-emerald-400" /> : <ToggleLeft className="w-6 h-6 text-slate-500" />}
                </button>
              </div>
              {p.description && <p className="text-sm text-slate-400 mb-3">{p.description}</p>}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><LayoutTemplate className="w-3 h-3" />{p.templates.length} templates</span>
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{p.hooks.length} hooks</span>
                <div className="flex-1" />
                <button onClick={() => setDeleteTarget(p.name)} className="p-1 rounded text-slate-600 hover:text-rose-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Install Modal */}
      {showInstall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowInstall(false)}>
          <div className="glass rounded-2xl p-6 w-full max-w-md mx-4 border border-white/10 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Install Plugin</h2>
              <button onClick={() => setShowInstall(false)} className="p-1 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Git Repository URL</label>
                <div className="relative"><GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input value={gitUrl} onChange={e => setGitUrl(e.target.value)} placeholder="https://github.com/user/plugin.git" className="w-full pl-10 pr-4 py-2 rounded-lg glass text-sm text-white placeholder-slate-500 border border-white/5 focus:border-cyan-500/30 focus:outline-none" /></div>
              </div>
              <p className="text-xs text-slate-500">The repository must contain a <code className="text-cyan-400">plugin.json</code> manifest at the root.</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowInstall(false)} className="flex-1 px-4 py-2 rounded-lg glass text-sm text-slate-300 hover:bg-white/5">Cancel</button>
                <button onClick={handleInstall} disabled={installing || !gitUrl} className="flex-1 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">{installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Install</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDeleteTarget(null)}>
          <div className="glass rounded-2xl p-6 w-full max-w-sm mx-4 border border-rose-500/20 animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-2">Remove Plugin</h3>
            <p className="text-sm text-slate-400 mb-4">Remove <span className="text-white">{deleteTarget}</span> and all its templates and hooks?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 rounded-lg glass text-sm text-slate-300 hover:bg-white/5">Cancel</button>
              <button onClick={async () => { await removePlugin(deleteTarget); setDeleteTarget(null) }} className="flex-1 px-4 py-2 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-sm font-medium">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
