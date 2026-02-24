import { create } from 'zustand'
import type { BackupStatusResponse, BackupEntry, BackupConfigResponse } from '../../shared/types'

interface BackupState {
  status: BackupStatusResponse | null
  backups: BackupEntry[]
  config: BackupConfigResponse | null
  actionLoading: string | null
  setStatus: (status: BackupStatusResponse) => void
  setBackups: (backups: BackupEntry[]) => void
  setConfig: (config: BackupConfigResponse) => void
  setActionLoading: (action: string | null) => void
}

export const useBackupStore = create<BackupState>((set) => ({
  status: null,
  backups: [],
  config: null,
  actionLoading: null,

  setStatus: (status) => set({ status }),
  setBackups: (backups) => set({ backups }),
  setConfig: (config) => set({ config }),
  setActionLoading: (action) => set({ actionLoading: action }),
}))
