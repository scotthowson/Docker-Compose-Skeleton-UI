import { create } from 'zustand'
import { NetworkInfo, VolumeInfo } from '../../shared/types'

interface NetworkState {
  networks: NetworkInfo[]
  volumes: VolumeInfo[]
  loading: boolean
  setNetworks: (networks: NetworkInfo[]) => void
  setVolumes: (volumes: VolumeInfo[]) => void
  setLoading: (loading: boolean) => void
}

export const useNetworkStore = create<NetworkState>((set) => ({
  networks: [],
  volumes: [],
  loading: false,

  setNetworks: (networks) => set({ networks }),
  setVolumes: (volumes) => set({ volumes }),
  setLoading: (loading) => set({ loading }),
}))
