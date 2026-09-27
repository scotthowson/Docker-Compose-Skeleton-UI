// =============================================================================
// VmCapsule — where a row lives: the hub, or a VM by number and name
// =============================================================================

export default function VmCapsule({ member, name, vmid, onClick, size = 'sm' }: {
  member?: string | null; name?: string; vmid?: number | null; onClick?: () => void; size?: 'sm' | 'xs'
}) {
  const hub = !member
  // an explicit height with leading-none: the dot and the text share one centre line (small text otherwise sits a hair high)
  const cls = `inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap leading-none align-middle ${size === 'xs' ? 'h-4 px-1.5 text-[9px]' : 'h-5 px-2 text-[10px]'} ${hub ? 'bg-emerald-500/[0.08] border-emerald-500/15 text-emerald-200/90' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'} ${onClick ? 'hover:bg-white/10 cursor-pointer' : ''}`
  const text = hub ? 'Hub' : `VM${vmid ? ` #${vmid}` : ''}${name ? ` · ${name}` : ''}`
  const title = hub ? 'Runs on the hub' : `Runs in the VM ${name ?? ''}`
  const dot = <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hub ? 'bg-emerald-400' : 'bg-amber-400'}`} />
  return onClick
    ? <button type="button" onClick={onClick} className={cls} title={title}>{dot}<span className="leading-none">{text}</span></button>
    : <span className={cls} title={title}>{dot}<span className="leading-none">{text}</span></span>
}
