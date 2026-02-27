import { WifiOff, RefreshCw, Loader2 } from 'lucide-react'
import { useConnectionStore } from '../../stores/connectionStore'

export function DisconnectedBanner() {
  const status = useConnectionStore((s) => s.status)
  const connect = useConnectionStore((s) => s.connect)
  const reconnectAttempts = useConnectionStore((s) => s.reconnectAttempts)

  if (status === 'connected') return null

  const isRetrying = status === 'connecting' || (status === 'error' && reconnectAttempts > 0)

  return (
    <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/15 text-sm animate-fade-in">
      {isRetrying ? (
        <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
      ) : (
        <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      )}
      <span className="text-slate-300 flex-1">
        {isRetrying
          ? `Reconnecting to server${reconnectAttempts > 1 ? ` (attempt ${reconnectAttempts})` : ''}...`
          : 'Not connected to server — data may be stale'}
      </span>
      {!isRetrying && (
        <button
          onClick={connect}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] border border-white/[0.08] text-slate-300 hover:bg-white/[0.1] transition-all press"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      )}
    </div>
  )
}
