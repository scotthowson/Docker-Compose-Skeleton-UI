import { create } from 'zustand'
import { StackInfo, StackDetail } from '../../shared/types'

interface StackState {
  stacks: StackInfo[]
  selectedStack: StackDetail | null
  loading: boolean
  actionLoading: string | null
  lastActionTimestamps: Record<string, number>
  setStacks: (stacks: StackInfo[]) => void
  setSelectedStack: (detail: StackDetail | null) => void
  setLoading: (loading: boolean) => void
  setActionLoading: (name: string | null) => void
  recordAction: (stackName: string) => void
}

function loadActionTimestamps(): Record<string, number> {
  try {
    const raw = localStorage.getItem('stack-action-timestamps')
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

export const useStackStore = create<StackState>((set, get) => ({
  stacks: [],
  selectedStack: null,
  loading: false,
  actionLoading: null,
  lastActionTimestamps: loadActionTimestamps(),

  setStacks: (stacks) => set({ stacks }),
  setSelectedStack: (detail) => set({ selectedStack: detail }),
  setLoading: (loading) => set({ loading }),
  setActionLoading: (name) => set({ actionLoading: name }),
  recordAction: (stackName) => {
    const updated = { ...get().lastActionTimestamps, [stackName]: Date.now() }
    localStorage.setItem('stack-action-timestamps', JSON.stringify(updated))
    set({ lastActionTimestamps: updated })
  },
}))
