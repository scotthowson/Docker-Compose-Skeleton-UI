// =============================================================================
// A change being applied outlives the tab. Applying restarts CrowdSec, and while
// it restarts the page swaps this whole tab for "CrowdSec is starting", so the
// progress, and later the result, are kept here (in memory, per server) and the
// tab that comes back picks them up.
// =============================================================================

import { useAuthStore } from '../../stores/authStore'
import type { CrowdSecNotifyResponse } from '../../../shared/types'
import { draftMemory } from './NotifyModel'

export interface Outcome { kind: 'ok' | 'error' | 'info'; title: string; detail?: string; rolledBack?: boolean; stage?: string; status?: number; at: number }
export interface RunState {
  /** a change is on its way to CrowdSec since `at` (ms) */
  busy: { what: string; at: number } | null
  /** what the last change ended in, until it is dismissed */
  outcome: Outcome | null
  /** what CrowdSec answered with, and how many answers there have been (a tab takes over an answer that arrives while it is on screen) */
  res: CrowdSecNotifyResponse | null
  seq: number
  /** the answer belongs to an action that left the unsaved edits alone (removing the custom webhook) */
  keepDraft: boolean
  /** when the last change ended (ms), so an older refresh that answers late can be told from a newer answer */
  doneAt: number
}

const EMPTY: RunState = { busy: null, outcome: null, res: null, seq: 0, keepDraft: false, doneAt: 0 }
const runs = new Map<string, RunState>()
const subs = new Set<() => void>()
const key = (member: string | null): string => member ?? 'hub'

export const getRun = (member: string | null): RunState => runs.get(key(member)) ?? EMPTY
export function setRun(member: string | null, patch: Partial<RunState>): void {
  runs.set(key(member), { ...getRun(member), ...patch })
  subs.forEach((f) => f())
}
export function subscribeRun(f: () => void): () => void {
  subs.add(f)
  return () => { subs.delete(f) }
}
// what a person typed (a webhook address included) and what a change said belong to that person: they go when somebody signs out
useAuthStore.subscribe((s, prev) => { if (prev.isAuthenticated && !s.isAuthenticated) { runs.clear(); draftMemory.clearAll(); subs.forEach((f) => f()) } })
