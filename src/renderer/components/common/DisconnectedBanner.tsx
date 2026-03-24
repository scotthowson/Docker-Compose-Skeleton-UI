import { WifiOff, RefreshCw, Loader2 } from 'lucide-react'
import { useConnectionStore } from '../../stores/connectionStore'

export function DisconnectedBanner() {
  const status = useConnectionStore((s) => s.status)
  const connect = useConnectionStore((s) => s.connect)
  const reconnectAttempts = useConnectionStore((s) => s.reconnectAttempts)

  const isDisconnected = status !== 'connected'
  const isRetrying = status === 'connecting' || (status === 'error' && reconnectAttempts > 0)

  // Smooth height transition: render the wrapper always, but collapse when connected
  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-out ${
        isDisconnected ? 'max-h-16 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/15 text-sm">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] border border-white/10 text-slate-300 hover:bg-white/[0.1] transition-all press"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
