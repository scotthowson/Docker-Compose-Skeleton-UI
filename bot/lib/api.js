// =============================================================================
// DCS API client for the bot: one session (renewed on 401), friendly errors,
// and short-lived caches for the lists autocomplete needs.
// =============================================================================

export class ApiError extends Error {
  constructor(message, status = 0, body = null) {
    super(message)
    this.status = status
    this.body = body
  }
}

export function createApi({ baseUrl, username, password, log = () => {} }) {
  const base = baseUrl.replace(/\/$/, '')
  let token = ''
  let loginInFlight = null
  const caches = new Map()

  async function login() {
    let r
    try {
      r = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
    } catch (err) {
      throw new ApiError(`I can't reach DCS at ${base} (${err.message}). Is the API running and is DCS_API_URL right?`)
    }
    const d = await r.json().catch(() => ({}))
    if (!r.ok || !d.token) throw new ApiError(d.message || `DCS refused the bot's sign-in (${r.status}). Check DCS_BOT_USERNAME and DCS_BOT_PASSWORD.`, r.status, d)
    token = d.token
    log(`signed in to DCS at ${base} as ${username}`)
  }

  // DCS can run in single-session mode (each sign-in revokes the previous
  // token), so parallel requests must share one sign-in instead of racing.
  async function ensureToken() {
    if (token) return token
    if (!loginInFlight) loginInFlight = login().finally(() => { loginInFlight = null })
    await loginInFlight
    return token
  }

  async function request(method, path, body) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const used = await ensureToken()
      let r
      try {
        r = await fetch(`${base}${path}`, {
          method,
          headers: { Authorization: `Bearer ${used}`, 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
      } catch (err) {
        throw new ApiError(`I can't reach DCS at ${base} (${err.message}).`)
      }
      if (r.status === 401 && attempt === 0) { if (token === used) token = ''; continue }
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        if (r.status === 403) throw new ApiError(`DCS said no: the bot's user "${username}" is not an admin. Give it the admin role on the Users page.`, 403, d)
        throw new ApiError(d.message || d.error || `${method} ${path} answered ${r.status}`, r.status, d)
      }
      return d
    }
    throw new ApiError('DCS kept refusing the session')
  }

  /** Cache a promise-returning function's result for ttlMs (per key). */
  async function cached(key, ttlMs, fn) {
    const hit = caches.get(key)
    if (hit && Date.now() - hit.t < ttlMs) return hit.v
    const v = await fn()
    caches.set(key, { t: Date.now(), v })
    return v
  }

  const api = {
    base,
    login,
    get: (path) => request('GET', path),
    post: (path, body = {}) => request('POST', path, body),
    put: (path, body = {}) => request('PUT', path, body),
    del: (path) => request('DELETE', path),
    cached,
    invalidate: (key) => (key ? caches.delete(key) : caches.clear()),
    /** Name lists for autocomplete (15 s cache) */
    names: {
      containers: () => cached('containers', 15000, async () => ((await request('GET', '/containers')).containers || [])),
      stacks: () => cached('stacks', 15000, async () => ((await request('GET', '/stacks')).stacks || [])),
      templates: () => cached('templates', 60000, async () => ((await request('GET', '/templates')).templates || [])),
      schedules: () => cached('schedules', 15000, async () => ((await request('GET', '/schedules')).schedules || [])),
      decisions: () => cached('decisions', 15000, async () => {
        try { return (await request('GET', '/crowdsec/decisions')).decisions || [] } catch { return [] }
      }),
    },
    /** Framework version, refreshed every 10 minutes */
    version: () => cached('version', 600000, async () => {
      try { return (await request('GET', '/version')).framework_version || '' } catch { return '' }
    }),
  }
  return api
}
