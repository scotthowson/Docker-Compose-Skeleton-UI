// =============================================================================
// stackActivity — a stack's start, stop and restart run in the background: the
// API answers "Starting X (background)" (a batch: "start queued") at once and
// the real outcome lands in GET /stacks/:name/activity. These helpers tell a
// background answer from a finished one, wait for the activity to end, and word
// the toast for how it ended.
// =============================================================================

import { fetchStackActivity } from '../api/endpoints'
import type { StackActivityResponse } from '../../shared/types'

export type StackOp = 'start' | 'stop' | 'restart' | 'update'

const GERUND: Record<StackOp, string> = { start: 'Starting', stop: 'Stopping', restart: 'Restarting', update: 'Updating' }
const DONE: Record<StackOp, string> = { start: 'started', stop: 'stopped', restart: 'restarted', update: 'updated' }

/** "Starting X (background)" / "start queued": the answer came before anything ran */
export function startedInBackground(text: string | null | undefined): boolean {
  return typeof text === 'string' && /(\(background\)|\bqueued)\s*$/i.test(text)
}

/** "Starting", "Stopping", … */
export function opGerund(op: StackOp): string { return GERUND[op] }

/**
 * Poll the stack's activity (every 2 s, up to 2 min by default) until the background action is over. Resolves to
 * the last activity read; null when the API never answered. The runner writes its record before the action's
 * answer goes out, so the first read already belongs to this run.
 */
export async function waitForStackActivity(name: string, member?: string | null, opts: { intervalMs?: number; timeoutMs?: number } = {}): Promise<StackActivityResponse | null> {
  const interval = opts.intervalMs ?? 2000
  const deadline = Date.now() + (opts.timeoutMs ?? 120_000)
  let last: StackActivityResponse | null = null
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval))
    try {
      last = await fetchStackActivity(name, member)
    } catch {
      continue   // a read that failed is not the end: ask again
    }
    if (!last.active) return last
  }
  return last
}

/**
 * The toast for the end of a background action: success when the runner says so, the error (or the phase it ended
 * in) when it failed, a warning when the wait gave up while it was still running.
 */
export function activityOutcome(a: StackActivityResponse | null, stack: string, op: StackOp): { type: 'success' | 'error' | 'warning'; message: string; duration?: number } {
  if (!a || a.active) return { type: 'warning', message: `${stack}: still ${GERUND[op].toLowerCase()} — see the stack's activity for the outcome`, duration: 6000 }
  if (a.success) return { type: 'success', message: `${stack}: ${DONE[op]}` }
  const why = a.error || a.services.find((s) => s.detail)?.detail || `ended in "${a.phase}"`
  return { type: 'error', message: `${stack}: ${op} failed — ${why}`, duration: 8000 }
}
