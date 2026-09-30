// =============================================================================
// The form pieces of the pages that draw their own fields (Settings, the themes
// panel, Notifications): a text field, its label, the keyboard focus ring of
// what is not a field, the chip a choice among a few is drawn with, and the
// sub-heading inside a section card. Class strings only, in colours the theme
// engine restyles (scripts/theme-classes.mjs lists them).
//
//   <label htmlFor="x" className={LABEL}>Display name</label>
//   <input id="x" className={INPUT} />
//   <button role="radio" aria-checked={on} className={`${CHOICE} ${on ? CHOICE_ON : CHOICE_OFF}`}>Dark</button>
//
// A field keeps its own focus state (emerald border + ring); a button that is
// not styled by lib/ui takes FOCUS_RING.
// =============================================================================
import { BTN_TOOLBAR } from './ui'

/** a text field, select or text area: 36 px, text-sm, an emerald ring on focus */
export const FIELD = 'px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors'
/** the same, as wide as its column */
export const INPUT = `w-full ${FIELD}`
/** the label above a field */
export const LABEL = 'block text-xs font-medium text-slate-400 mb-1.5'
/** the small capitals label above a group of fields, in a form or a panel (CSS shows it in capitals) */
export const CAPTION = 'block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5'
/** a keyboard focus ring for what is not a field (a chip, a swatch, a link drawn as a button) */
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40'
/** one choice among a few (Auto-lock, Session duration, Mode…): toolbar size; the chosen one is emerald */
export const CHOICE = `${BTN_TOOLBAR} border`
export const CHOICE_ON = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
export const CHOICE_OFF = 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10'
/** a sub-heading inside a section card */
export const SUBHEAD = 'text-xs font-semibold text-slate-300 uppercase tracking-wider'
