import { create } from 'zustand'
import type { Plugin } from '../../shared/types'
import * as api from '../api/endpoints'

interface PluginState {
  plugins: Plugin[]
  loading: boolean
  installing: boolean
  error: string | null
  fetchPlugins: () => Promise<void>
  installPlugin: (source: string) => Promise<boolean>
  scaffoldPlugin: (def: Parameters<typeof api.scaffoldPlugin>[0]) => Promise<boolean>
  removePlugin: (name: string) => Promise<boolean>
  togglePlugin: (name: string) => Promise<boolean>
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  loading: false,
  installing: false,
  error: null,

  fetchPlugins: async () => {
    set({ loading: true, error: null })
    try {
      const res = await api.fetchPlugins()
      set({ plugins: res.plugins, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch plugins' })
    }
  },

  installPlugin: async (source) => {
    set({ installing: true, error: null })
    try {
      await api.installPlugin(source)
      set({ installing: false })
      get().fetchPlugins()
      return true
    } catch (err) {
      set({ installing: false, error: err instanceof Error ? err.message : 'Failed to install plugin' })
      return false
    }
  },

  scaffoldPlugin: async (def) => {
    set({ installing: true, error: null })
    try {
      await api.scaffoldPlugin(def)
      set({ installing: false })
      get().fetchPlugins()
      return true
    } catch (err) {
      set({ installing: false, error: err instanceof Error ? err.message : 'Failed to scaffold plugin' })
      return false
    }
  },

  removePlugin: async (name) => {
    try {
      await api.removePlugin(name)
      set(prev => ({ plugins: prev.plugins.filter(p => p.name !== name) }))
      return true
    } catch { return false }
  },

  togglePlugin: async (name) => {
    try {
      const updated = await api.togglePlugin(name)
      set(prev => ({ plugins: prev.plugins.map(p => p.name === name ? updated : p) }))
      return true
    } catch { return false }
  },
}))
