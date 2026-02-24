import { create } from 'zustand'
import { ServerStatus, SystemInfo, APIVersion } from '../../shared/types'

interface SystemState {
  status: ServerStatus | null
  system: SystemInfo | null
  version: APIVersion | null
  loading: boolean
  setStatus: (status: ServerStatus) => void
  setSystem: (system: SystemInfo) => void
  setVersion: (version: APIVersion) => void
  setLoading: (loading: boolean) => void
}

export const useSystemStore = create<SystemState>((set) => ({
  status: null,
  system: null,
  version: null,
  loading: false,

  setStatus: (status) => set({ status }),
  setSystem: (system) => set({ system }),
  setVersion: (version) => set({ version }),
  setLoading: (loading) => set({ loading }),
}))
