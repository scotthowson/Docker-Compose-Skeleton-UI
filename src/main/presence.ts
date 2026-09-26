// =============================================================================
// Discord Rich Presence — "DCS · Managing <server>" on your Discord profile
// while the desktop app is open. Talks to the local Discord client over IPC;
// nothing leaves the machine except what Discord itself shows.
// =============================================================================

import { Client } from '@xhayper/discord-rpc'

export interface PresencePayload {
  /** first line, for example "Managing Howson-Ubuntu" */
  details: string
  /** second line, for example "17/17 containers · 9 stacks · healthy" */
  state: string
  /** asset key uploaded under the Discord application, or an https image URL */
  largeImageKey?: string
  largeImageText?: string
  smallImageKey?: string
  smallImageText?: string
  /** unix ms when this session started (shows "elapsed") */
  startTimestamp?: number
  buttons?: { label: string; url: string }[]
}

export interface PresenceStatus {
  enabled: boolean
  connected: boolean
  clientId: string
  error: string
  lastPayload: PresencePayload | null
}

const RECONNECT_MS = 30000
const MIN_UPDATE_MS = 15000

let client: Client | null = null
let clientId = ''
let enabled = false
let connected = false
let lastError = ''
let lastPayload: PresencePayload | null = null
let lastSentAt = 0
let pending: PresencePayload | null = null
let pendingTimer: ReturnType<typeof setTimeout> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let connecting = false

function clearTimers() {
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
}

async function destroyClient() {
  clearTimers()
  connected = false
  const c = client
  client = null
  if (c) {
    try { await c.user?.clearActivity() } catch { /* client may be gone */ }
    try { await c.destroy() } catch { /* ignore */ }
  }
}

function scheduleReconnect() {
  if (!enabled || reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void connect()
  }, RECONNECT_MS)
}

async function connect() {
  if (!enabled || !clientId || connecting || connected) return
  connecting = true
  try {
    const c = new Client({ clientId })
    c.on('ready', () => {
      connected = true
      lastError = ''
      if (lastPayload) void send(lastPayload, true)
    })
    c.on('disconnected', () => {
      connected = false
      if (client === c) scheduleReconnect()
    })
    await c.login()
    client = c
  } catch (err) {
    connected = false
    lastError = err instanceof Error ? err.message : String(err)
    scheduleReconnect()
  } finally {
    connecting = false
  }
}

async function send(payload: PresencePayload, force = false) {
  if (!client || !connected) return
  const now = Date.now()
  if (!force && now - lastSentAt < MIN_UPDATE_MS) {
    pending = payload
    if (!pendingTimer) {
      pendingTimer = setTimeout(() => {
        pendingTimer = null
        const p = pending
        pending = null
        if (p) void send(p, true)
      }, MIN_UPDATE_MS - (now - lastSentAt))
    }
    return
  }
  lastSentAt = now
  try {
    await client.user?.setActivity({
      details: payload.details.slice(0, 128),
      state: payload.state.slice(0, 128),
      largeImageKey: payload.largeImageKey,
      largeImageText: payload.largeImageText?.slice(0, 128),
      smallImageKey: payload.smallImageKey,
      smallImageText: payload.smallImageText?.slice(0, 128),
      startTimestamp: payload.startTimestamp,
      buttons: payload.buttons?.slice(0, 2),
      instance: false,
    })
    lastError = ''
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err)
    connected = false
    scheduleReconnect()
  }
}

/** Apply settings: turn the presence on or off, or switch the application. */
export async function configurePresence(opts: { enabled: boolean; clientId: string }) {
  const nextId = (opts.clientId || '').trim()
  const changed = nextId !== clientId || opts.enabled !== enabled
  enabled = opts.enabled && /^[0-9]{15,22}$/.test(nextId)
  clientId = nextId
  if (!changed) return
  await destroyClient()
  if (enabled) void connect()
}

/** Latest facts from the renderer; sent at most every 15 s (Discord's limit). */
export function updatePresence(payload: PresencePayload) {
  lastPayload = payload
  if (!enabled) return
  if (!connected) { void connect(); return }
  void send(payload)
}

export function presenceStatus(): PresenceStatus {
  return { enabled, connected, clientId, error: lastError, lastPayload }
}

export async function shutdownPresence() {
  enabled = false
  await destroyClient()
}
