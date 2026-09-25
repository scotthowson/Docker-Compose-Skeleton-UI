import { create } from 'zustand'
import type { Schedule, ScheduleExecution } from '../../shared/types'
import * as api from '../api/endpoints'

interface ScheduleState {
  schedules: Schedule[]
  history: Record<string, ScheduleExecution[]>
  loading: boolean
  saving: boolean
  error: string | null
  fetchSchedules: () => Promise<void>
  createSchedule: (data: { name: string; schedule: string; action: string; target?: string }) => Promise<boolean>
  updateSchedule: (id: string, updates: Partial<Schedule>) => Promise<boolean>
  deleteSchedule: (id: string) => Promise<boolean>
  toggleSchedule: (id: string) => Promise<boolean>
  runSchedule: (id: string) => Promise<{ success: boolean; output: string } | null>
  fetchHistory: (id: string) => Promise<void>
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  history: {},
  loading: false,
  saving: false,
  error: null,

  fetchSchedules: async () => {
    set({ loading: true, error: null })
    try {
      const res = await api.fetchSchedules()
      set({ schedules: res.schedules, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch schedules' })
    }
  },

  createSchedule: async (data) => {
    set({ saving: true, error: null })
    try {
      await api.createSchedule(data)
      set({ saving: false })
      get().fetchSchedules()
      return true
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : 'Failed to create schedule' })
      return false
    }
  },

  updateSchedule: async (id, updates) => {
    set({ saving: true, error: null })
    try {
      await api.updateSchedule(id, updates)
      set({ saving: false })
      get().fetchSchedules()
      return true
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : 'Failed to update schedule' })
      return false
    }
  },

  deleteSchedule: async (id) => {
    set({ saving: true, error: null })
    try {
      await api.deleteSchedule(id)
      set(prev => ({ schedules: prev.schedules.filter(s => s.id !== id), saving: false }))
      return true
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : 'Failed to delete schedule' })
      return false
    }
  },

  toggleSchedule: async (id) => {
    try {
      const res = await api.toggleSchedule(id)
      // The server answers {success, id, enabled}: merge the flag, keep the entry
      const enabled = (res as { enabled?: boolean }).enabled
      set(prev => ({ schedules: prev.schedules.map(s => s.id === id ? { ...s, enabled: enabled ?? !s.enabled } : s) }))
      return true
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to toggle schedule' })
      return false
    }
  },

  runSchedule: async (id) => {
    try {
      const result = await api.runSchedule(id)
      get().fetchSchedules() // Refresh to update run_count and last_run
      get().fetchHistory(id) // Refresh history
      return result
    } catch { return null }
  },

  fetchHistory: async (id) => {
    try {
      const res = await api.fetchScheduleHistory(id)
      set(prev => ({ history: { ...prev.history, [id]: res.history } }))
    } catch { /* ignore */ }
  },
}))
