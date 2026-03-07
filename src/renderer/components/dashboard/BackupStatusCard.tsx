import { HardDrive, ServerOff, AlertCircle, RefreshCw } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConnectionStore } from '../../stores/connectionStore'
import type { BackupStatusResponse } from '../../../shared/types'

function statusBadge(status: string) {
  switch (status) {
    case 'running':
    case 'restoring':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    case 'error':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30'
    default:
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  }
}

interface Props {
  data: BackupStatusResponse | null
  error?: Error | null
  onRetry?: () => void
}

export default function BackupStatusCard({ data, error, onRetry }: Props) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)

  if (!isConnected && !data) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in opacity-60">
        <div className="flex items-center gap-2 mb-3">
          <ServerOff size={14} className="text-slate-600" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Backups</h3>
        </div>
        <p className="text-xs text-slate-600">Not connected</p>
      </div>
    )
  }

  if (isConnected && !data && error) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={14} className="text-amber-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Backups</h3>
        </div>
        <p className="text-xs text-slate-500 mb-2">Unable to load backup status</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <RefreshCw size={10} />
            Retry
          </button>
        )}
      </div>
    )
  }

  if (isConnected && !data) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive size={14} className="text-emerald-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Backups</h3>
        </div>
        <div className="space-y-2">
          <div className="h-6 w-16 rounded-md bg-slate-800/40 animate-pulse" />
          <div className="h-4 w-40 rounded bg-slate-800/40 animate-pulse" />
        </div>
      </div>
    )
  }

  const { status, last_backup, progress } = data!

  return (
    <div
      className="glass-card p-4 md:p-6 animate-fade-in cursor-pointer hover:border-white/[0.1] transition-colors"
      onClick={() => setCurrentPage('backup')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HardDrive size={14} className="text-emerald-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Backups</h3>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${statusBadge(status)}`}>
          {status}
        </span>
      </div>
      {status === 'running' && progress && (
        <div className="mb-3">
          <div className="h-1.5 w-full rounded-full bg-slate-800/60 overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all duration-500 animate-pulse" style={{ width: '60%' }} />
          </div>
          <p className="text-[10px] text-amber-400 mt-1">{progress}</p>
        </div>
      )}
      {last_backup ? (
        <div className="space-y-1">
          <p className="text-xs text-slate-300">{last_backup.filename}</p>
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span>{last_backup.size}</span>
            <span>{last_backup.timestamp}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">No backups yet</p>
      )}
    </div>
  )
}
