// =============================================================================
// useApiLink — is the DCS API answering right now?
//
// One answer for every place that says "healthy". A health report is a fact
// about the moment it was taken, so it may only be shown as the current state
// while the API answers; otherwise the page says what is going on instead of
// keeping the last "All Systems Healthy" on screen.
//
//   live          the API answers
//   trouble       connected, but the last checks or requests failed (a stalling API)
//   reconnecting  the link dropped and the dashboard is trying again on its own
//   offline       not connected, or the retries ran out: press Retry
// =============================================================================

import { useConnectionStore, MAX_RECONNECT_ATTEMPTS } from '../stores/connectionStore'
import type { ConnectionStatus } from '../../shared/types'

export type ApiLinkState = 'live' | 'trouble' | 'reconnecting' | 'offline'

export interface ApiLink {
  state: ApiLinkState
  live: boolean
  /** reconnect attempts so far (0 unless reconnecting) */
  attempts: number
  /** when the API last answered (ms), or null */
  lastConnected: number | null
  /** the headline where the health verdict would be */
  label: string
  /** the same in a word or two, for chips, the header and the cards */
  short: string
  /** one line under a headline: what is being done about it */
  detail: string
  /** what the page shows meanwhile */
  note: string
}

export function apiLinkOf(status: ConnectionStatus, attempts: number, pollFailures: number, heartbeatFailures: number, lastConnected: number | null): ApiLink {
  let state: ApiLinkState
  if (status === 'connected') state = pollFailures >= 2 || heartbeatFailures >= 1 ? 'trouble' : 'live'
  else if (status === 'connecting') state = 'reconnecting'
  else if (status === 'error') state = attempts >= MAX_RECONNECT_ATTEMPTS ? 'offline' : 'reconnecting'
  else state = 'offline'
  const base = { state, live: state === 'live', attempts, lastConnected, note: 'Showing the last known state' }
  switch (state) {
    case 'trouble': return { ...base, label: 'API not answering', short: 'Not answering', detail: 'The last check got no answer — trying again' }
    case 'reconnecting': return { ...base, label: 'API reconnecting…', short: 'Reconnecting…', detail: attempts > 1 ? `Trying again — attempt ${attempts}` : 'Trying again…' }
    case 'offline': return { ...base, label: 'API not connected', short: 'Offline', detail: 'The dashboard is not connected to the server' }
    default: return { ...base, label: 'Connected', short: 'Connected', detail: '', note: '' }
  }
}

export function useApiLink(): ApiLink {
  const status = useConnectionStore((s) => s.status)
  const attempts = useConnectionStore((s) => s.reconnectAttempts)
  const pollFailures = useConnectionStore((s) => s.consecutiveFailures)
  const heartbeatFailures = useConnectionStore((s) => s.heartbeatFailures)
  const lastConnected = useConnectionStore((s) => s.lastConnected)
  return apiLinkOf(status, attempts, pollFailures, heartbeatFailures, lastConnected)
}

/** "just now", "40 s ago", "3 min ago", "2 h ago" — or "" when there is nothing to say */
export function sinceText(ms: number | null | undefined, now: number = Date.now()): string {
  if (!ms) return ''
  const s = Math.max(0, Math.floor((now - ms) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s} s ago`
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}
