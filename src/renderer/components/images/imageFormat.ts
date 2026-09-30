// =============================================================================
// imageFormat — how the image table and the image cards write what `docker
// images` reports: a size that sorts by its bytes and a creation time that fits
// one line; and the key a row is selected by.
// =============================================================================

/** a selection or row key: the image on its DCS (the hub's rows have no member) */
export const imageKey = (i: { member?: string | null; id: string }) => `${i.member ?? ''}|${i.id}`

const UNIT = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 } as const

/** "152MB", "7.8MB", "1.2GB", "45kB" → bytes (0 when the text is not a size), so a size column sorts by its size and not by its digits */
export function sizeBytes(size: string): number {
  const m = /^\s*([\d.]+)\s*([a-z]*)\s*$/i.exec(size ?? '')
  if (!m) return 0
  const unit = UNIT[(m[2] || 'b').toLowerCase() as keyof typeof UNIT] ?? 1
  const n = parseFloat(m[1])
  return Number.isFinite(n) ? n * unit : 0
}

/** "2026-09-08 23:54:55 +0000 UTC" → "2026-09-08 23:54" (anything else as it came) */
export function shortCreated(created: string): string {
  const m = /^(\d{4}-\d\d-\d\d \d\d:\d\d)/.exec(created ?? '')
  return m ? m[1] : created
}
