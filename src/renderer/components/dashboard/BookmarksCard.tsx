// =============================================================================
// BookmarksCard — the Bookmarks page's saved items as tiles
// =============================================================================

import React, { useEffect, useState } from 'react'
import * as Icons from 'lucide-react'
import { Bookmark, ExternalLink } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import type { PageId } from '../../../shared/types'
import { CardHeader, CardEmpty, ACCENTS } from './cardShared'

interface BookmarkItem {
  id: string
  type: 'page' | 'stack' | 'container' | 'custom'
  label: string
  target: string
  color: string
  icon: string
  notes?: string
}

function load(): BookmarkItem[] {
  try {
    const raw = localStorage.getItem('user-bookmarks')
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((b) => b && typeof b.label === 'string') : []
  } catch { return [] }
}

/** The Bookmarks page stores colours as class names ("text-emerald-400"); map them back to an accent */
function accentOf(color: string): typeof ACCENTS[string] {
  const m = /-(emerald|cyan|violet|amber|rose|blue|teal|orange|pink|slate)-/.exec(color || '')
  return ACCENTS[m?.[1] ?? 'cyan']
}

export default function BookmarksCard() {
  const [items, setItems] = useState<BookmarkItem[]>(load)
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  useEffect(() => {
    const refresh = () => setItems(load())
    window.addEventListener('storage', refresh)
    window.addEventListener('bookmarks-changed', refresh)
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('bookmarks-changed', refresh) }
  }, [])

  const open = (b: BookmarkItem) => {
    if (b.type === 'page') setCurrentPage(b.target as PageId)
    else if (b.type === 'stack') setCurrentPage('stacks', { highlight: b.target })
    else if (b.type === 'container') setCurrentPage('containers', { focusContainer: b.target })
    else if (/^https?:\/\//i.test(b.target)) window.open(b.target, '_blank', 'noopener')
  }

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      <CardHeader
        icon={<Bookmark size={15} />}
        title="Bookmarks"
        count={items.length || undefined}
        right={<button onClick={() => setCurrentPage('bookmarks')} className="text-[10px] text-slate-500 hover:text-slate-200 transition-colors">Manage</button>}
      />
      {items.length === 0 ? (
        <CardEmpty icon={<Bookmark size={22} />} title="No bookmarks yet" hint="Save pages, stacks, containers and links on the Bookmarks page." action={<button onClick={() => setCurrentPage('bookmarks')} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">Open Bookmarks</button>} />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin -mx-1 px-1 grid grid-cols-2 gap-1.5 content-start">
          {items.map((b) => {
            const acc = accentOf(b.color)
            const Icon = ((Icons as unknown as Record<string, React.ElementType>)[b.icon] ?? Bookmark) as React.ElementType
            return (
              <button key={b.id} onClick={() => open(b)} className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 border ${acc.ring} bg-white/[0.02] hover:bg-white/[0.05] text-left transition-colors`} title={b.notes || b.target}>
                <span className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${acc.bg} ${acc.text}`}><Icon size={14} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-medium text-slate-200 truncate">{b.label}</span>
                  <span className="block text-[10px] text-slate-500 truncate">{b.type === 'custom' ? b.target.replace(/^https?:\/\//, '') : b.type}</span>
                </span>
                {b.type === 'custom' && <ExternalLink size={11} className="text-slate-600 group-hover:text-cyan-400 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
