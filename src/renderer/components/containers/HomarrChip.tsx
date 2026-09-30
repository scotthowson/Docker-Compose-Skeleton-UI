// =============================================================================
// HomarrChip — the container's place on the Homarr dashboard, under its health
// badge: "Add to Homarr" when it is not there yet, "✓ Added" when it is. The
// same registration the deploy sheet's "Add to Homarr" switch makes: the app
// with its template's name and icon at its HTTPS route (or a published port),
// plus a tile on the home board when Homarr's API key is stored.
// =============================================================================

import { useCallback, useEffect, useState } from 'react'
import { Check, LayoutGrid, Loader2 } from 'lucide-react'
import { addContainerHomarr, fetchContainerHomarr } from '../../api/fleetScoped'
import { useToast } from '../common/Toast'
import Hint from '../common/Hint'
import { pageLabel } from '../../constants/pageTitles'
import { BTN_TOOLBAR, BTN_TOOLBAR_QUIET } from '../../lib/ui'
import type { RowMember } from '../../../shared/fleetScoped'
import type { ContainerHomarrState } from '../../../shared/types'

interface Props {
  containerName: string
  member: RowMember
  isAdmin: boolean
}

export default function HomarrChip({ containerName, member, isAdmin }: Props) {
  const { addToast } = useToast()
  const [state, setState] = useState<ContainerHomarrState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    setState(null)
    // an older DCS has no such endpoint, and a server without Homarr has nothing to offer: no chip
    fetchContainerHomarr(containerName, member).then((s) => { if (alive) setState(s) }).catch(() => { if (alive) setState(null) })
    return () => { alive = false }
  }, [containerName, member])

  const add = useCallback(async () => {
    setBusy(true)
    try {
      const res = await addContainerHomarr(containerName, member)
      setState(res)
      addToast({ type: 'success', message: res.message || `${res.target.name} is on Homarr` })
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not add it to Homarr', duration: 8000 })
    } finally {
      setBusy(false)
    }
  }, [containerName, member, addToast])

  if (!state || !state.homarr.active || !state.target.url) return null

  if (state.added) {
    const where = state.app ? `${state.app.name} → ${state.app.href}` : state.target.url
    const library = state.homarr.mode === 'library' ? ` — in the app library; store Homarr's API key (${pageLabel('config')} → Integrations) for a tile on the board` : ''
    return (
      <Hint label={`On Homarr: ${where}${library}`}>
        <span className={`${BTN_TOOLBAR} bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 whitespace-nowrap cursor-default`}>
          <Check size={14} />
          Added
        </span>
      </Hint>
    )
  }

  if (!isAdmin) return null
  const board = state.homarr.mode === 'board'
  return (
    <Hint label={`Put ${state.target.name} on Homarr at ${state.target.url}${board ? ', with a tile on the home board' : " (the app library: store Homarr's API key for a tile on the board)"}`}>
      <button
        type="button"
        onClick={() => void add()}
        disabled={busy}
        className={`${BTN_TOOLBAR_QUIET} whitespace-nowrap`}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <LayoutGrid size={14} />}
        Add to Homarr
      </button>
    </Hint>
  )
}
