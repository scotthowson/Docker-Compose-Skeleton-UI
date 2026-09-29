import { WifiOff, RefreshCw, HeartPulse } from 'lucide-react'
import { useConnectionStore } from '../../stores/connectionStore'
import { useApiLink } from '../../hooks/useApiLink'

/** On every page that shows server data: says so, in the first seconds, when the API stops answering */
export function DisconnectedBanner() {
  const connect = useConnectionStore((s) => s.connect)
  const link = useApiLink()

  const show = !link.live
  const reconnecting = link.state === 'reconnecting'
  const trouble = link.state === 'trouble'

  // Smooth height transition: render the wrapper always, but collapse when connected
  return (
    <div
      aria-hidden={!show}
      role={show ? 'status' : undefined}
      className={`overflow-hidden transition-all duration-300 ease-out ${
        show ? 'max-h-16 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'
      }`}
    >
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
        trouble ? 'bg-amber-500/[0.06] border-amber-500/15' : 'bg-rose-500/[0.06] border-rose-500/20'
      }`}>
        {reconnecting || trouble ? (
          <HeartPulse className={`w-4 h-4 shrink-0 animate-pulse ${trouble ? 'text-amber-400' : 'text-rose-400'}`} />
        ) : (
          <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
        )}
        <span className="text-slate-300 flex-1">
          <span className="text-slate-200">{link.label}</span> — {link.note.toLowerCase()}
        </span>
        {!reconnecting && !trouble && (
          <button
            onClick={() => { void connect() }}
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
