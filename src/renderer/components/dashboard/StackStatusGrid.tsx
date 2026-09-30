// =============================================================================
// StackStatusGrid — every stack with its state, as a grid of small tiles
// =============================================================================

import { Layers } from 'lucide-react'
import { useConnectionStore } from '../../stores/connectionStore'
import { pageLabel } from '../../constants/pageTitles'
import type { StackInfo } from '../../../shared/types'
import { Card, CardEmpty, CardError, CardLoading, CardOffline } from './cardShared'

interface Props {
  stacks: StackInfo[] | null
  error?: Error | null
  onRetry?: () => void
}

export default function StackStatusGrid({ stacks, error, onRetry }: Props) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')

  if (!isConnected && !stacks) return <Card card="stack-grid" dim><CardOffline /></Card>
  if (!stacks && error) return <Card card="stack-grid"><CardError title="Could not load the stacks" error={error} onRetry={onRetry} /></Card>
  if (!stacks) return <Card card="stack-grid"><CardLoading label="Loading the stacks…" variant="tiles" rows={6} /></Card>

  return (
    <Card card="stack-grid" meta={`${stacks.length} total`} open="stacks">
      {stacks.length === 0 ? (
        <CardEmpty icon={<Layers size={22} />} title="No stacks yet" hint={`Deploy a template or create a stack on the ${pageLabel('stacks')} page.`} />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin -mx-1 px-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 content-start">
          {stacks.map((s) => (
            <div
              key={`${s.member ?? ''}|${s.name}`}
              className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2.5 hover:bg-white/5 transition-colors flex items-center gap-2.5 min-h-[44px]"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'running' ? 'bg-emerald-400' : 'bg-slate-600'}`} aria-hidden />
              <span className="text-xs font-medium text-slate-200 truncate flex-1">{s.name}</span>
              <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">
                {s.status === 'running' ? `${s.running_containers} running` : 'stopped'}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
