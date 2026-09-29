// =============================================================================
// The dashboard's button scale — three sizes and an icon button, taken from the
// Proxmox page, where they were tried first. A button is a SHAPE (its size,
// radius and text) plus a TONE (its colours); the pairs pages need most come
// ready-made. Only classes the theme engine restyles (scripts/theme-classes.mjs
// lists them) — nothing here is a hex value.
//
//   toolbar  BTN_TOOLBAR    32 px (34 with its border; 40 on a phone): the buttons of a page's
//                           header and of a filter row — text-xs, an icon at 14
//   card     BTN_CARD       32 px: an action on a card, in a list row or in a panel — 11 px text, an icon at 12
//   sheet    BTN_SHEET      44 px: the buttons that end a sheet or a dialog (Cancel · Save) — text-sm
//   icon     BTN_ICON       36 px on a phone, 32 from sm up: a button that is only an icon (14) —
//            BTN_ICON_SM    32 px on a phone, 28 from sm up: the same in a dense row (12)
//
// An icon button takes a tone that draws its edge (TONE_QUIET · OK · DANGER) or a ghost tone (no edge:
// a row of icons in a list or a table).
//
//   <button className={BTN_TOOLBAR_QUIET}><RefreshCw size={14} /> Refresh</button>
//   <button className={`${BTN_ICON} ${TONE_DANGER}`} aria-label="Stop"><Square size={14} /></button>
//
// An icon-only button needs a name (aria-label) and a hint (components/common/Hint).
// =============================================================================

// ── shapes ──────────────────────────────────────────────────────────────────
export const BTN_TOOLBAR = 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50'
export const BTN_CARD = 'h-8 px-2.5 rounded-lg text-[11px] flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50'
export const BTN_SHEET = 'h-11 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60'
export const BTN_ICON = 'h-9 w-9 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors disabled:opacity-50'
export const BTN_ICON_SM = 'h-8 w-8 sm:h-7 sm:w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors disabled:opacity-50'

// ── tones ───────────────────────────────────────────────────────────────────
/** neutral: the button that is always there */
export const TONE_QUIET = 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
/** go: start, resume, confirm — emerald */
export const TONE_OK = 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/15'
/** destructive: stop, remove, reset — rose */
export const TONE_DANGER = 'bg-rose-500/5 border border-rose-500/20 text-rose-300 hover:bg-rose-500/15'

/** no edge: the icons of a list row or a table row */
export const TONE_GHOST = 'text-slate-300 hover:bg-white/10'
export const TONE_GHOST_OK = 'text-emerald-300 hover:bg-emerald-500/10'
export const TONE_GHOST_DANGER = 'text-rose-300 hover:bg-rose-500/10'

// ── the common pairs ────────────────────────────────────────────────────────
export const BTN_TOOLBAR_QUIET = `${BTN_TOOLBAR} ${TONE_QUIET}`
export const BTN_CARD_QUIET = `${BTN_CARD} ${TONE_QUIET}`
export const BTN_ICON_QUIET = `${BTN_ICON} ${TONE_QUIET}`
export const BTN_ICON_SM_QUIET = `${BTN_ICON_SM} ${TONE_QUIET}`
export const BTN_SHEET_QUIET = `${BTN_SHEET} ${TONE_QUIET}`
/** the sheet's main button: solid emerald, or rose where it destroys something */
export const BTN_SHEET_PRIMARY = `${BTN_SHEET} font-semibold text-white bg-emerald-600 hover:bg-emerald-500`
export const BTN_SHEET_DANGER = `${BTN_SHEET} font-semibold text-white bg-rose-600 hover:bg-rose-500`
