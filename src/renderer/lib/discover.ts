// =============================================================================
// Server discovery — turn whatever the user typed into the API base URL that
// actually answers. People enter the dashboard's hostname
// (https://ui.example.com), a LAN address (192.168.1.10) or the API itself
// (…:9876); the API can sit directly on its port or behind the dashboard's
// /api proxy (Traefik → nginx → API). Every candidate is probed at once and
// the first one that identifies itself as the DCS API wins.
// =============================================================================

export interface DiscoveredServer {
  /** The API base URL to use (no trailing slash) */
  url: string
  /** Straight to the API port, or through the dashboard's /api proxy */
  via: 'direct' | 'proxy'
  version?: string
  authEnabled?: boolean
  /** false when the server still needs the setup wizard */
  initialized?: boolean
}

const PROBE_TIMEOUT_MS = 6000
const DEFAULT_PORT = 9876

/** Candidate base URLs, most likely first */
export function candidateUrls(input: string): string[] {
  const raw = input.trim().replace(/\/+$/, '')
  if (!raw) return []
  if (raw.startsWith('/')) return [raw] // relative: the dashboard's own proxy
  const m = raw.match(/^(https?):\/\/(.+)$/i)
  const scheme = m ? m[1].toLowerCase() : ''
  const rest = m ? m[2] : raw
  const host = rest.split('/')[0]
  const path = rest.slice(host.length)
  const hasPort = /:\d+$/.test(host)
  const bareHost = host.replace(/:\d+$/, '').toLowerCase()
  const local = /^(\d{1,3}\.){3}\d{1,3}$/.test(bareHost) || bareHost === 'localhost' || !bareHost.includes('.') || /\.(local|lan|home|internal)$/.test(bareHost)
  const schemes = scheme ? [scheme] : local ? ['http', 'https'] : ['https', 'http']
  const out: string[] = []
  for (const s of schemes) {
    const base = `${s}://${host}${path}`
    // A bare LAN address most likely means the API port itself
    if (local && !hasPort && !path) out.push(`${s}://${host}:${DEFAULT_PORT}`)
    out.push(base)
    if (!/\/api$/i.test(base)) out.push(`${base}/api`)
    if (!local && !hasPort && !path) out.push(`${s}://${host}:${DEFAULT_PORT}`)
  }
  // http typed for a public name: the site almost always redirects to https
  if (scheme === 'http' && !local) {
    const b = `https://${host}${path}`
    out.push(b)
    if (!/\/api$/i.test(b)) out.push(`${b}/api`)
  }
  return Array.from(new Set(out))
}

async function probe(url: string): Promise<DiscoveredServer | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS)
  try {
    const res = await fetch(`${url}/`, { method: 'GET', headers: { Accept: 'application/json' }, signal: ctrl.signal })
    if (!res.ok) return null
    let data: Record<string, unknown>
    try {
      data = JSON.parse(await res.text())
    } catch {
      return null // HTML — the dashboard page itself, not the API
    }
    const name = typeof data.name === 'string' ? data.name : ''
    if (!/docker compose skeleton/i.test(name) && !Array.isArray(data.endpoints)) return null
    const found: DiscoveredServer = {
      url,
      via: /\/api$/i.test(url) ? 'proxy' : 'direct',
      version: typeof data.version === 'string' ? data.version : undefined,
      authEnabled: data.auth_enabled === true,
    }
    try {
      const st = await fetch(`${url}/setup/status`, { method: 'GET', headers: { Accept: 'application/json' }, signal: ctrl.signal })
      if (st.ok) {
        const s = await st.json()
        if (typeof s.initialized === 'boolean') found.initialized = s.initialized
      }
    } catch {
      // the identity check already succeeded
    }
    return found
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Probe every candidate at once; the best one that answers wins */
export async function discoverServer(input: string): Promise<DiscoveredServer | null> {
  const cands = candidateUrls(input)
  if (cands.length === 0) return null
  const results = await Promise.all(cands.map(probe))
  return results.find((r): r is DiscoveredServer => r !== null) ?? null
}
