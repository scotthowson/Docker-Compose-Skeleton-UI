// =============================================================================
// Bookmarks — Pin favorite stacks, containers, pages for quick access
// =============================================================================

import React, { useState, useCallback, useEffect } from 'react'
import {
  Bookmark, Plus, Trash2, Star, ExternalLink, Layers,
  Box, HardDrive, Network, HeartPulse, Monitor, Settings2,
  ScrollText, Cog, LayoutDashboard, ChevronDown, GripVertical,
  Tag, Clock, Search, X, Sparkles, FolderHeart,
} from 'lucide-react'
import { useSettingsStore } from '../stores/settingsStore'
import { useSystemStore } from '../stores/systemStore'
import type { PageId } from '../../shared/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BookmarkItem {
  id: string
  type: 'page' | 'stack' | 'container' | 'custom'
  label: string
  target: string       // PageId or stack/container name
  color: string        // accent color class
  icon: string         // icon name
  notes?: string
  createdAt: number
  pinned?: boolean
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function loadBookmarks(): BookmarkItem[] {
  try {
    const raw = localStorage.getItem('user-bookmarks')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveBookmarks(items: BookmarkItem[]) {
  localStorage.setItem('user-bookmarks', JSON.stringify(items))
}

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const iconMap: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  stacks: Layers,
  containers: Box,
  images: HardDrive,
  health: HeartPulse,
  networks: Network,
  logs: ScrollText,
  system: Monitor,
  config: Settings2,
  settings: Cog,
  bookmark: Bookmark,
  star: Star,
  tag: Tag,
}

const colorOptions = [
  { label: 'Emerald', value: 'emerald', class: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  { label: 'Cyan', value: 'cyan', class: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25' },
  { label: 'Amber', value: 'amber', class: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  { label: 'Rose', value: 'rose', class: 'bg-rose-500/15 text-rose-400 border-rose-500/25' },
  { label: 'Violet', value: 'violet', class: 'bg-violet-500/15 text-violet-400 border-violet-500/25' },
  { label: 'Blue', value: 'blue', class: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  { label: 'Pink', value: 'pink', class: 'bg-pink-500/15 text-pink-400 border-pink-500/25' },
  { label: 'Orange', value: 'orange', class: 'bg-orange-500/15 text-orange-400 border-orange-500/25' },
]

function getColorClass(color: string): string {
  return colorOptions.find((c) => c.value === color)?.class ?? colorOptions[0].class
}

const pageTargets: { id: PageId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'stacks', label: 'Stacks' },
  { id: 'containers', label: 'Containers' },
  { id: 'images', label: 'Images' },
  { id: 'health', label: 'Health Monitor' },
  { id: 'networks', label: 'Networks' },
  { id: 'logs', label: 'Logs' },
  { id: 'system', label: 'System' },
  { id: 'config', label: 'Config' },
  { id: 'settings', label: 'Settings' },
]

// ---------------------------------------------------------------------------
// Add Bookmark Form
// ---------------------------------------------------------------------------

function AddBookmarkForm({ onAdd, onCancel }: {
  onAdd: (item: Omit<BookmarkItem, 'id' | 'createdAt'>) => void
  onCancel: () => void
}) {
  const [type, setType] = useState<BookmarkItem['type']>('page')
  const [label, setLabel] = useState('')
  const [target, setTarget] = useState('dashboard')
  const [color, setColor] = useState('emerald')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    onAdd({
      type,
      label: label.trim(),
      target,
      color,
      icon: type === 'page' ? target : 'bookmark',
      notes: notes.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="glass-subtle rounded-xl p-5 border-t-2 border-t-emerald-500 animate-fade-in">
      <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <Plus size={14} className="text-emerald-400" />
        Add Bookmark
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Type */}
        <div>
          <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-semibold">Type</label>
          <div className="flex gap-1.5">
            {(['page', 'stack', 'container', 'custom'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`
                  px-3 py-1.5 rounded-md text-[11px] font-medium border transition-all capitalize
                  ${type === t
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                    : 'border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/10'}
                `}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-semibold">Color</label>
          <div className="flex gap-1.5 flex-wrap">
            {colorOptions.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                className={`
                  w-7 h-7 rounded-md border-2 transition-all
                  bg-${c.value}-500/20
                  ${color === c.value ? `border-${c.value}-400 ring-2 ring-${c.value}-500/20` : 'border-transparent'}
                `}
                style={{
                  backgroundColor: `color-mix(in srgb, ${c.value === 'emerald' ? '#10b981' : c.value === 'cyan' ? '#06b6d4' : c.value === 'amber' ? '#f59e0b' : c.value === 'rose' ? '#f43f5e' : c.value === 'violet' ? '#8b5cf6' : c.value === 'blue' ? '#3b82f6' : c.value === 'pink' ? '#ec4899' : '#f97316'} 20%, transparent)`,
                  borderColor: color === c.value ? (c.value === 'emerald' ? '#10b981' : c.value === 'cyan' ? '#06b6d4' : c.value === 'amber' ? '#f59e0b' : c.value === 'rose' ? '#f43f5e' : c.value === 'violet' ? '#8b5cf6' : c.value === 'blue' ? '#3b82f6' : c.value === 'pink' ? '#ec4899' : '#f97316') : 'transparent',
                }}
                title={c.label}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Label */}
        <div>
          <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-semibold">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="My Bookmark"
            autoFocus
            className="w-full bg-slate-900 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
          />
        </div>

        {/* Target */}
        <div>
          <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-semibold">
            {type === 'page' ? 'Page' : type === 'stack' ? 'Stack Name' : type === 'container' ? 'Container Name' : 'Reference'}
          </label>
          {type === 'page' ? (
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
            >
              {pageTargets.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={type === 'stack' ? 'core-infrastructure' : type === 'container' ? 'nginx-proxy' : 'anything...'}
              className="w-full bg-slate-900 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
            />
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="mb-4">
        <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-semibold">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Quick notes about this bookmark..."
          className="w-full bg-slate-900 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!label.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all"
        >
          <Bookmark size={12} />
          Add Bookmark
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 border border-white/[0.08] hover:bg-white/[0.04] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Bookmark Card
// ---------------------------------------------------------------------------

function BookmarkCard({ item, onDelete, onTogglePin, onNavigate }: {
  item: BookmarkItem
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
  onNavigate: (item: BookmarkItem) => void
}) {
  const Icon = iconMap[item.icon] || Bookmark
  const colorClass = getColorClass(item.color)
  const timeAgo = getTimeAgo(item.createdAt)

  return (
    <div
      className="group relative glass glass-hover rounded-xl p-4 cursor-pointer transition-all duration-200 animate-fade-in"
      onClick={() => onNavigate(item)}
    >
      {/* Pin indicator */}
      {item.pinned && (
        <div className="absolute top-2 right-2">
          <Star size={12} className="text-amber-400 fill-amber-400" />
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`rounded-lg p-2.5 ${colorClass} border shrink-0`}>
          <Icon size={18} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-200 truncate group-hover:text-white transition-colors">
              {item.label}
            </h4>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 border border-white/[0.06] text-slate-500 uppercase font-medium shrink-0">
              {item.type}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono truncate mt-0.5">{item.target}</p>
          {item.notes && (
            <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{item.notes}</p>
          )}
          <p className="text-[10px] text-slate-600 mt-1.5 flex items-center gap-1">
            <Clock size={9} />
            {timeAgo}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onTogglePin(item.id)}
            className={`p-1.5 rounded-md transition-colors ${item.pinned ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-amber-400'}`}
            title={item.pinned ? 'Unpin' : 'Pin'}
          >
            <Star size={12} className={item.pinned ? 'fill-current' : ''} />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 transition-colors"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Bookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(loadBookmarks)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pinned' | 'page' | 'stack' | 'container' | 'custom'>('all')
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)

  const handleAdd = useCallback((item: Omit<BookmarkItem, 'id' | 'createdAt'>) => {
    const newItem: BookmarkItem = {
      ...item,
      id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    }
    const updated = [newItem, ...bookmarks]
    setBookmarks(updated)
    saveBookmarks(updated)
    setShowForm(false)
  }, [bookmarks])

  const handleDelete = useCallback((id: string) => {
    const updated = bookmarks.filter((b) => b.id !== id)
    setBookmarks(updated)
    saveBookmarks(updated)
  }, [bookmarks])

  const handleTogglePin = useCallback((id: string) => {
    const updated = bookmarks.map((b) =>
      b.id === id ? { ...b, pinned: !b.pinned } : b
    )
    setBookmarks(updated)
    saveBookmarks(updated)
  }, [bookmarks])

  const handleNavigate = useCallback((item: BookmarkItem) => {
    if (item.type === 'page') {
      setCurrentPage(item.target as PageId)
    } else if (item.type === 'stack') {
      setCurrentPage('stacks')
    } else if (item.type === 'container') {
      setCurrentPage('containers')
    }
  }, [setCurrentPage])

  // Filter and search
  let filtered = bookmarks
  if (filter === 'pinned') filtered = filtered.filter((b) => b.pinned)
  else if (filter !== 'all') filtered = filtered.filter((b) => b.type === filter)
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(
      (b) => b.label.toLowerCase().includes(q) || b.target.toLowerCase().includes(q) || b.notes?.toLowerCase().includes(q)
    )
  }

  // Sort: pinned first, then by creation date
  filtered.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return b.createdAt - a.createdAt
  })

  const stats = {
    total: bookmarks.length,
    pinned: bookmarks.filter((b) => b.pinned).length,
    pages: bookmarks.filter((b) => b.type === 'page').length,
    stacks: bookmarks.filter((b) => b.type === 'stack').length,
  }

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h2 className="text-base md:text-xl font-bold text-slate-100 flex items-center gap-2">
            <span className="text-gradient">Bookmarks</span>
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Pin your favorite pages, stacks, and containers for quick access
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`
            flex items-center gap-2 rounded-lg px-3.5 py-2
            text-sm font-medium transition-all duration-200
            ${showForm
              ? 'text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10'
              : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
            }
          `}
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Cancel' : 'Add Bookmark'}
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 animate-fade-in">
        <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg glass-subtle">
          <span className="text-xs text-slate-500">
            <span className="text-slate-300 font-semibold">{stats.total}</span> bookmarks
          </span>
          <span className="w-px h-4 bg-white/[0.06]" />
          <span className="text-xs text-slate-500">
            <span className="text-amber-400 font-semibold">{stats.pinned}</span> pinned
          </span>
          <span className="w-px h-4 bg-white/[0.06]" />
          <span className="text-xs text-slate-500">
            <span className="text-emerald-400 font-semibold">{stats.pages}</span> pages
          </span>
          <span className="w-px h-4 bg-white/[0.06]" />
          <span className="text-xs text-slate-500">
            <span className="text-cyan-400 font-semibold">{stats.stacks}</span> stacks
          </span>
        </div>
      </div>

      {/* Add form */}
      {showForm && <AddBookmarkForm onAdd={handleAdd} onCancel={() => setShowForm(false)} />}

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bookmarks..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-white/[0.06] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <div className="flex items-center flex-wrap gap-1">
          {(['all', 'pinned', 'page', 'stack', 'container', 'custom'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-all capitalize
                ${filter === f
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                  : 'border-white/[0.04] text-slate-500 hover:text-slate-300 hover:border-white/10'}
              `}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Bookmark grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
          <div className="rounded-2xl bg-slate-800/40 p-6 mb-4">
            <FolderHeart size={40} className="text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            {bookmarks.length === 0 ? 'No bookmarks yet' : 'No matches'}
          </h3>
          <p className="text-sm text-slate-500 max-w-md">
            {bookmarks.length === 0
              ? 'Add your first bookmark to quickly access your favorite pages, stacks, and containers.'
              : 'Try adjusting your search or filter to find what you\'re looking for.'}
          </p>
          {bookmarks.length === 0 && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Plus size={15} />
              Create Your First Bookmark
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger-children">
          {filtered.map((item) => (
            <BookmarkCard
              key={item.id}
              item={item}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
