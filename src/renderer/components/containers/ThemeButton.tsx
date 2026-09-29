// =============================================================================
// ThemeButton — "Theme" next to Start on demand, for the containers theme.park
// has themes for (it asks once when the container opens; nothing shows for the
// others). Opens ThemeParkDialog.
// =============================================================================

import { useCallback, useEffect, useState } from 'react'
import { Palette } from 'lucide-react'
import { fetchContainerTheme } from '../../api/fleetScoped'
import { useToast } from '../common/Toast'
import ThemeParkDialog from './ThemeParkDialog'
import type { RowMember } from '../../../shared/fleetScoped'
import type { ContainerThemeState } from '../../../shared/types'

interface Props {
  containerName: string
  member: RowMember
  disabled?: boolean
}

export default function ThemeButton({ containerName, member, disabled }: Props) {
  const { addToast } = useToast()
  const [state, setState] = useState<ContainerThemeState | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(() => {
    let alive = true
    fetchContainerTheme(containerName, member).then((s) => { if (alive) setState(s) }).catch(() => { if (alive) setState(null) })
    return () => { alive = false }
  }, [containerName, member])
  useEffect(() => { setState(null); return load() }, [load])

  if (!state || !state.supported) return null
  const label = state.enabled ? `Theme: ${state.theme.replace(/-/g, ' ')}` : 'Theme'
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={state.enabled ? `theme.park's ${state.theme} theme is on — change it or remove it` : `Give ${containerName} a theme.park theme (Nord, Dracula, Catppuccin…) through its Traefik route`}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 capitalize ${state.enabled ? 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/25 hover:bg-fuchsia-500/25' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-slate-200'}`}
      >
        <Palette className="h-3.5 w-3.5" />
        {label}
      </button>
      {open && (
        <ThemeParkDialog
          containerName={containerName}
          member={member}
          state={state}
          onClose={() => setOpen(false)}
          onChanged={(res) => {
            setState(res)
            addToast({ type: 'success', message: res.message || (res.enabled ? 'Theme applied' : 'Theme removed') })
            if (res.traefik_restarted) addToast({ type: 'info', message: 'Traefik restarted to load the theme.park plugin' })
          }}
          onError={(message) => addToast({ type: 'error', message, duration: 8000 })}
        />
      )}
    </>
  )
}
