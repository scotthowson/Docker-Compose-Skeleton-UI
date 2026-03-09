import { create } from 'zustand'
import type { MetricsDataPoint, MetricsSummaryResponse } from '../../shared/types'
import * as api from '../api/endpoints'

interface MetricsState {
  history: MetricsDataPoint[]
  summary: MetricsSummaryResponse | null
  range: string
  loading: boolean
  error: string | null
  fetchHistory: (range?: string) => Promise<void>
  fetchSummary: (range?: string) => Promise<void>
  setRange: (range: string) => void
}

export const useMetricsStore = create<MetricsState>((set, get) => ({
  history: [],
  summary: null,
  range: '24h',
  loading: false,
  error: null,

  fetchHistory: async (range) => {
    const r = range || get().range
    set({ loading: true, error: null, range: r })
    try {
      const res = await api.fetchMetricsHistory(r)
      set({ history: res.metrics, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch metrics' })
    }
  },

  fetchSummary: async (range) => {
    const r = range || get().range
    try {
      const res = await api.fetchMetricsSummary(r)
      set({ summary: res })
    } catch { /* ignore */ }
  },

  setRange: (range) => {
    set({ range })
    get().fetchHistory(range)
    get().fetchSummary(range)
  },
}))
