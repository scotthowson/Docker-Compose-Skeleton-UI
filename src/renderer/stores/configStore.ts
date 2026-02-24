import { create } from 'zustand'
import { ServerConfig } from '../../shared/types'

interface ConfigState {
  config: ServerConfig | null
  loading: boolean
  setConfig: (config: ServerConfig) => void
  setLoading: (loading: boolean) => void
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  loading: false,

  setConfig: (config) => set({ config }),
  setLoading: (loading) => set({ loading }),
}))
