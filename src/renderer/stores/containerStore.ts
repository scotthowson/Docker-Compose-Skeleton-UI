import { create } from 'zustand'
import { ContainerInfo, ContainerStats } from '../../shared/types'

interface ContainerState {
  containers: ContainerInfo[]
  stats: Record<string, ContainerStats>
  loading: boolean
  setContainers: (containers: ContainerInfo[]) => void
  setStats: (name: string, stats: ContainerStats) => void
  setLoading: (loading: boolean) => void
}

export const useContainerStore = create<ContainerState>((set) => ({
  containers: [],
  stats: {},
  loading: false,

  setContainers: (containers) => set({ containers }),
  setStats: (name, stats) =>
    set((state) => ({
      stats: { ...state.stats, [name]: stats },
    })),
  setLoading: (loading) => set({ loading }),
}))
