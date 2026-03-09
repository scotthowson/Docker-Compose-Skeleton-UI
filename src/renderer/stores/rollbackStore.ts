import { create } from 'zustand'
import type { RollbackSnapshot, RollbackSnapshotDetail, RollbackDiffResponse } from '../../shared/types'
import * as api from '../api/endpoints'

interface RollbackState {
  snapshots: Record<string, RollbackSnapshot[]>
  selectedSnapshot: RollbackSnapshotDetail | null
  diff: RollbackDiffResponse | null
  loading: boolean
  restoring: boolean
  error: string | null
  fetchSnapshots: (stack: string) => Promise<void>
  fetchSnapshotDetail: (stack: string, id: string) => Promise<void>
  fetchDiff: (stack: string, id: string) => Promise<void>
  restore: (stack: string, snapshotId: string) => Promise<boolean>
  clearSelection: () => void
}

export const useRollbackStore = create<RollbackState>((set) => ({
  snapshots: {},
  selectedSnapshot: null,
  diff: null,
  loading: false,
  restoring: false,
  error: null,

  fetchSnapshots: async (stack) => {
    set({ loading: true, error: null })
    try {
      const res = await api.fetchRollbackSnapshots(stack)
      set(prev => ({ snapshots: { ...prev.snapshots, [stack]: res.snapshots }, loading: false }))
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch snapshots' })
    }
  },

  fetchSnapshotDetail: async (stack, id) => {
    set({ loading: true, error: null })
    try {
      const detail = await api.fetchRollbackSnapshot(stack, id)
      set({ selectedSnapshot: detail, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch snapshot' })
    }
  },

  fetchDiff: async (stack, id) => {
    set({ loading: true, error: null })
    try {
      const diff = await api.fetchRollbackDiff(stack, id)
      set({ diff, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch diff' })
    }
  },

  restore: async (stack, snapshotId) => {
    set({ restoring: true, error: null })
    try {
      const res = await api.restoreRollbackSnapshot(stack, snapshotId)
      set({ restoring: false })
      return res.success
    } catch (err) {
      set({ restoring: false, error: err instanceof Error ? err.message : 'Restore failed' })
      return false
    }
  },

  clearSelection: () => set({ selectedSnapshot: null, diff: null }),
}))
