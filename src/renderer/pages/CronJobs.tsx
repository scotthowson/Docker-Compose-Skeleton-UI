// =============================================================================
// CronJobs — the server's crontab: the entries of the user crontab (add, edit as
// text, remove) and the system's, with what each schedule means in words
// (The tasks DCS runs on its own timer are the Schedules page.)
// =============================================================================

import { Fragment, useState, useMemo, useCallback, useId } from 'react'
import { SegmentedControl, Badge } from '@mantine/core'
import {
  CalendarClock,
  Clock,
  Terminal,
  User,
  Server,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  RefreshCw,
  Search,
  FileText,
  AlertTriangle,
  Loader2,
  WifiOff,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  BookOpen,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { usePolling } from '../hooks/usePolling'
import { fetchCrontab, fetchSystemCrontab, updateCrontab } from '../api/endpoints'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import { useConfirm } from '../components/common/ConfirmDialog'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import PageHeader from '../components/common/PageHeader'
import Hint from '../components/common/Hint'
import { pageLabel } from '../constants/pageTitles'
import { BTN_TOOLBAR, BTN_TOOLBAR_QUIET, BTN_CARD, BTN_ICON_SM, BTN_SHEET_QUIET, BTN_SHEET_PRIMARY, TONE_OK, TONE_QUIET, TONE_GHOST, TONE_GHOST_DANGER } from '../lib/ui'
import type { CronEntry, CrontabResponse } from '../../shared/types'
import { EmptyState } from '../components/common/PageState'
import ModalOverlay from '../components/common/ModalOverlay'

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

/** a column header of the entries table (static) */
const TH = 'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400'

/** the fields of this page's forms: one look, one focus ring */
const FIELD = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 font-mono placeholder-slate-600 transition-colors focus:outline-none focus-visible:border-emerald-500/40 focus-visible:ring-2 focus-visible:ring-emerald-500/40'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** the user's own entries are the editable ones (emerald); the system's are neutral */
function sourceTone(source: CronEntry['source']): 'emerald' | 'slate' {
  return source === 'user' ? 'emerald' : 'slate'
}

function sourceIcon(source: CronEntry['source']) {
  switch (source) {
    case 'user': return <User size={10} />
    case 'system': return <Server size={10} />
    case 'cron.d': return <FileText size={10} />
  }
}

// ---------------------------------------------------------------------------
// Guide sections
// ---------------------------------------------------------------------------

const CRON_GUIDE_SECTIONS = [
  {
    title: 'Cron expression syntax',
    icon: Clock,
    content: `┌───────── minute (0-59)
│ ┌─────── hour (0-23)
│ │ ┌───── day of month (1-31)
│ │ │ ┌─── month (1-12)
│ │ │ │ ┌─ day of week (0-7, 0 and 7 = Sun)
│ │ │ │ │
* * * * *    command to run

Special characters:
  *     Any value
  ,     Value list (1,3,5)
  -     Range (1-5)
  /     Step (*/15 = every 15)`,
  },
  {
    title: 'Common schedules',
    icon: CalendarClock,
    content: `* * * * *        Every minute
*/5 * * * *      Every 5 minutes
*/15 * * * *     Every 15 minutes
0 * * * *        Every hour (on the hour)
0 */6 * * *      Every 6 hours
0 0 * * *        Daily at midnight
0 3 * * *        Daily at 3 AM
0 0 * * 0        Weekly on Sunday
0 0 1 * *        First of every month
0 0 1 1 *        Yearly on January 1st`,
  },
  {
    title: 'User and system crontabs',
    icon: User,
    content: `User crontab (editable)
  Your personal cron schedule. Edit directly
  from this page or via the Raw editor.
  Location: crontab -e

System cron (read-only)
  System-wide scheduled tasks managed by
  the OS and installed packages.
  Location: /etc/crontab, /etc/cron.d/

Only user crontab entries can be added,
edited, or deleted from this interface.`,
  },
  {
    title: 'Example: nightly backup',
    icon: Terminal,
    content: `Schedule:  0 2 * * *
Command:   /opt/dcs/backup.sh >> /var/log/backup.log 2>&1

This runs a backup script at 2 AM every night
and appends output to a log file.

Tips:
  • Use full paths for commands
  • Redirect output to avoid cron mail
  • Test commands manually before scheduling`,
  },
]

// ---------------------------------------------------------------------------
// CronJobs Page
// ---------------------------------------------------------------------------

export default function CronJobs() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { addToast } = useToast()
  const confirm = useConfirm()
  const uid = useId()

  const [activeTab, setActiveTab] = useState<TabId>('user')
  const [search, setSearch] = useState('')
  const [showRawEditor, setShowRawEditor] = useState(false)
  const [rawContent, setRawContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSchedule, setNewSchedule] = useState('0 * * * *')
  const [newCommand, setNewCommand] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null)

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

  // Copy a schedule or a command
  const handleCopy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000)
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
        addToast({ type: 'success', message: 'Crontab saved' })
        setShowRawEditor(false)
        refreshUser()
      } else {
        addToast({ type: 'error', message: res.message || 'Could not save the crontab' })
      }
    } catch {
      addToast({ type: 'error', message: 'Could not save the crontab' })
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
        addToast({ type: 'error', message: res.message || 'Could not add the entry' })
      }
    } catch {
      addToast({ type: 'error', message: 'Could not add the cron entry' })
    } finally {
      setSaving(false)
    }
  }, [newSchedule, newCommand, userData, addToast, refreshUser])

  // Delete cron entry (asks first)
  const handleDeleteEntry = useCallback(async (idx: number, command: string) => {
    if (!userData?.raw) return
    const ok = await confirm({
      title: 'Remove this cron entry?',
      message: `${command}\n\nIt is taken out of the user crontab and stops running.`,
      confirmLabel: 'Remove entry',
      danger: true,
    })
    if (!ok) return
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
        addToast({ type: 'error', message: res.message || 'Could not remove the entry' })
      }
    } catch {
      addToast({ type: 'error', message: 'Could not remove the cron entry' })
    } finally {
      setSaving(false)
    }
  }, [userData, addToast, refreshUser, confirm])

  // -------------------------------------------------------------------------
  // Disconnected state
  // -------------------------------------------------------------------------

  if (!isConnected) {
    return <EmptyState icon={<WifiOff size={32} />} title="Connect to a server to view cron jobs" />
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const colCount = activeTab === 'user' ? 6 : 5

  return (
    <div className="space-y-5 animate-fade-in">
      <DisconnectedBanner />
      <PageHeader
        page="cronjobs"
        subtitle={`${entries.length} cron ${entries.length === 1 ? 'entry' : 'entries'}${activeTab === 'user' ? ' (user)' : ' (system)'}`}
        actions={<>
          {activeTab === 'user' && (
            <>
              <button type="button" aria-label="Add entry" onClick={() => setShowAddForm(!showAddForm)} aria-expanded={showAddForm} className={`${BTN_TOOLBAR} ${TONE_OK}`}>
                <Plus size={14} />
                <span className="hidden sm:inline">Add entry</span>
              </button>
              <button type="button" aria-label="Raw editor" onClick={handleOpenRawEditor} className={BTN_TOOLBAR_QUIET}>
                <Edit3 size={14} />
                <span className="hidden sm:inline">Raw editor</span>
              </button>
            </>
          )}
          <Hint label={showGuide ? 'Hide the guide' : 'Show the guide'}>
            <button
              type="button"
              aria-label="Guide"
              aria-expanded={showGuide}
              onClick={() => setShowGuide(!showGuide)}
              className={`${BTN_TOOLBAR} ${showGuide ? 'bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/25' : TONE_QUIET}`}
            >
              <BookOpen size={14} />
              <span className="hidden sm:inline">Guide</span>
            </button>
          </Hint>
          <button type="button" aria-label="Refresh" onClick={refresh} disabled={loading} className={BTN_TOOLBAR_QUIET}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </>}
      />

      {/* Cron guide (collapsible) */}
      {showGuide && (
        <section aria-label={`${pageLabel('cronjobs')} guide`} className="glass rounded-xl border border-white/5 overflow-hidden animate-fade-in">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-slate-400" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-200">{pageLabel('cronjobs')} guide</h2>
            </div>
            <Hint label="Close the guide">
              <button type="button" aria-label="Close the guide" onClick={() => setShowGuide(false)} className={`${BTN_ICON_SM} ${TONE_GHOST}`}>
                <X size={14} />
              </button>
            </Hint>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-slate-400 mb-4">
              Scheduled tasks run commands at specific intervals using cron expressions.
              Use the <code className="text-slate-200 bg-white/10 px-1.5 py-0.5 rounded text-xs">User crontab</code> tab to manage your own cron entries, or view <code className="text-slate-200 bg-white/10 px-1.5 py-0.5 rounded text-xs">System cron</code> for the read-only OS schedules.
            </p>
            {CRON_GUIDE_SECTIONS.map((section, i) => {
              const isExpanded = expandedGuide === i
              const Icon = section.icon
              return (
                <div key={section.title} className="border border-white/[0.03] rounded-lg overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedGuide(isExpanded ? null : i)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40"
                  >
                    <Icon size={14} className="text-slate-400 shrink-0" aria-hidden />
                    <span className="text-sm font-medium text-slate-200 flex-1">{section.title}</span>
                    {isExpanded
                      ? <ChevronDown size={14} className="text-slate-500" aria-hidden />
                      : <ChevronRight size={14} className="text-slate-500" aria-hidden />
                    }
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 animate-fade-in">
                      <pre className="bg-slate-950/60 border border-white/[0.03] rounded-lg p-4 text-xs font-mono text-slate-300 overflow-x-auto scrollbar-thin whitespace-pre leading-relaxed">
                        {section.content}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Which crontab + search */}
      <div className="flex items-center flex-wrap gap-4">
        <SegmentedControl
          aria-label="Which crontab"
          value={activeTab}
          onChange={(v) => { setActiveTab(v as TabId); setExpandedIdx(null) }}
          data={[
            { value: 'user', label: <span className="flex items-center gap-1.5"><User size={13} aria-hidden />User crontab</span> },
            { value: 'system', label: <span className="flex items-center gap-1.5"><Server size={13} aria-hidden />System cron</span> },
          ]}
        />

        {/* Search */}
        <div className="flex-1 min-w-[12rem] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter the entries"
            placeholder="Filter by schedule, command or user…"
            className="w-full h-[34px] pl-9 pr-3 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 placeholder-slate-500 transition-colors focus:outline-none focus-visible:border-emerald-500/40 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          />
        </div>
      </div>

      {/* Add entry form */}
      {showAddForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleAddEntry() }}
          className="glass border border-white/5 rounded-xl p-4 animate-scale-in"
        >
          <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Plus size={14} className="text-slate-400" aria-hidden />
            New cron entry
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 mb-3">
            {/* Schedule input */}
            <div>
              <label htmlFor={`${uid}-schedule`} className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Schedule</label>
              <input
                id={`${uid}-schedule`}
                type="text"
                value={newSchedule}
                onChange={(e) => setNewSchedule(e.target.value)}
                className={`${FIELD} sm:w-48`}
                placeholder="* * * * *"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Command input */}
            <div>
              <label htmlFor={`${uid}-command`} className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Command</label>
              <input
                id={`${uid}-command`}
                type="text"
                value={newCommand}
                onChange={(e) => setNewCommand(e.target.value)}
                className={FIELD}
                placeholder="/usr/bin/my-script.sh --arg"
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
            </div>
          </div>

          {/* Preset schedule buttons */}
          <div className="mb-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Quick presets</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SCHEDULES.map((p) => (
                <button
                  key={p.cron}
                  type="button"
                  aria-pressed={newSchedule === p.cron}
                  onClick={() => setNewSchedule(p.cron)}
                  className={`h-8 sm:h-7 px-2.5 rounded-lg text-[11px] font-medium border transition-colors ${
                    newSchedule === p.cron
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-white/[0.03] text-slate-400 border-white/5 hover:bg-white/5 hover:text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={saving || !newCommand.trim()} className={`${BTN_TOOLBAR} ${TONE_OK}`}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add entry
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className={BTN_TOOLBAR_QUIET}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Loading: the table's shape */}
      {loading && !data && (
        <div className="glass border border-white/5 rounded-xl overflow-hidden" role="status" aria-label="Reading the cron entries">
          <div className="px-4 py-3 border-b border-white/5"><div className="skeleton h-3 w-48 rounded" /></div>
          <div className="divide-y divide-white/[0.03]" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="px-4 py-3.5 flex items-center gap-6">
                <div className="skeleton h-5 w-28 rounded" />
                <div className="skeleton h-3 w-36 rounded" />
                <div className="skeleton h-3 flex-1 max-w-sm rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {data && entries.length === 0 && (
        <div className="glass border border-white/5 rounded-xl">
          <EmptyState
            icon={<CalendarClock size={32} />}
            title={search ? 'No entries match your filter' : 'No cron entries found'}
            hint={search
              ? 'Try adjusting your search query or clearing the filter.'
              : activeTab === 'user'
                ? `Add an entry here, or schedule a task on the ${pageLabel('schedules')} page.`
                : 'System cron entries appear here once tasks are scheduled on the server.'}
            action={!search && activeTab === 'user' ? (
              <button type="button" onClick={() => setShowAddForm(true)} className={`${BTN_TOOLBAR} ${TONE_OK}`}>
                <Plus size={14} />
                Add entry
              </button>
            ) : undefined}
          />
        </div>
      )}

      {/* Cron entries table */}
      {entries.length > 0 && (
        <div className="glass border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th scope="col" className={`${TH} text-left w-8`}><span className="sr-only">Details</span></th>
                  <th scope="col" className={`${TH} text-left`}>Schedule</th>
                  <th scope="col" className={`${TH} text-left`}>In words</th>
                  <th scope="col" className={`${TH} text-left`}>Command</th>
                  <th scope="col" className={`${TH} text-left`}>Source</th>
                  {activeTab === 'user' && (
                    <th scope="col" className={`${TH} text-right w-20`}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const open = expandedIdx === idx
                  return (
                    <Fragment key={`${idx}-${entry.schedule}-${entry.command}`}>
                      <tr className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
                        {/* Expand toggle */}
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => setExpandedIdx(open ? null : idx)}
                            aria-label={open ? 'Hide the details' : 'Show the details'}
                            aria-expanded={open}
                            className={`${BTN_ICON_SM} ${TONE_GHOST}`}
                          >
                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>

                        {/* Schedule (monospace) */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/15 whitespace-nowrap">
                              {entry.schedule}
                            </code>
                            <Hint label="Copy the schedule">
                              <button type="button" onClick={() => handleCopy(entry.schedule, `s${idx}`)} aria-label={`Copy the schedule ${entry.schedule}`} className={`${BTN_ICON_SM} ${TONE_GHOST}`}>
                                {copied === `s${idx}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              </button>
                            </Hint>
                          </div>
                        </td>

                        {/* In words */}
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Clock size={12} className="text-slate-500 shrink-0" aria-hidden />
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
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge component="span" color={sourceTone(entry.source)} leftSection={sourceIcon(entry.source)}>{entry.source}</Badge>
                          {entry.user && (
                            <span className="text-[10px] text-slate-500 ml-1.5">{entry.user}</span>
                          )}
                        </td>

                        {/* Actions (user crontab only) */}
                        {activeTab === 'user' && (
                          <td className="px-4 py-3 text-right">
                            <Hint label="Remove the entry">
                              <button
                                type="button"
                                onClick={() => handleDeleteEntry(idx, entry.command)}
                                disabled={saving}
                                aria-label={`Remove the entry ${entry.command}`}
                                className={`${BTN_ICON_SM} ${TONE_GHOST_DANGER}`}
                              >
                                <Trash2 size={13} />
                              </button>
                            </Hint>
                          </td>
                        )}
                      </tr>

                      {/* The details: the whole command, wrapped */}
                      {open && (
                        <tr className="border-b border-white/[0.03] bg-white/[0.02]">
                          <td colSpan={colCount} className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Command</p>
                                <code className="block text-xs font-mono text-slate-200 whitespace-pre-wrap break-all">{entry.command}</code>
                                <p className="mt-2 text-[11px] text-slate-500">
                                  {entry.human_readable} · <span className="font-mono">{entry.schedule}</span> · {entry.source}{entry.user ? ` (${entry.user})` : ''}
                                </p>
                              </div>
                              <button type="button" onClick={() => handleCopy(entry.command, `c${idx}`)} className={`${BTN_CARD} ${TONE_QUIET}`}>
                                {copied === `c${idx}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                Copy command
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Raw editor */}
      {showRawEditor && createPortal(
        <ModalOverlay onClose={() => setShowRawEditor(false)} className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-3xl max-h-[80vh] glass border border-white/10 rounded-2xl shadow-2xl shadow-black/40 flex flex-col animate-scale-in overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-slate-400" aria-hidden />
                <h2 className="text-sm font-semibold text-slate-200">Raw crontab editor</h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setShowRawEditor(false)} className={`${BTN_ICON_SM} ${TONE_GHOST}`}>
                <X size={16} />
              </button>
            </div>

            {/* Warning */}
            <div className="mx-5 mt-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/15">
              <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" aria-hidden />
              <p className="text-[11px] text-amber-400/90">
                Editing the raw crontab directly. Invalid syntax may cause crontab installation to fail. Changes are applied immediately.
              </p>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-auto p-5">
              <textarea
                aria-label="Contents of the user crontab"
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                className="w-full h-full min-h-[300px] px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono text-slate-300 placeholder-slate-600 resize-none transition-colors focus:outline-none focus-visible:border-emerald-500/40 focus-visible:ring-2 focus-visible:ring-emerald-500/40 leading-relaxed"
                placeholder="# min hour day month weekday command"
                spellCheck={false}
              />
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-white/5">
              <span className="text-[10px] text-slate-500 hidden sm:inline">
                Press <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.03] text-[9px] font-mono text-slate-400">Esc</kbd> to close
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button type="button" onClick={() => setShowRawEditor(false)} className={`${BTN_SHEET_QUIET} flex-1 sm:flex-none`}>
                  Cancel
                </button>
                <button type="button" onClick={handleSaveRaw} disabled={saving} className={`${BTN_SHEET_PRIMARY} flex-1 sm:flex-none`}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save crontab
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>,
        document.body
      )}
    </div>
  )
}
