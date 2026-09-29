// =============================================================================
// A message drawn the way Discord draws it: the sender with its avatar and APP
// badge, the text above the embed (mentions become pills), the embed with its
// coloured bar, title, description, fields (side by side when inline), footer
// and time. Discord's own palette is used on purpose (dark and light), so the
// colours here are fixed hex values. The text is drawn through React elements
// only, `**bold**`, `` `code` ``, links, flags, mentions and <t:…> stamps
// included, never through innerHTML.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { DiscordEmbed, DiscordWebhookPayload } from '../../../shared/types'
import { countryName, flagEmoji, flagsSupported } from './kit'
import { intToHex } from './NotifyModel'

interface Palette {
  chat: string; embed: string; text: string; strong: string; title: string; muted: string; foot: string; link: string
  code: string; pill: string; pillText: string; stamp: string; rule: string; app: string
}
const PALETTE: Record<'dark' | 'light', Palette> = {
  dark: { chat: '#313338', embed: '#2b2d31', text: '#dbdee1', strong: '#f2f3f5', title: '#ffffff', muted: '#949ba4', foot: '#b5bac1', link: '#00a8fc', code: '#1e1f22', pill: 'rgba(88,101,242,0.3)', pillText: '#c9cdfb', stamp: 'rgba(78,80,88,0.55)', rule: 'rgba(255,255,255,0.06)', app: '#5865f2' },
  light: { chat: '#ffffff', embed: '#f2f3f5', text: '#313338', strong: '#060607', title: '#060607', muted: '#5c5e66', foot: '#4e5058', link: '#006ce7', code: '#e3e5e8', pill: 'rgba(88,101,242,0.15)', pillText: '#505cdc', stamp: 'rgba(6,6,7,0.06)', rule: 'rgba(6,6,7,0.1)', app: '#5865f2' },
}
const FONT = "'gg sans', Inter, 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const MONO = "Consolas, 'Andale Mono WT', 'Andale Mono', 'Lucida Console', 'Lucida Sans Typewriter', 'DejaVu Sans Mono', monospace"

// ---------------------------------------------------------------------------
// The inline text
// ---------------------------------------------------------------------------

// 1 bold · 2 underline · 3 strike · 4 code · 5-6 link · 7 flag · 8-9 <t:…> · 10 role · 11 user · 12 @everyone/@here · 13 bare address · 14 italic * · 15 italic _
const INLINE = /\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|`([^`\n]+)`|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|:flag_([a-z]{2}):|<t:(\d{1,12})(?::([tTdDfFR]))?>|<@&(\d{1,25})>|<@!?(\d{1,25})>|(@everyone|@here)|(https?:\/\/[^\s<>]*[^\s<>.,;:!?)'"\]])|\*([^*\n]+?)\*|_([^_\n]+?)_/g

const isWord = (c: string | undefined): boolean => !!c && /[A-Za-z0-9]/.test(c)

function relative(sec: number): string {
  const d = sec - Math.floor(Date.now() / 1000)
  const a = Math.abs(d)
  if (a < 45) return d <= 0 ? 'a few seconds ago' : 'in a few seconds'
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (a < 3600) return rtf.format(Math.round(d / 60), 'minute')
  if (a < 86400) return rtf.format(Math.round(d / 3600), 'hour')
  if (a < 86400 * 30) return rtf.format(Math.round(d / 86400), 'day')
  return rtf.format(Math.round(d / (86400 * 30)), 'month')
}
function stamp(sec: number, style: string): string {
  const dt = new Date(sec * 1000)
  switch (style) {
    case 't': return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    case 'T': return dt.toLocaleTimeString()
    case 'd': return dt.toLocaleDateString()
    case 'D': return dt.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
    case 'F': return dt.toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })
    case 'R': return relative(sec)
    default: return dt.toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })
  }
}

function Flag({ cc, p }: { cc: string; p: Palette }) {
  if (flagsSupported()) return <span title={countryName(cc)}>{flagEmoji(cc)}</span>
  return <span title={countryName(cc)} style={{ fontSize: 10, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: p.stamp, color: p.text }}>{cc.toUpperCase()}</span>
}

function Pill({ children, p }: { children: ReactNode; p: Palette }) {
  return <span style={{ background: p.pill, color: p.pillText, borderRadius: 3, padding: '0 2px', fontWeight: 500 }}>{children}</span>
}

export function inline(text: string, p: Palette, k = 'i', depth = 0): ReactNode[] {
  const out: ReactNode[] = []
  if (!text) return out
  const re = new RegExp(INLINE.source, 'g')
  let last = 0
  let m: RegExpExecArray | null
  let n = 0
  const push = (node: ReactNode) => out.push(<span key={`${k}-${n++}`}>{node}</span>)
  while ((m = re.exec(text)) !== null) {
    if (m[15] !== undefined && (isWord(text[m.index - 1]) || isWord(text[m.index + m[0].length]))) { re.lastIndex = m.index + 1; continue }
    if (m.index > last) push(text.slice(last, m.index))
    last = m.index + m[0].length
    const sub = (s: string) => (depth < 4 ? inline(s, p, `${k}-${n}`, depth + 1) : s)
    if (m[1] !== undefined) push(<strong style={{ fontWeight: 700, color: p.strong }}>{sub(m[1])}</strong>)
    else if (m[2] !== undefined) push(<span style={{ textDecoration: 'underline' }}>{sub(m[2])}</span>)
    else if (m[3] !== undefined) push(<span style={{ textDecoration: 'line-through' }}>{sub(m[3])}</span>)
    else if (m[4] !== undefined) push(<span style={{ background: p.code, borderRadius: 3, padding: '0 4px', fontFamily: MONO, fontSize: '0.85em', color: p.text }}>{m[4]}</span>)
    else if (m[5] !== undefined) push(<a href={m[6]} target="_blank" rel="noopener noreferrer" style={{ color: p.link, textDecoration: 'none' }}>{sub(m[5])}</a>)
    else if (m[7] !== undefined) push(<Flag cc={m[7]} p={p} />)
    else if (m[8] !== undefined) push(<span title={stamp(Number(m[8]), 'F')} style={{ background: p.stamp, borderRadius: 3, padding: '0 2px' }}>{stamp(Number(m[8]), m[9] || 'f')}</span>)
    else if (m[10] !== undefined) push(<Pill p={p}>@role</Pill>)
    else if (m[11] !== undefined) push(<Pill p={p}>@user</Pill>)
    else if (m[12] !== undefined) push(<Pill p={p}>{m[12]}</Pill>)
    else if (m[13] !== undefined) push(<a href={m[13]} target="_blank" rel="noopener noreferrer" style={{ color: p.link, textDecoration: 'none' }}>{m[13]}</a>)
    else if (m[14] !== undefined) push(<em>{sub(m[14])}</em>)
    else if (m[15] !== undefined) push(<em>{sub(m[15])}</em>)
    if (m[0].length === 0) re.lastIndex++
  }
  if (last < text.length) push(text.slice(last))
  return out
}

// ---------------------------------------------------------------------------
// The pieces
// ---------------------------------------------------------------------------

function Avatar({ url, name, p }: { url?: string; name: string; p: Palette }) {
  const [failed, setFailed] = useState(false)
  const show = !!url && /^https:\/\//.test(url) && !failed
  return (
    <div aria-hidden="true" style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: p.app, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, overflow: 'hidden' }}>
      {(name || '?').trim().charAt(0).toUpperCase()}
      {show && <img src={url} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
    </div>
  )
}

/** inline fields sit side by side, up to `max` in a row (three where there is room, fewer on a narrow screen); the others take the whole width */
function layoutFields(fields: NonNullable<DiscordEmbed['fields']>, max: number): { name: string; value: string; span: number }[] {
  const out: { name: string; value: string; span: number }[] = []
  let run: typeof fields = []
  const flush = () => {
    for (let i = 0; i < run.length; i += max) {
      const row = run.slice(i, i + max)
      for (const f of row) out.push({ name: f.name, value: f.value, span: 12 / row.length })
    }
    run = []
  }
  for (const f of fields) {
    if (f.inline) run.push(f)
    else { flush(); out.push({ name: f.name, value: f.value, span: 12 }) }
  }
  flush()
  return out
}

function EmbedView({ e, p, cols }: { e: DiscordEmbed; p: Palette; cols: number }) {
  const bar = typeof e.color === 'number' ? intToHex(e.color) : p.rule
  const fields = layoutFields(e.fields ?? [], cols)
  const time = e.timestamp ? new Date(e.timestamp) : null
  const footer = [e.footer?.text, time && !Number.isNaN(time.getTime()) ? time.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null].filter((x) => x).join(' • ')
  return (
    <div style={{ display: 'flex', marginTop: 6, maxWidth: 520, borderRadius: 4, overflow: 'hidden', background: p.embed, border: `1px solid ${p.rule}`, borderLeft: 'none' }}>
      <div style={{ width: 4, flexShrink: 0, background: bar }} />
      <div style={{ padding: '8px 16px 16px 12px', minWidth: 0, flex: 1, fontSize: 14, lineHeight: '1.375rem', color: p.text }}>
        {e.title && (
          <div style={{ marginTop: 8, fontSize: 16, fontWeight: 600, lineHeight: '1.375rem', color: e.url ? p.link : p.title, overflowWrap: 'anywhere' }}>
            {e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ color: p.link, textDecoration: 'none' }}>{inline(e.title, p, 'et')}</a> : inline(e.title, p, 'et')}
          </div>
        )}
        {e.description && <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{inline(e.description, p, 'ed')}</div>}
        {fields.length > 0 && (
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 8 }}>
            {fields.map((f, i) => (
              <div key={i} style={{ gridColumn: `span ${f.span}`, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: p.strong, overflowWrap: 'anywhere' }}>{inline(f.name, p, `fn${i}`)}</div>
                <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{inline(f.value, p, `fv${i}`)}</div>
              </div>
            ))}
          </div>
        )}
        {footer && <div style={{ marginTop: 8, fontSize: 12, lineHeight: '1rem', fontWeight: 500, color: p.foot, overflowWrap: 'anywhere' }}>{inline(footer, p, 'ef')}</div>}
      </div>
    </div>
  )
}

/** the whole message: sender, text, embeds */
export function DiscordMessage({ payload, dark = true, dim = false, label = 'Preview of the Discord message' }: { payload: DiscordWebhookPayload; dark?: boolean; dim?: boolean; label?: string }) {
  const p = PALETTE[dark ? 'dark' : 'light']
  const name = payload.username || 'Webhook'
  // the width decides how many inline fields fit in a row
  const root = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(3)
  useEffect(() => {
    const el = root.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => { const w = entry.contentRect.width; setCols(w < 300 ? 1 : w < 420 ? 2 : 3) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const box: CSSProperties = { background: p.chat, color: p.text, fontFamily: FONT, borderRadius: 8, padding: '14px 16px', opacity: dim ? 0.55 : 1, transition: 'opacity .15s', minWidth: 0 }
  return (
    <div ref={root} role="img" aria-label={label} style={box}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Avatar url={payload.avatar_url} name={name} p={p} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', lineHeight: '1.25rem' }}>
            <span style={{ fontWeight: 600, fontSize: 16, color: p.strong, overflowWrap: 'anywhere' }}>{name}</span>
            <span style={{ background: p.app, color: '#ffffff', fontSize: 10, fontWeight: 600, lineHeight: '15px', padding: '0 5px', borderRadius: 3, textTransform: 'uppercase' }}>App</span>
            <span style={{ fontSize: 12, color: p.muted }}>Today at {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
          {payload.content && <div style={{ fontSize: 16, lineHeight: '1.375rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{inline(payload.content, p, 'c')}</div>}
          {(payload.embeds ?? []).map((e, i) => <EmbedView key={i} e={e} p={p} cols={cols} />)}
        </div>
      </div>
    </div>
  )
}
