// =============================================================================
// CronJobs — View and manage server crontab entries with human-readable schedules
// =============================================================================

import { useState, useMemo, useCallback } from 'react'
import {
  CalendarClock, Clock, Terminal, User, Server,
  Plus, Trash2, Edit3, Save, X, RefreshCw,
  Search, Filter, FileText, AlertTriangle,
  Loader2, WifiOff, ChevronDown, ChevronRight,
  Copy, Check,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { usePolling } from '../hooks/usePolling'
import { fetchCrontab, fetchSystemCrontab, updateCrontab } from '../api/endpoints'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import type { CronEntry, CrontabResponse } from '../../shared/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TabId = 'user' | 'system'

const PRESET_SCHEDULES: { label: string; cron: string }[] = [
  { label: 'Every minute', cron: '* * * * *' },
  { label: 'Every 5 minutes', cron: '*/5 * * * *' },
  { label: 'Every 15 minutes', cron: '*/15 * * * *' },
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every 6 hours', cron: '0 */6 * * *' },
  { label: 'Daily at midnight', cron: '0 0 * * *' },
  { label: 'Daily at 3 AM', cron: '0 3 * * *' },
  { label: 'Weekly (Sun midnight)', cron: '0 0 * * 0' },
  { label: 'Monthly (1st midnight)', cron: '0 0 1 * *' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sourceColor(source: CronEntry['source']): string {
  switch (source) {
    case 'user': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    case 'system': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20'
    case 'cron.d': return 'bg-violet-500/15 text-violet-400 border-violet-500/20'
  }
}

function sourceIcon(source: CronEntry['source']) {
  switch (source) {
    case 'user': return <User size={10} />
    case 'system': return <Server size={10} />
    case 'cron.d': return <FileText size={10} />
  }
}

// ---------------------------------------------------------------------------
// CronJobs Page
// ---------------------------------------------------------------------------

export default function CronJobs() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { addToast } = useToast()

  const [activeTab, setActiveTab] = useState<TabId>('user')
  const [search, setSearch] = useState('')
  const [showRawEditor, setShowRawEditor] = useState(false)
  const [rawContent, setRawContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSchedule, setNewSchedule] = useState('0 * * * *')
  const [newCommand, setNewCommand] = useState('')
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  // Polling
  const { data: userData, loading: userLoading, refresh: refreshUser } = usePolling<CrontabResponse>(
    fetchCrontab, 30000, { enabled: isConnected }
  )
  const { data: systemData, loading: systemLoading, refresh: refreshSystem } = usePolling<CrontabResponse>(
    fetchSystemCrontab, 60000, { enabled: isConnected }
  )

  const data = activeTab === 'user' ? userData : systemData
  const loading = activeTab === 'user' ? userLoading : systemLoading
  const refresh = activeTab === 'user' ? refreshUser : refreshSystem

  // Filter entries
  const entries = useMemo(() => {
    if (!data?.entries) return []
    if (!search.trim()) return data.entries
    const q = search.toLowerCase()
    return data.entries.filter(
      (e) => e.command.toLowerCase().includes(q) ||
             e.schedule.toLowerCase().includes(q) ||
             e.human_readable.toLowerCase().includes(q) ||
             (e.user && e.user.toLowerCase().includes(q))
    )
  }, [data, search])

  // Copy cron expression
  const handleCopy = useCallback((text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }, [])

  // Open raw editor
  const handleOpenRawEditor = useCallback(() => {
    setRawContent(userData?.raw ?? '')
    setShowRawEditor(true)
  }, [userData])

  // Save raw crontab
  const handleSaveRaw = useCallback(async () => {
    setSaving(true)
    try {
      const res = await updateCrontab(rawContent)
      if (res.success) {
        addToast({ type: 'success', message: 'Crontab updated successfully' })
        setShowRawEditor(false)
        refreshUser()
      } else {
        addToast({ type: 'error', message: res.message || 'Failed to update crontab' })
      }
    } catch {
      addToast({ type: 'error', message: 'Failed to update crontab' })
    } finally {
      setSaving(false)
    }
  }, [rawContent, addToast, refreshUser])

  // Add new cron entry
  const handleAddEntry = useCallback(async () => {
    if (!newCommand.trim()) return
    const newLine = `${newSchedule} ${newCommand}`
    const currentRaw = userData?.raw ?? ''
    const updatedRaw = currentRaw.trim() + '\n' + newLine + '\n'
    setSaving(true)
    try {
      const res = await updateCrontab(updatedRaw)
      if (res.success) {
        addToast({ type: 'success', message: 'Cron entry added' })
        setShowAddForm(false)
        setNewCommand('')
        setNewSchedule('0 * * * *')
        refreshUser()
      } else {
        addToast({ type: 'error', message: res.message || 'Failed to add entry' })
      }
    } catch {
      addToast({ type: 'error', message: 'Failed to add cron entry' })
    } finally {
      setSaving(false)
    }
  }, [newSchedule, newCommand, userData, addToast, refreshUser])

  // Delete cron entry
  const handleDeleteEntry = useCallback(async (idx: number) => {
    if (!userData?.raw) return
    const lines = userData.raw.split('\n')
    // Find the actual line index for this entry (skip comments/blanks)
    let entryCount = -1
    const newLines = lines.filter((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return true
      entryCount++
      return entryCount !== idx
    })
    setSaving(true)
    try {
      const res = await updateCrontab(newLines.join('\n'))
      if (res.success) {
        addToast({ type: 'success', message: 'Cron entry removed' })
        refreshUser()
      } else {
        addToast({ type: 'error', message: res.message || 'Failed to remove entry' })
      }
    } catch {
      addToast({ type: 'error', message: 'Failed to remove cron entry' })
    } finally {
      setSaving(false)
    }
  }, [userData, addToast, refreshUser])

  // -------------------------------------------------------------------------
  // Disconnected state
  // -------------------------------------------------------------------------

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
          <WifiOff size={24} className="text-slate-600" />
        </div>
        <p className="text-sm text-slate-500">Connect to a server to view cron jobs</p>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/10 flex items-center justify-center text-violet-400">
            <CalendarClock size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Scheduled Tasks</h2>
            <p className="text-xs text-slate-500">
              {entries.length} cron {entries.length === 1 ? 'entry' : 'entries'}
              {activeTab === 'user' ? ' (user)' : ' (system)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'user' && (
            <>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors"
              >
                <Plus size={13} />
                Add Entry
              </button>
              <button
                onClick={handleOpenRawEditor}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
              >
                <Edit3 size={13} />
                Raw Editor
              </button>
            </>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tab bar + search */}
      <div className="flex items-center flex-wrap gap-4">
        {/* Tabs */}
        <div className="flex rounded-lg bg-white/[0.03] border border-white/[0.06] p-0.5">
          {([
            { id: 'user' as TabId, label: 'User Crontab', icon: <User size={13} /> },
            { id: 'system' as TabId, label: 'System Cron', icon: <Server size={13} /> },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white/[0.08] text-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by schedule, command, or user..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-violet-500/30 focus:bg-white/[0.05] transition-colors"
          />
        </div>
      </div>

      {/* Add entry form */}
      {showAddForm && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-emerald-500/15 rounded-xl p-4 animate-scale-in">
          <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Plus size={14} className="text-emerald-400" />
            New Cron Entry
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 mb-3">
            {/* Schedule input */}
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Schedule</label>
              <input
                type="text"
                value={newSchedule}
                onChange={(e) => setNewSchedule(e.target.value)}
                className="w-48 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 font-mono focus:outline-none focus:border-violet-500/30 transition-colors"
                placeholder="* * * * *"
              />
            </div>

            {/* Command input */}
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Command</label>
              <input
                type="text"
                value={newCommand}
                onChange={(e) => setNewCommand(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 font-mono focus:outline-none focus:border-violet-500/30 transition-colors"
                placeholder="/usr/bin/my-script.sh --arg"
              />
            </div>
          </div>

          {/* Preset schedule buttons */}
          <div className="mb-3">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Quick Presets</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SCHEDULES.map((p) => (
                <button
                  key={p.cron}
                  onClick={() => setNewSchedule(p.cron)}
                  className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                    newSchedule === p.cron
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                      : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:bg-white/[0.06] hover:text-slate-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddEntry}
              disabled={saving || !newCommand.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add Entry
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-slate-600" />
        </div>
      )}

      {/* Empty state */}
      {data && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
            <CalendarClock size={22} className="text-slate-600" />
          </div>
          <p className="text-sm text-slate-500">
            {search ? 'No entries match your filter' : 'No cron entries found'}
          </p>
        </div>
      )}

      {/* Cron entries table */}
      {entries.length > 0 && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.05] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 w-8" />
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Schedule</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Human Readable</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Command</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Source</th>
                {activeTab === 'user' && (
                  <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 w-20">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr
                  key={idx}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group"
                >
                  {/* Expand toggle */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                      className="text-slate-600 hover:text-slate-400 transition-colors"
                    >
                      {expandedIdx === idx ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </td>

                  {/* Schedule (monospace) */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/15">
                        {entry.schedule}
                      </code>
                      <button
                        onClick={() => handleCopy(entry.schedule, idx)}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-400 transition-all"
                        title="Copy schedule"
                      >
                        {copiedIdx === idx ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </td>

                  {/* Human readable */}
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-600 shrink-0" />
                      {entry.human_readable}
                    </span>
                  </td>

                  {/* Command */}
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-slate-300 truncate block max-w-[400px]" title={entry.command}>
                      {entry.command}
                    </code>
                  </td>

                  {/* Source badge */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sourceColor(entry.source)}`}>
                      {sourceIcon(entry.source)}
                      {entry.source}
                    </span>
                    {entry.user && (
                      <span className="text-[10px] text-slate-600 ml-1.5">{entry.user}</span>
                    )}
                  </td>

                  {/* Actions (user crontab only) */}
                  {activeTab === 'user' && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteEntry(idx)}
                        disabled={saving}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-50"
                        title="Delete entry"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Raw Editor Overlay */}
      {showRawEditor && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-3xl max-h-[80vh] bg-slate-900 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 flex flex-col animate-scale-in overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-violet-400" />
                <h3 className="text-sm font-semibold text-slate-200">Raw Crontab Editor</h3>
              </div>
              <button
                onClick={() => setShowRawEditor(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Warning */}
            <div className="mx-5 mt-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/15">
              <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-400/90">
                Editing the raw crontab directly. Invalid syntax may cause crontab installation to fail. Changes are applied immediately.
              </p>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-auto p-5">
              <textarea
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                className="w-full h-full min-h-[300px] px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-violet-500/30 transition-colors leading-relaxed"
                placeholder="# min hour day month weekday command"
                spellCheck={false}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
              <button
                onClick={() => setShowRawEditor(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRaw}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save Crontab
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
