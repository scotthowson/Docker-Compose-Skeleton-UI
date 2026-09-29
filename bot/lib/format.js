// =============================================================================
// House style for every embed the bot sends: the dashboard's palette, one
// author line naming the server, a slim footer, bars that line up, and small
// helpers so every command reads the same way.
// =============================================================================

import { EmbedBuilder } from 'discord.js'

export const COLORS = {
  ok: 0x34d399,      // emerald: everything fine
  warn: 0xf59e0b,    // amber: needs a look
  bad: 0xf43f5e,     // rose: broken
  info: 0x22d3ee,    // cyan: information
  violet: 0xa78bfa,  // violet: backups and housekeeping
  slate: 0x64748b,   // slate: neutral
}

const BRAND = 'https://raw.githubusercontent.com/scotthowson/dcs-orchestrator-ui/v2.0.0/brand/discord'
export const ICONS = {
  app: `${BRAND}/app-icon.png`,
  bot: `${BRAND}/bot-avatar.png`,
}

/** ▰▰▰▰▱▱▱▱▱▱ — proportional-font safe (both glyphs share one width) */
export function bar(pct, width = 10) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0))
  const n = Math.round((p / 100) * width)
  return '▰'.repeat(n) + '▱'.repeat(width - n)
}

export function pctColor(pct) {
  return pct >= 90 ? COLORS.bad : pct >= 75 ? COLORS.warn : COLORS.ok
}

/** 29h · 3d 4h · 12m · 45s */
export function since(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0))
  if (!s) return '—'
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  if (d) return h ? `${d}d ${h}h` : `${d}d`
  if (h) return m ? `${h}h ${m}m` : `${h}h`
  if (m) return `${m}m`
  return `${s}s`
}

/** Discord renders <t:…:R> as "2 hours ago" in the reader's own timezone */
export const rel = (epochSeconds) => (epochSeconds ? `<t:${Math.floor(epochSeconds)}:R>` : '—')
export const when = (epochSeconds) => (epochSeconds ? `<t:${Math.floor(epochSeconds)}:f>` : '—')
export const epochOf = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? Math.floor(t / 1000) : 0 }

export const plural = (n, word, words = `${word}s`) => `${n} ${n === 1 ? word : words}`
export const gb = (mb) => `${(Number(mb) / 1024).toFixed(Number(mb) >= 10240 ? 0 : 1)} GB`
export const bold = (s) => `**${String(s ?? '').replace(/\*/g, '')}**`
export const code = (s) => '`' + String(s ?? '').replace(/`/g, "'") + '`'
export const truncate = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s }

/** Fenced block that stays under Discord's limits */
export function codeBlock(text, max = 1800, lang = '') {
  let t = String(text ?? '').replace(/```/g, "'''").trim()
  if (t.length > max) t = '…' + t.slice(-max)
  return '```' + lang + '\n' + (t || '(empty)') + '\n```'
}

/** Join lines but never exceed an embed field's 1024 characters */
export function lines(items, max = 1024, moreWord = 'more') {
  const out = []
  let used = 0
  for (const l of items) {
    if (used + l.length + 1 > max - 24) { out.push(`… ${plural(items.length - out.length, moreWord)}`); break }
    out.push(l); used += l.length + 1
  }
  return out.join('\n') || '—'
}

/** State glyph shared by every list */
export function dot(c) {
  if (c.state !== 'running') return c.on_demand ? '💤' : '⚫'
  if (c.health === 'unhealthy') return '🟠'
  if (c.state === 'restarting') return '🔁'
  return '🟢'
}

export function stateWord(c) {
  if (c.state !== 'running') return c.on_demand ? 'sleeping (on demand)' : c.state || 'stopped'
  if (c.health === 'unhealthy') return 'unhealthy'
  if (c.health === 'starting') return 'starting'
  return c.health && c.health !== 'none' ? c.health : 'running'
}

/** Parse "916G", "480M", "1.5T", "2.827GB" into bytes */
export function parseSize(s) {
  const m = String(s ?? '').trim().match(/^([\d.]+)\s*([KMGTP]?)(i?B)?$/i)
  if (!m) return 0
  const mult = { '': 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4, P: 1024 ** 5 }[m[2].toUpperCase()] || 1
  return parseFloat(m[1]) * mult
}
export function fmtBytes(b) {
  b = Number(b) || 0
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++ }
  return `${b.toFixed(b >= 100 || i === 0 ? 0 : 1)} ${u[i]}`
}

/**
 * The one embed factory. ctx = { server, dashboard, version }.
 * author = server name with the DCS icon (links to the dashboard),
 * footer = "DCS v3.5.0 · note", timestamp = now.
 */
export function embed(ctx, { title, description, color = COLORS.info, fields = [], thumbnail, url, footer } = {}) {
  const e = new EmbedBuilder().setColor(color).setTimestamp()
  const author = { name: ctx.server || 'DCS', iconURL: ICONS.app }
  if (ctx.dashboard) author.url = ctx.dashboard
  e.setAuthor(author)
  if (title) e.setTitle(truncate(title, 256))
  if (description) e.setDescription(truncate(description, 4000))
  if (url || ctx.dashboard) e.setURL(url || ctx.dashboard)
  if (thumbnail) e.setThumbnail(thumbnail)
  const fs = fields.filter((f) => f && f.value !== undefined && f.value !== null && String(f.value).trim() !== '')
    .slice(0, 25).map((f) => ({ name: truncate(f.name, 256), value: truncate(String(f.value), 1024), inline: !!f.inline }))
  if (fs.length) e.addFields(fs)
  const ver = ctx.version ? `DCS v${ctx.version}` : 'DCS'
  e.setFooter({ text: footer ? `${ver} · ${footer}` : ver })
  return e
}

/** A one-line result embed: ✅ / ⚠️ / ❌ */
export function result(ctx, ok, text, detail = '') {
  return embed(ctx, {
    description: `${ok === true ? '✅' : ok === 'warn' ? '⚠️' : '❌'} ${text}${detail ? `\n${detail}` : ''}`,
    color: ok === true ? COLORS.ok : ok === 'warn' ? COLORS.warn : COLORS.bad,
  })
}
