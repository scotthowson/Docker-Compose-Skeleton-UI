import { create } from 'zustand'
import type { RootEnvResponse, StackEnvResponse } from '../../shared/types'

interface EnvState {
  rootEnv: RootEnvResponse | null
  stackEnv: StackEnvResponse | null
  selectedStack: string | null
  saving: boolean
  validating: boolean
  setRootEnv: (env: RootEnvResponse) => void
  setStackEnv: (env: StackEnvResponse | null) => void
  setSelectedStack: (stack: string | null) => void
  setSaving: (saving: boolean) => void
  setValidating: (validating: boolean) => void
}

export const useEnvStore = create<EnvState>((set) => ({
  rootEnv: null,
  stackEnv: null,
  selectedStack: null,
  saving: false,
  validating: false,

  setRootEnv: (env) => set({ rootEnv: env }),
  setStackEnv: (env) => set({ stackEnv: env }),
  setSelectedStack: (stack) => set({ selectedStack: stack }),
  setSaving: (saving) => set({ saving }),
  setValidating: (validating) => set({ validating }),
}))
