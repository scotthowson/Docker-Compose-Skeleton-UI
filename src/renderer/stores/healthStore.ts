import { create } from 'zustand'
import { HealthReport } from '../../shared/types'

interface HealthState {
  report: HealthReport | null
  loading: boolean
  /** why the last poll failed; cleared by the next report */
  error: string | null
  setReport: (report: HealthReport | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useHealthStore = create<HealthState>((set) => ({
  report: null,
  loading: false,
  error: null,

  setReport: (report) => set({ report, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
