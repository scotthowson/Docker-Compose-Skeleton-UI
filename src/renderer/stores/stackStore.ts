import { create } from 'zustand'
import { StackInfo, StackDetail } from '../../shared/types'

interface StackState {
  stacks: StackInfo[]
  selectedStack: StackDetail | null
  loading: boolean
  actionLoading: string | null
  setStacks: (stacks: StackInfo[]) => void
  setSelectedStack: (detail: StackDetail | null) => void
  setLoading: (loading: boolean) => void
  setActionLoading: (name: string | null) => void
}

export const useStackStore = create<StackState>((set) => ({
  stacks: [],
  selectedStack: null,
  loading: false,
  actionLoading: null,

  setStacks: (stacks) => set({ stacks }),
  setSelectedStack: (detail) => set({ selectedStack: detail }),
  setLoading: (loading) => set({ loading }),
  setActionLoading: (name) => set({ actionLoading: name }),
}))
