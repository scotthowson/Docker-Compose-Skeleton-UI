import { useState } from 'react'
import { Cpu, ServerOff } from 'lucide-react'
import { useContainerStore } from '../../stores/containerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConnectionStore } from '../../stores/connectionStore'

function parsePercent(val: string): number {
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

function barColor(pct: number): string {
  if (pct >= 80) return 'bg-rose-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export default function TopResourceConsumers() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const stats = useContainerStore((s) => s.stats)
  const [mode, setMode] = useState<'cpu' | 'mem'>('cpu')

  if (!isConnected && Object.keys(stats).length === 0) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in opacity-60">
        <div className="flex items-center gap-2 mb-3">
          <ServerOff size={14} className="text-slate-600" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Top Consumers</h3>
        </div>
        <p className="text-xs text-slate-600">Not connected</p>
      </div>
    )
  }

  const entries = Object.entries(stats)
    .map(([name, s]) => ({
      name,
      cpu: parsePercent(s.cpu_percent),
      mem: parsePercent(s.memory_percent),
    }))
    .sort((a, b) => mode === 'cpu' ? b.cpu - a.cpu : b.mem - a.mem)
    .slice(0, 5)

  return (
    <div
      className="glass-card p-4 md:p-6 animate-fade-in cursor-pointer hover:border-white/[0.1] transition-colors"
      onClick={() => setCurrentPage('containers')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-amber-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Top Consumers</h3>
        </div>
        <div className="flex rounded-md border border-white/[0.08] overflow-hidden">
          {(['cpu', 'mem'] as const).map((m) => (
            <button
              key={m}
              onClick={(e) => { e.stopPropagation(); setMode(m) }}
              className={`px-2.5 py-1 text-[10px] font-medium uppercase transition-colors ${mode === m ? 'bg-white/[0.08] text-slate-200' : 'text-slate-500 hover:text-slate-400'}`}
            >
              {m === 'cpu' ? 'CPU' : 'MEM'}
            </button>
          ))}
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-500">No container stats available</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const pct = mode === 'cpu' ? e.cpu : e.mem
            return (
              <div key={e.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-slate-300 font-mono truncate max-w-[60%]">{e.name}</span>
                  <span className="text-[11px] text-slate-400 font-medium">{pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800/60 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${barColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
