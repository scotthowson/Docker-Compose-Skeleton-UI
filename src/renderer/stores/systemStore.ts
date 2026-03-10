import { create } from 'zustand'
import { ServerStatus, SystemInfo, APIVersion } from '../../shared/types'

const SPARK_MAX = 20

export interface MetricHistory {
  stacks: number[]
  containers: number[]
  health: number[]
  cpu: number[]
  mem: number[]
}

interface SystemState {
  status: ServerStatus | null
  system: SystemInfo | null
  version: APIVersion | null
  loading: boolean
  metricHistory: MetricHistory
  setStatus: (status: ServerStatus | null) => void
  setSystem: (system: SystemInfo) => void
  setVersion: (version: APIVersion) => void
  setLoading: (loading: boolean) => void
  pushMetrics: (vals: { stacks?: number; containers?: number; health?: number; cpu?: number; mem?: number }) => void
}

function pushToRing(arr: number[], val: number): number[] {
  const next = [...arr, val]
  return next.length > SPARK_MAX ? next.slice(next.length - SPARK_MAX) : next
}

export const useSystemStore = create<SystemState>((set) => ({
  status: null,
  system: null,
  version: null,
  loading: false,
  metricHistory: { stacks: [], containers: [], health: [], cpu: [], mem: [] },

  setStatus: (status) => set({ status }),
  setSystem: (system) => set({ system }),
  setVersion: (version) => set({ version }),
  setLoading: (loading) => set({ loading }),
  pushMetrics: (vals) => set((state) => {
    const h = { ...state.metricHistory }
    if (vals.stacks !== undefined) h.stacks = pushToRing(h.stacks, vals.stacks)
    if (vals.containers !== undefined) h.containers = pushToRing(h.containers, vals.containers)
    if (vals.health !== undefined) h.health = pushToRing(h.health, vals.health)
    if (vals.cpu !== undefined) h.cpu = pushToRing(h.cpu, vals.cpu)
    if (vals.mem !== undefined) h.mem = pushToRing(h.mem, vals.mem)
    return { metricHistory: h }
  }),
}))
