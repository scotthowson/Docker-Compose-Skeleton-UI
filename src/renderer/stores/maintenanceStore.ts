import { create } from 'zustand'
import type { MaintenanceReport, OrphanReport, DiskAnalysis } from '../../shared/types'

interface MaintenanceState {
  report: MaintenanceReport | null
  orphans: OrphanReport | null
  disk: DiskAnalysis | null
  actionLoading: string | null
  setReport: (report: MaintenanceReport) => void
  setOrphans: (orphans: OrphanReport) => void
  setDisk: (disk: DiskAnalysis) => void
  setActionLoading: (action: string | null) => void
}

export const useMaintenanceStore = create<MaintenanceState>((set) => ({
  report: null,
  orphans: null,
  disk: null,
  actionLoading: null,

  setReport: (report) => set({ report }),
  setOrphans: (orphans) => set({ orphans }),
  setDisk: (disk) => set({ disk }),
  setActionLoading: (action) => set({ actionLoading: action }),
}))
