// =============================================================================
// A light world map: land as a grid of dots (a coarse mask that ships with the
// page, no map library, no tiles, no network), attackers as bubbles sized by
// their detections. Equirectangular, so a point is just (lon, lat) scaled.
// =============================================================================

import { useMemo, useState } from 'react'
import { LAND_COLS, LAND_ROWS, LAND_CELL, LAND_RLE } from './worldMapData'
import { countryName } from './kit'

export interface MapPoint { lat: number; lon: number; country: string; alerts: number; sources: number }

/** run-length text ("12,3;5,1;…": off-run, on-run, …) → the cells that are land */
function decodeLand(): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = []
  if (!LAND_RLE) return cells
  let i = 0
  let on = false
  for (const run of LAND_RLE.split(',')) {
    const n = parseInt(run, 10) || 0
    if (on) for (let k = 0; k < n; k++) { const at = i + k; cells.push({ x: at % LAND_COLS, y: Math.floor(at / LAND_COLS) }) }
    i += n
    on = !on
  }
  return cells
}
let landCache: string | null = null
/** one SVG path of zero-length dashes: with round caps each is a dot */
function landPath(): string {
  if (landCache !== null) return landCache
  landCache = decodeLand().map(({ x, y }) => `M${(x + 0.5) * LAND_CELL} ${(y + 0.5) * LAND_CELL}h0`).join('')
  return landCache
}

export default function WorldMap({ points }: { points: MapPoint[] }) {
  const [hot, setHot] = useState<number | null>(null)
  const W = LAND_COLS * LAND_CELL, H = LAND_ROWS * LAND_CELL
  const max = useMemo(() => Math.max(1, ...points.map((p) => p.alerts)), [points])
  const land = landPath()
  const proj = (lat: number, lon: number) => ({ x: ((lon + 180) / 360) * W, y: ((90 - lat) / 180) * H })
  const cur = hot !== null ? points[hot] : null
  return (
    <div>
      <div className="h-4 mb-1 text-[11px] text-slate-500 tabular-nums" aria-live="off">
        {cur ? <span className="text-slate-300">{countryName(cur.country) || cur.country || 'Unknown'} <span className="text-slate-500">· {cur.alerts} detection{cur.alerts === 1 ? '' : 's'} from {cur.sources} address{cur.sources === 1 ? '' : 'es'}</span></span> : <span>Where the addresses are, by GeoIP</span>}
      </div>
      <svg role="img" aria-label={`Map of ${points.length} attacking location${points.length === 1 ? '' : 's'}`} viewBox={`0 0 ${W} ${H}`} className="w-full block text-slate-500" style={{ aspectRatio: `${W} / ${H}`, maxHeight: 260 }}>
        {land ? <path d={land} stroke="currentColor" strokeOpacity="0.35" strokeWidth={LAND_CELL * 0.42} strokeLinecap="round" fill="none" /> : (
          <g stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.4" fill="none">
            {[-60, -30, 0, 30, 60].map((la) => <line key={la} x1="0" x2={W} y1={proj(la, 0).y} y2={proj(la, 0).y} />)}
            {[-120, -60, 0, 60, 120].map((lo) => <line key={lo} y1="0" y2={H} x1={proj(0, lo).x} x2={proj(0, lo).x} />)}
          </g>
        )}
        <g className="text-rose-400">
          {points.map((p, i) => {
            const { x, y } = proj(p.lat, p.lon)
            const r = 2.2 + 5.5 * Math.sqrt(p.alerts / max)
            return (
              <g key={`${p.country}-${i}`} tabIndex={0} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(i)} onBlur={() => setHot(null)} aria-label={`${countryName(p.country) || p.country}: ${p.alerts} detections`}>
                <circle cx={x} cy={y} r={r * 2} fill="currentColor" fillOpacity={hot === i ? 0.25 : 0.12} />
                <circle cx={x} cy={y} r={r} fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeOpacity="0.9" strokeWidth="0.6" />
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
