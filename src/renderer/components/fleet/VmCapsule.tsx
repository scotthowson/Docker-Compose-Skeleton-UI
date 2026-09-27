// =============================================================================
// VmCapsule — where a row lives: the hub, or a VM by number and name
// =============================================================================

export default function VmCapsule({ member, name, vmid, onClick, size = 'sm' }: {
  member?: string | null; name?: string; vmid?: number | null; onClick?: () => void; size?: 'sm' | 'xs'
}) {
  const hub = !member
  const cls = `inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap ${size === 'xs' ? 'px-1.5 py-0 text-[9px]' : 'px-2 py-0.5 text-[10px]'} ${hub ? 'bg-emerald-500/[0.08] border-emerald-500/15 text-emerald-200/90' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'} ${onClick ? 'hover:bg-white/10 cursor-pointer' : ''}`
  const text = hub ? 'Hub' : `VM${vmid ? ` #${vmid}` : ''}${name ? ` · ${name}` : ''}`
  const title = hub ? 'Runs on the hub' : `Runs in the VM ${name ?? ''}`
  const dot = <span className={`w-1.5 h-1.5 rounded-full ${hub ? 'bg-emerald-400' : 'bg-amber-400'}`} />
  return onClick
    ? <button type="button" onClick={onClick} className={cls} title={title}>{dot}{text}</button>
    : <span className={cls} title={title}>{dot}{text}</span>
}
