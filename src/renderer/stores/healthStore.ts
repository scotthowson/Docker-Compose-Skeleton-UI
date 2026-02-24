import { create } from 'zustand'
import { HealthReport } from '../../shared/types'

interface HealthState {
  report: HealthReport | null
  loading: boolean
  setReport: (report: HealthReport) => void
  setLoading: (loading: boolean) => void
}

export const useHealthStore = create<HealthState>((set) => ({
  report: null,
  loading: false,

  setReport: (report) => set({ report }),
  setLoading: (loading) => set({ loading }),
}))
