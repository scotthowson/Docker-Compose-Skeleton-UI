// =============================================================================
// VmCapsule — where a row lives: the hub, or a VM by number and name. The
// dashboard's pill (a Mantine Badge from lib/mantine.tsx): emerald for the hub,
// amber for a VM, a button when it leads somewhere.
// =============================================================================

import { Badge } from '@mantine/core'

export default function VmCapsule({ member, name, vmid, onClick, size = 'sm' }: {
  member?: string | null; name?: string; vmid?: number | null; onClick?: () => void; size?: 'sm' | 'xs'
}) {
  const hub = !member
  const text = hub ? 'Hub' : `VM${vmid ? ` #${vmid}` : ''}${name ? ` · ${name}` : ''}`
  const title = hub ? 'Runs on the hub' : `Runs in the VM ${name ?? (vmid ? `#${vmid}` : '')}`.trim()
  const pill = { color: hub ? 'emerald' : 'amber', size, title, className: 'align-middle', leftSection: <span className={`w-1.5 h-1.5 rounded-full ${hub ? 'bg-emerald-400' : 'bg-amber-400'}`} /> }
  return onClick
    ? <Badge component="button" type="button" onClick={onClick} {...pill}>{text}</Badge>
    : <Badge component="span" {...pill}>{text}</Badge>
}
