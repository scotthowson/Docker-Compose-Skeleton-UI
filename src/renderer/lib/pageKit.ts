// =============================================================================
// pageKit — the few class strings the inventory and monitoring pages share
// (Networks, Volumes, Disk Analysis, Diagnostics, Topology, Activity, Live
// Events, Logs, Bookmarks, File Browser), taken from the reference pages so
// that a card, a search field and a row's hover actions look the same on each.
// Buttons live in lib/ui.ts (the scale); this file holds what the scale does
// not cover. Only classes the theme engine restyles — nothing here is a hex.
// =============================================================================

/** a page-level card or tile (the Proxmox page's CARD) */
export const CARD = 'rounded-xl bg-white/[0.03] border border-white/5'

/** a card that leads somewhere: its edge firms up under the pointer */
export const CARD_HOVER = `${CARD} hover:border-white/10 transition-colors`

/** the search field above a list (the Containers page's); the icon sits at left-3, so the text starts at pl-10 */
export const SEARCH_FIELD = 'w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/30 transition-colors'

/** a form field inside a dialog or a card: the house input, an emerald ring on focus */
export const FIELD = 'w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors'

/** the ring a control without a field of its own shows when the keyboard is on it */
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40'

/**
 * Actions that appear when a row or card (a `group`) is pointed at or has the keyboard in it. On a device
 * without hover (a phone, a tablet) they are simply there — a hover-only button cannot be reached by touch.
 */
export const REVEAL = 'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 focus-visible:opacity-100'
