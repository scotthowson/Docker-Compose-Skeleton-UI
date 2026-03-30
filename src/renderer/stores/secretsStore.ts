import { create } from 'zustand'
import * as api from '../api/endpoints'

interface SecretsState {
  keys: string[]
  loading: boolean
  saving: boolean
  error: string | null
  fetchSecrets: () => Promise<void>
  setSecret: (key: string, value: string) => Promise<boolean>
  deleteSecret: (key: string) => Promise<boolean>
}

export const useSecretsStore = create<SecretsState>((set) => ({
  keys: [],
  loading: false,
  saving: false,
  error: null,

  fetchSecrets: async () => {
    set({ loading: true, error: null })
    try {
      const res = await api.fetchSecrets()
      // API returns objects {key, modified, size} — extract key strings
      const keys = Array.isArray(res.secrets)
        ? res.secrets.map((s: string | { key: string }) => typeof s === 'string' ? s : s.key)
        : []
      set({ keys, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch secrets' })
    }
  },

  setSecret: async (key, value) => {
    set({ saving: true, error: null })
    try {
      await api.setSecret(key, value)
      const res = await api.fetchSecrets()
      const keys = Array.isArray(res.secrets)
        ? res.secrets.map((s: string | { key: string }) => typeof s === 'string' ? s : s.key)
        : []
      set({ keys, saving: false })
      return true
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : 'Failed to set secret' })
      return false
    }
  },

  deleteSecret: async (key) => {
    set({ saving: true, error: null })
    try {
      await api.deleteSecret(key)
      set(prev => ({ keys: prev.keys.filter(k => k !== key), saving: false }))
      return true
    } catch (err) {
      set({ saving: false, error: err instanceof Error ? err.message : 'Failed to delete secret' })
      return false
    }
  },
}))
