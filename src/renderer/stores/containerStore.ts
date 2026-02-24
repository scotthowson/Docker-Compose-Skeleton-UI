import { create } from 'zustand'
import { ContainerInfo, ContainerStats } from '../../shared/types'

interface StatsHistoryEntry {
  time: number
  cpu: number
  mem: number
}

interface ContainerState {
  containers: ContainerInfo[]
  stats: Record<string, ContainerStats>
  statsHistory: Record<string, StatsHistoryEntry[]>
  loading: boolean
  setContainers: (containers: ContainerInfo[]) => void
  setStats: (name: string, stats: ContainerStats) => void
  pushStatsHistory: (name: string, cpu: number, mem: number) => void
  setLoading: (loading: boolean) => void
}

const MAX_HISTORY_ENTRIES = 60

export const useContainerStore = create<ContainerState>((set) => ({
  containers: [],
  stats: {},
  statsHistory: {},
  loading: false,

  setContainers: (containers) => set({ containers }),
  setStats: (name, stats) =>
    set((state) => ({
      stats: { ...state.stats, [name]: stats },
    })),
  pushStatsHistory: (name, cpu, mem) =>
    set((state) => {
      const existing = state.statsHistory[name] ?? []
      const entry: StatsHistoryEntry = { time: Date.now(), cpu, mem }
      const updated = [...existing, entry].slice(-MAX_HISTORY_ENTRIES)
      return {
        statsHistory: { ...state.statsHistory, [name]: updated },
      }
    }),
  setLoading: (loading) => set({ loading }),
}))
