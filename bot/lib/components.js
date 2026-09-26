// =============================================================================
// Buttons and confirmations. Every destructive action goes through confirm():
// the person who asked gets Confirm / Cancel buttons that only they can press,
// valid for 60 seconds.
// =============================================================================

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'

const pending = new Map()
let seq = 0

export function button(customId, label, style = ButtonStyle.Secondary, emoji) {
  const b = new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style)
  if (emoji) b.setEmoji(emoji)
  return b
}
export const link = (label, url, emoji) => { const b = new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(url); if (emoji) b.setEmoji(emoji); return b }
export const row = (...buttons) => new ActionRowBuilder().addComponents(buttons.filter(Boolean).slice(0, 5))
export const rows = (buttons) => { const out = []; for (let i = 0; i < buttons.length; i += 5) out.push(row(...buttons.slice(i, i + 5))); return out.slice(0, 5) }

/** Register an action awaiting confirmation; returns the two-button row. */
export function confirm({ userId, label, run, danger = true, ttlMs = 60000 }) {
  const id = `${Date.now().toString(36)}${(seq++).toString(36)}`
  const timer = setTimeout(() => pending.delete(id), ttlMs)
  pending.set(id, { userId, run, label, timer, expires: Date.now() + ttlMs })
  return {
    id,
    row: row(
      button(`confirm:${id}`, label, danger ? ButtonStyle.Danger : ButtonStyle.Primary),
      button(`cancel:${id}`, 'Cancel', ButtonStyle.Secondary),
    ),
  }
}

export const peekConfirmation = (id) => pending.get(id) || null

export function takeConfirmation(id) {
  const p = pending.get(id)
  if (!p) return null
  clearTimeout(p.timer)
  pending.delete(id)
  return p
}

export const Style = ButtonStyle
