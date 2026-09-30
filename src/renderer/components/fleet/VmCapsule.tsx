// =============================================================================
// VmCapsule — where a row lives: the hub, or a VM by number and name. The
// dashboard's pill (a Mantine Badge from lib/mantine.tsx) in the fleet's own
// colour, violet — "this is the fleet / this runs in a VM" — on every page that
// shows one. The hub wears a hollow dot, a VM a solid one; the capsule is a
// button when it leads somewhere.
// =============================================================================

import { Badge } from '@mantine/core'

export default function VmCapsule({ member, name, vmid, onClick, size = 'sm' }: {
  member?: string | null; name?: string; vmid?: number | null; onClick?: () => void; size?: 'sm' | 'xs'
}) {
  const hub = !member
  const text = hub ? 'Hub' : `VM${vmid ? ` #${vmid}` : ''}${name ? ` · ${name}` : ''}`
  const title = hub ? 'Runs on the hub' : `Runs in the VM ${name ?? (vmid ? `#${vmid}` : '')}`.trim()
  const dot = hub ? 'border border-violet-500' : 'bg-violet-500'
  const pill = { color: 'violet', size, title, className: 'align-middle', leftSection: <span className={`box-border w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden /> }
  return onClick
    ? <Badge component="button" type="button" onClick={onClick} {...pill}>{text}</Badge>
    : <Badge component="span" {...pill}>{text}</Badge>
}
