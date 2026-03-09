import React, { useState, useRef, useEffect } from 'react'
import { Server, Plus, ChevronDown, Check, Trash2, Wifi, WifiOff, Globe, X, Loader2 } from 'lucide-react'
import { useServerStore } from '../../stores/serverStore'
import { useConnectionStore } from '../../stores/connectionStore'

export function ServerSwitcher() {
  const { servers, activeServerId, loading, loadServers, addServer, removeServer, switchServer } = useServerStore()
  const { status } = useConnectionStore()
  const [open, setOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadServers() }, [loadServers])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const active = servers.find(s => s.id === activeServerId)
  const statusDot = status === 'connected' ? 'bg-emerald-400' : status === 'error' ? 'bg-rose-400' : 'bg-slate-500'

  const handleAdd = async () => {
    if (!newName || !newUrl) return
    const s = addServer({ name: newName, url: newUrl })
    await switchServer(s.id)
    setShowAdd(false); setNewName(''); setNewUrl('')
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger */}
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group">
        <div className="relative">
          <Server className="w-4 h-4 text-slate-400" />
          <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${statusDot} ring-2 ring-slate-900`} />
        </div>
        <span className="text-sm text-slate-300 truncate flex-1 text-left">{active?.name || 'No server'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 glass rounded-xl border border-white/10 shadow-2xl z-50 overflow-hidden animate-scale-in origin-top">
          <div className="p-1 max-h-64 overflow-y-auto">
            {servers.map(s => (
              <div key={s.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group ${s.id === activeServerId ? 'bg-white/5' : 'hover:bg-white/5'}`}>
                <button onClick={() => { switchServer(s.id); setOpen(false) }} className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="relative shrink-0">
                    <Globe className="w-4 h-4 text-slate-500" />
                    {s.id === activeServerId && <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${statusDot} ring-2 ring-slate-900`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{s.name}</div>
                    <div className="text-xs text-slate-500 truncate">{s.url}</div>
                  </div>
                  {s.id === activeServerId && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
                {servers.length > 1 && s.id !== activeServerId && (
                  <button onClick={(e) => { e.stopPropagation(); removeServer(s.id) }} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Server */}
          <div className="border-t border-white/5 p-1">
            {showAdd ? (
              <div className="p-2 space-y-2">
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Server name" className="w-full px-2.5 py-1.5 rounded-lg bg-black/30 text-sm text-white placeholder-slate-500 border border-white/5 focus:border-cyan-500/30 focus:outline-none" />
                <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="http://192.168.1.100:9876" className="w-full px-2.5 py-1.5 rounded-lg bg-black/30 text-sm text-white font-mono placeholder-slate-500 border border-white/5 focus:border-cyan-500/30 focus:outline-none" />
                <div className="flex gap-2">
                  <button onClick={() => setShowAdd(false)} className="flex-1 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-white/5">Cancel</button>
                  <button onClick={handleAdd} disabled={loading || !newName || !newUrl} className="flex-1 px-2 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs hover:bg-cyan-500/30 disabled:opacity-50 flex items-center justify-center gap-1">
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition-colors">
                <Plus className="w-4 h-4" /> Add Server
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
