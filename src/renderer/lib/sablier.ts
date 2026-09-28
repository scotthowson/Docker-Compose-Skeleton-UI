// =============================================================================
// On demand (Sablier) — the choices the deploy sheet and the container dialog
// share: how long a container may idle, which waiting page visitors see
// =============================================================================

export interface SablierOptions {
  /** idle time before the container is stopped, Go duration ("30m", "2h") */
  session: string
  /** waiting page: ghost, shuffle, hacker-terminal, matrix */
  theme: string
  showDetails: boolean
}

export const SABLIER_DEFAULTS: SablierOptions = { session: '30m', theme: 'ghost', showDetails: true }
export const SABLIER_SESSIONS = ['5m', '15m', '30m', '1h', '2h', '6h', '12h']
export const SABLIER_THEMES = ['ghost', 'shuffle', 'hacker-terminal', 'matrix']

/** one line per waiting page, for the picker */
export const SABLIER_THEME_NOTES: Record<string, string> = {
  ghost: 'a calm page with a spinner',
  shuffle: 'letters shuffle into the name',
  'hacker-terminal': 'a green terminal that types',
  matrix: 'falling code',
}

/** "30m" → "30 minutes", "1h" → "1 hour", "2h" → "2 hours" */
export function describeSession(s: string): string {
  const m = /^(\d+)([smh])$/.exec(s)
  if (!m) return s
  const n = parseInt(m[1], 10)
  const unit = m[2] === 'h' ? 'hour' : m[2] === 'm' ? 'minute' : 'second'
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}
