import { create } from 'zustand'
import { EventEntry } from '../../shared/types'

interface LogState {
  logs: string
  logFile: string
  events: EventEntry[]
  loading: boolean
  setLogs: (logs: string, logFile: string) => void
  setEvents: (events: EventEntry[]) => void
  setLoading: (loading: boolean) => void
}

export const useLogStore = create<LogState>((set) => ({
  logs: '',
  logFile: '',
  events: [],
  loading: false,

  setLogs: (logs, logFile) => set({ logs, logFile }),
  setEvents: (events) => set({ events }),
  setLoading: (loading) => set({ loading }),
}))
