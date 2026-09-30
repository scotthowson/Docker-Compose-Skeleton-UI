// =============================================================================
// The card kit — what every dashboard card is made of, once: the frame, the
// header (icon, title, a line of numbers, a status chip, its buttons), the
// loading skeleton, the empty, failed and not-connected states, and the one
// way a percentage turns amber or rose. A card wears it like this:
//
//   <Card card="stack-grid" meta="3 total" open="stacks">
//     …the card's own content…
//   </Card>
//
//   Panel   the same frame for a section of a page (Health, Uptime, Trends, System …): as tall as its
//           content, an icon, a title, the same header buttons; `flush` lets a table or a list run edge to edge
//   StatTile  the small number tile of those pages: an icon, a label, a value, a line under it
//
//   Card    card       the card's id in the registry (cardRegistry.ts): its name and icon come from
//                      there, so the header, the edit-mode chip and the picker always agree
//           icon       the header icon when it changes with the state (a lucide component; drawn at 16, slate)
//           title      the name when it is not the registry's (sentence case)
//           meta       muted numbers right of the title ("3 total")
//           badge      a status chip (a Mantine Badge): Healthy · Idle · Cleanup available
//           actions    header buttons: BTN_ICON_SM + TONE_GHOST with aria-label and Hint,
//                      or a small SegmentedControl
//           open       the page the card leads to: the header gets an "Open <page>" button, and
//                      (unless clickable={false}, for a card whose list wants the mouse) the whole
//                      card is a click target as well
//           tone       'attention' (amber) or 'problem' (rose) tints the icon and the edge;
//                      a card that is fine wears no colour
//           dim        the card is offline: muted
//
// The body is whatever the card needs; a list scrolls inside <CardBody> so the
// header stays put. While the first answer is on its way a card shows
// <CardLoading/> (the house skeleton), when nothing is there <CardEmpty/> (with
// the next step), when the request failed <CardError/> (with Try again), and
// when the dashboard is not connected <CardOffline/>.
// =============================================================================

import React from 'react'
import { ArrowUpRight, Box, RefreshCw, ServerOff, AlertCircle, type LucideIcon } from 'lucide-react'
import { SegmentedControl } from '@mantine/core'
import type { PageId } from '../../../shared/types'
import { pageLabel } from '../../constants/pageTitles'
import { useSettingsStore } from '../../stores/settingsStore'
import Hint from '../common/Hint'
import { BTN_CARD_QUIET, BTN_ICON_SM, TONE_GHOST } from '../../lib/ui'
import { cardIcon, cardTitle } from './cardRegistry'

// ── colour meaning ──────────────────────────────────────────────────────────
// emerald = fine · amber = needs attention · rose = a problem · cyan = information · slate = neutral

export type Tone = 'ok' | 'attention' | 'problem' | 'info' | 'neutral'

/** the text colour of a tone */
export const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-emerald-400', attention: 'text-amber-400', problem: 'text-rose-400', info: 'text-cyan-400', neutral: 'text-slate-300',
}
/** the fill of a bar or a dot in a tone */
export const TONE_FILL: Record<Tone, string> = {
  ok: 'bg-emerald-500', attention: 'bg-amber-500', problem: 'bg-rose-500', info: 'bg-cyan-500', neutral: 'bg-slate-500',
}
/** the same tones as chart colours (an SVG attribute cannot take a class) */
export const TONE_HEX: Record<Tone, string> = {
  ok: '#10b981', attention: '#f59e0b', problem: '#f43f5e', info: '#06b6d4', neutral: '#64748b',
}

/** a usage percentage: fine below 75, needs attention from 75, a problem from 90 — for every bar and ring of the dashboard */
export const PCT_ATTENTION = 75
export const PCT_PROBLEM = 90
export function pctTone(pct: number): Tone {
  return pct >= PCT_PROBLEM ? 'problem' : pct >= PCT_ATTENTION ? 'attention' : 'ok'
}

/** a number that is fine stays plain: only a verdict that needs a look takes a colour */
export const quiet = (t: Tone): Tone => (t === 'ok' ? 'neutral' : t)

/** the load average against the cores there are: fine below one per core, busy from one, overloaded from two ('neutral' while the core count is unknown) */
export function loadTone(load: number, cores: number | undefined): Tone {
  if (!cores || cores < 1) return 'neutral'
  const perCore = load / cores
  return perCore >= 2 ? 'problem' : perCore >= 1 ? 'attention' : 'ok'
}

/** the colour of each metric wherever it is drawn as a series (dashboard, Trends): identity, never status */
export const METRIC_HEX = { cpu: '#10b981', mem: '#06b6d4', disk: '#3b82f6', swap: '#94a3b8', gpu: '#22d3ee' } as const

// ── the frame ───────────────────────────────────────────────────────────────

export type CardTone = 'attention' | 'problem'

const FRAME = 'glass-card p-4 h-full min-h-0 flex flex-col animate-fade-in hover:!transform-none'
const EDGE: Record<CardTone, string> = { attention: 'border-amber-500/30', problem: 'border-rose-500/30' }
const ICON_TINT: Record<CardTone, string> = { attention: 'text-amber-400', problem: 'text-rose-400' }

interface HeaderProps {
  icon: LucideIcon
  title: string
  meta?: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
  open?: PageId
  tone?: CardTone
  /** no space under the header (a panel whose body runs edge to edge draws its own) */
  bare?: boolean
}

/** the header every card wears (Card draws it; a card with a frame of its own can use it directly) */
export function CardHeader({ icon: Icon, title, meta, badge, actions, open, tone, bare = false }: HeaderProps) {
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  return (
    <div className={`flex items-center gap-2 ${bare ? '' : 'mb-3'} min-h-8 sm:min-h-7`}>
      <Icon size={16} className={`shrink-0 ${tone ? ICON_TINT[tone] : 'text-slate-400'}`} aria-hidden />
      <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200" title={title}>{title}</h2>
      {(meta || badge || actions || open) && (
        <div className="flex items-center gap-1.5 shrink-0">
          {meta && <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">{meta}</span>}
          {badge}
          {actions}
          {open && (
            <Hint label={`Open ${pageLabel(open)}`}>
              <button
                type="button"
                aria-label={`Open ${pageLabel(open)}`}
                onClick={(e) => { e.stopPropagation(); setCurrentPage(open) }}
                className={`${BTN_ICON_SM} ${TONE_GHOST}`}
              >
                <ArrowUpRight size={14} />
              </button>
            </Hint>
          )}
        </div>
      )}
    </div>
  )
}

export function Card({ card, icon, title, meta, badge, actions, open, clickable = true, tone, dim = false, className = '', children }: Omit<HeaderProps, 'icon' | 'title'> & {
  card?: string
  icon?: LucideIcon
  title?: string
  /** with `open`: the whole card opens the page on a click (default), not only the header button */
  clickable?: boolean
  dim?: boolean
  className?: string
  children: React.ReactNode
}) {
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  return (
    <div
      className={`${FRAME} ${tone ? EDGE[tone] : ''} ${open && clickable ? 'cursor-pointer hover:border-white/10' : ''} ${dim ? 'opacity-60' : ''} ${className}`}
      onClick={open && clickable ? () => setCurrentPage(open) : undefined}
    >
      <CardHeader icon={icon ?? (card ? cardIcon(card) : Box)} title={title ?? (card ? cardTitle(card) : '')} meta={meta} badge={badge} actions={actions} open={open} tone={tone} />
      {children}
    </div>
  )
}

/** A section of a page in the card's frame: as tall as its content, the same header. `flush`: the body runs edge to edge (a table, a list of rows) under a header of its own. */
export function Panel({ icon, title, meta, badge, actions, open, tone, flush = false, className = '', children }: HeaderProps & {
  flush?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={`glass-card animate-fade-in hover:!transform-none ${flush ? 'overflow-hidden' : 'p-4'} ${tone ? EDGE[tone] : ''} ${className}`}>
      {flush ? (
        <div className="px-4 py-2.5 border-b border-white/5">
          <CardHeader icon={icon} title={title} meta={meta} badge={badge} actions={actions} open={open} tone={tone} bare />
        </div>
      ) : (
        <CardHeader icon={icon} title={title} meta={meta} badge={badge} actions={actions} open={open} tone={tone} />
      )}
      {children}
    </section>
  )
}

/** A number tile of a page: an icon, a label, the value (in a tone when it means something) and a line under it. */
export function StatTile({ icon: Icon, label, value, sub, tone = 'neutral', className = '' }: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <div className={`glass-subtle p-3 md:p-4 flex items-center gap-3 min-w-0 ${className}`}>
      <Icon size={18} className={`shrink-0 ${tone === 'neutral' ? 'text-slate-400' : TONE_TEXT[tone]}`} aria-hidden />
      <div className="min-w-0">
        <p className="text-[10px] md:text-xs text-slate-500 uppercase tracking-wide truncate">{label}</p>
        <p className={`text-lg md:text-xl font-bold tabular-nums ${tone === 'neutral' ? 'text-white' : TONE_TEXT[tone]}`}>{value}</p>
        {sub && <p className="text-[11px] text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  )
}

/** the switch a card keeps in its header (Gauges · Trending, CPU · MEM): a small SegmentedControl that does not open the page the card leads to */
export function CardSwitch<T extends string>({ label, value, onChange, data }: {
  label: string
  value: T
  onChange: (v: T) => void
  data: { value: T; label: string }[]
}) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <SegmentedControl
        aria-label={label}
        value={value}
        onChange={(v) => onChange(v as T)}
        data={data}
        style={{ '--sc-padding': '3px 7px', '--sc-font-size': '11px' } as React.CSSProperties}
      />
    </div>
  )
}

/** a body that scrolls on its own while the header stays: room for a hover ring at the edges */
export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex-1 min-h-0 overflow-y-auto scrollbar-thin -mx-1 px-1 ${className}`}>{children}</div>
}

// ── states ──────────────────────────────────────────────────────────────────

/** the house skeleton, shaped by `variant`: lines (a list), tiles (a grid of small cards) or a chart block */
export function CardLoading({ label = 'Loading…', rows = 3, variant = 'rows' }: { label?: string; rows?: number; variant?: 'rows' | 'tiles' | 'chart' }) {
  return (
    <div role="status" aria-live="polite" className="flex-1 min-h-0">
      <span className="sr-only">{label}</span>
      {variant === 'chart' ? (
        <div className="skeleton h-full min-h-16 w-full" aria-hidden />
      ) : variant === 'tiles' ? (
        <div className="grid grid-cols-2 gap-2" aria-hidden>
          {Array.from({ length: Math.max(2, rows) }).map((_, i) => <div key={i} className="skeleton h-12" />)}
        </div>
      ) : (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-7" style={{ width: `${100 - (i % 3) * 12}%` }} />)}
        </div>
      )}
    </div>
  )
}

/** nothing to show yet: what this is and, when there is one, the next step */
export function CardEmpty({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1.5 py-3 text-center">
      {icon && <div className="text-slate-500 mb-0.5">{icon}</div>}
      <p className="text-sm text-slate-400">{title}</p>
      {hint && <p className="text-xs text-slate-500 max-w-[34ch]">{hint}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  )
}

/** the request failed before any data arrived */
export function CardError({ title, error, onRetry }: { title?: string; error: Error | string | null | undefined; onRetry?: () => void }) {
  const text = error instanceof Error ? error.message : (error || 'Could not load')
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 py-3 text-center" role="alert">
      <AlertCircle size={18} className="text-rose-400" aria-hidden />
      {title && <p className="text-sm text-slate-400">{title}</p>}
      <p className="text-xs text-slate-500 max-w-[34ch] break-words">{text}</p>
      {onRetry && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onRetry() }} className={BTN_CARD_QUIET}>
          <RefreshCw size={12} /> Try again
        </button>
      )}
    </div>
  )
}

/** the dashboard is not connected and the card has nothing cached */
export function CardOffline() {
  return <CardEmpty icon={<ServerOff size={20} />} title="Not connected" hint="It fills in when the dashboard reaches the server." />
}

// ── the accents a person can pick for a shortcut, a bookmark … ───────────────

/** Accent colours a user can pick; class names are spelled out so Tailwind keeps them */
export const ACCENTS: Record<string, { text: string; bg: string; ring: string; dot: string }> = {
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10 group-hover:bg-emerald-500/15', ring: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  cyan:    { text: 'text-cyan-400',    bg: 'bg-cyan-500/10 group-hover:bg-cyan-500/15',       ring: 'border-cyan-500/20',    dot: 'bg-cyan-400' },
  violet:  { text: 'text-violet-400',  bg: 'bg-violet-500/10 group-hover:bg-violet-500/15',   ring: 'border-violet-500/20',  dot: 'bg-violet-400' },
  amber:   { text: 'text-amber-400',   bg: 'bg-amber-500/10 group-hover:bg-amber-500/15',     ring: 'border-amber-500/20',   dot: 'bg-amber-400' },
  rose:    { text: 'text-rose-400',    bg: 'bg-rose-500/10 group-hover:bg-rose-500/15',       ring: 'border-rose-500/20',    dot: 'bg-rose-400' },
  blue:    { text: 'text-blue-400',    bg: 'bg-blue-500/10 group-hover:bg-blue-500/15',       ring: 'border-blue-500/20',    dot: 'bg-blue-400' },
  teal:    { text: 'text-teal-400',    bg: 'bg-teal-500/10 group-hover:bg-teal-500/15',       ring: 'border-teal-500/20',    dot: 'bg-teal-400' },
  orange:  { text: 'text-orange-400',  bg: 'bg-orange-500/10 group-hover:bg-orange-500/15',   ring: 'border-orange-500/20',  dot: 'bg-orange-400' },
  pink:    { text: 'text-pink-400',    bg: 'bg-pink-500/10 group-hover:bg-pink-500/15',       ring: 'border-pink-500/20',    dot: 'bg-pink-400' },
  slate:   { text: 'text-slate-300',   bg: 'bg-slate-500/10 group-hover:bg-slate-500/15',     ring: 'border-slate-500/20',   dot: 'bg-slate-400' },
}
export const ACCENT_NAMES = Object.keys(ACCENTS)

/** Props every card receives from the grid (all optional so existing cards stay untouched) */
export interface CardCommonProps {
  cardConfig?: unknown
  onSaveConfig?: (cfg: unknown) => Promise<boolean> | void
  dashboardEditMode?: boolean
}
