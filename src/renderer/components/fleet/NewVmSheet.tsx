// =============================================================================
// NewVmSheet — "a stack in its own VM": the hub creates a VM on Proxmox for the
// stack named here (cloud image, cloud-init, static address, ssh bootstrap,
// unattended member setup, join). The VM settings (node, storage, bridge,
// network) come prefilled from /fleet/provision/defaults and are remembered.
// =============================================================================

import { useConnectionStore } from '../../stores/connectionStore'
import { useEffect, useState } from 'react'
import { Loader2, Rocket, Server } from 'lucide-react'
import { fetchFleetProvisionDefaults, provisionFleet } from '../../api/endpoints'
import type { FleetProvisionDefaults, FleetVmPlan, ProxmoxCapabilities , FleetProvisionRequest} from '../../../shared/types'
import { Sheet, inputCls, labelCls } from './fleetShared'

export interface VmSettings { node: string; storage: string; image_storage: string; bridge: string; cidr: number; gateway: string; dns: string; ip_start: string; /** what the VMs are built from: cat:<id> (catalogue), url, pve:<file> (imported already), iso:<volid> (installer, by hand) */ os: string; image_url: string }

/** The operating-system choices: the catalogue, what Proxmox already holds, a URL */
export function osChoices(d: FleetProvisionDefaults | null): { value: string; label: string; group: string; byHand?: boolean }[] {
  const out: { value: string; label: string; group: string; byHand?: boolean }[] = []
  for (const c of d?.images?.catalogue ?? []) out.push({ value: `cat:${c.id}`, label: `${c.label}${c.family === 'dnf' ? ' · dnf' : ''}`, group: 'Cloud images — built and joined by the hub' })
  for (const i of d?.images?.on_proxmox?.imports ?? []) out.push({ value: `pve:${i.file}`, label: `${i.file} (${(i.size / 1073741824).toFixed(1)} GB, on ${i.storage})`, group: 'On Proxmox already — cloud images' })
  for (const i of d?.images?.on_proxmox?.isos ?? []) out.push({ value: `iso:${i.volid}`, label: `${i.file} (${(i.size / 1073741824).toFixed(1)} GB) — install by hand, then join`, group: 'On Proxmox already — installer ISOs', byHand: true })
  out.push({ value: 'url', label: 'A cloud image from a URL…', group: 'Anything else' })
  return out
}
export function osLabel(s: VmSettings | null, d: FleetProvisionDefaults | null): string {
  if (!s) return ''
  if (s.os === 'url') return s.image_url ? s.image_url.split('/').pop() ?? s.image_url : 'a URL'
  const c = osChoices(d).find((o) => o.value === s.os)
  if (c) return c.label.replace(/ — .*$/, '').replace(/ \(.*\)$/, '')
  return s.os.replace(/^(cat|pve|iso):/, '')
}
/** The request fields the settings stand for (the hub takes image | image_url | image_file | iso) */
export function vmSettingsToRequest(s: VmSettings): Omit<FleetProvisionRequest, 'vms'> {
  const { os, image_url, ...rest } = s
  const pick: Partial<FleetProvisionRequest> = os.startsWith('cat:') ? { image: os.slice(4) } : os === 'url' ? { image_url } : os.startsWith('pve:') ? { image_file: os.slice(4) } : os.startsWith('iso:') ? { iso: os.slice(4) } : {}
  return { ...rest, ...pick }
}
// remembered per hub (another hub has other storages and another network)
const settingsKey = () => `dcs-fleet-vm-settings:${useConnectionStore.getState().serverUrl || 'default'}`

export function loadVmSettings(): Partial<VmSettings> {
  try { const raw = localStorage.getItem(settingsKey()); return raw ? (JSON.parse(raw) as Partial<VmSettings>) : {} } catch { return {} }
}
export function saveVmSettings(s: VmSettings) { try { localStorage.setItem(settingsKey(), JSON.stringify(s)) } catch { /* private window */ } }

/** the hub's defaults, with what was remembered on top — but only where it still exists on this Proxmox */
export function settingsFromDefaults(d: FleetProvisionDefaults, saved: Partial<VmSettings> = {}): VmSettings {
  const has = (name?: string) => !!name && d.storages.some((s) => s.storage === name)
  return {
    node: saved.node && (!d.node || saved.node === d.node) ? saved.node : d.node,
    storage: has(saved.storage) ? (saved.storage as string) : d.storage,
    image_storage: has(saved.image_storage) ? (saved.image_storage as string) : (d.image_storage || 'local'),
    os: saved.os && osChoices(d).some((o) => o.value === saved.os) ? saved.os : `cat:${d.images?.catalogue?.[0]?.id ?? 'debian-13'}`,
    image_url: saved.image_url || '',
    bridge: saved.bridge || d.bridge || 'vmbr0',
    cidr: saved.cidr || d.cidr || 24,
    gateway: saved.gateway || d.gateway,
    dns: saved.dns || d.dns,
    ip_start: saved.ip_start || d.ip_start,
  }
}

/** The VM settings block shared by the wizard's layout step and the New VM sheet */
export function VmSettingsFields({ value, onChange, defaults, disabled = false }: { value: VmSettings; onChange: (v: VmSettings) => void; defaults: FleetProvisionDefaults | null; disabled?: boolean }) {
  const set = (k: keyof VmSettings, v: string | number) => onChange({ ...value, [k]: v })
  const storages = defaults?.storages ?? []
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="col-span-2 sm:col-span-4">
        <label className={labelCls}>Operating system</label>
        <div className="flex gap-2 flex-wrap">
          <select value={value.os} onChange={(e) => set('os', e.target.value)} className={`${inputCls} flex-1 min-w-[16rem]`} disabled={disabled}>
            {Array.from(new Set(osChoices(defaults).map((o) => o.group))).map((g) => (
              <optgroup key={g} label={g}>{osChoices(defaults).filter((o) => o.group === g).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
            ))}
          </select>
          {value.os === 'url' && <input value={value.image_url} onChange={(e) => set('image_url', e.target.value)} className={`${inputCls} flex-[2] min-w-[16rem]`} disabled={disabled} placeholder="https://…/image.qcow2 (cloud-init, apt or dnf)" />}
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          {value.os.startsWith('iso:') ? 'An installer: the hub creates the VM with the ISO attached and shows the join code; you install in the Proxmox console, then join.' : 'A cloud image: Proxmox downloads it once (or the hub uploads it), the VM is installed, joined and running without a hand on it. Ubuntu, Debian, Fedora and AlmaLinux are covered; any cloud-init image with apt or dnf works.'}
        </p>
      </div>
      <div>
        <label className={labelCls}>Node</label>
        <input value={value.node} onChange={(e) => set('node', e.target.value)} className={inputCls} disabled={disabled} placeholder="pve" />
      </div>
      <div>
        <label className={labelCls}>Disk storage</label>
        {storages.length ? (
          <select value={value.storage} onChange={(e) => set('storage', e.target.value)} className={inputCls} disabled={disabled}>
            {storages.filter((s) => s.images).map((s) => <option key={s.storage} value={s.storage}>{s.storage} · {s.type} · {Math.round(s.avail / 1073741824)} GB free</option>)}
          </select>
        ) : <input value={value.storage} onChange={(e) => set('storage', e.target.value)} className={inputCls} disabled={disabled} placeholder="local-lvm" />}
      </div>
      <div>
        <label className={labelCls}>Image storage</label>
        {storages.length ? (
          <select value={value.image_storage} onChange={(e) => set('image_storage', e.target.value)} className={inputCls} disabled={disabled}>
            {storages.filter((s) => s.dir).map((s) => <option key={s.storage} value={s.storage}>{s.storage}{s.import_ready ? '' : ' (import switched on by the hub)'}</option>)}
          </select>
        ) : <input value={value.image_storage} onChange={(e) => set('image_storage', e.target.value)} className={inputCls} disabled={disabled} placeholder="local" />}
      </div>
      <div>
        <label className={labelCls}>Bridge</label>
        <input value={value.bridge} onChange={(e) => set('bridge', e.target.value)} className={`${inputCls} font-mono`} disabled={disabled} placeholder="vmbr0" />
      </div>
      <div>
        <label className={labelCls}>First address</label>
        <input value={value.ip_start} onChange={(e) => set('ip_start', e.target.value)} className={`${inputCls} font-mono`} disabled={disabled} placeholder="192.168.1.200" />
      </div>
      <div>
        <label className={labelCls}>Prefix</label>
        <input type="number" min={8} max={30} value={value.cidr} onChange={(e) => set('cidr', Number(e.target.value) || 24)} className={`${inputCls} font-mono`} disabled={disabled} />
      </div>
      <div>
        <label className={labelCls}>Gateway</label>
        <input value={value.gateway} onChange={(e) => set('gateway', e.target.value)} className={`${inputCls} font-mono`} disabled={disabled} placeholder="192.168.1.1" />
      </div>
      <div>
        <label className={labelCls}>DNS</label>
        <input value={value.dns} onChange={(e) => set('dns', e.target.value)} className={`${inputCls} font-mono`} disabled={disabled} placeholder="192.168.1.1" />
      </div>
    </div>
  )
}

export function CapabilityNote({ caps }: { caps: ProxmoxCapabilities | null }) {
  if (!caps) return null
  if (caps.can_provision) return <p className="text-[11px] text-emerald-300/90">{caps.hint}</p>
  return <p className="text-[11px] text-amber-300">The token cannot create VMs yet — missing {caps.missing.join(', ')}. {caps.hint}</p>
}

interface Props {
  defaults: FleetProvisionDefaults | null
  caps: ProxmoxCapabilities | null
  onClose: () => void
  onQueued: () => void
  initialStack?: string
}

export default function NewVmSheet({ defaults, caps, onClose, onQueued, initialStack = '' }: Props) {
  const [stack, setStack] = useState(initialStack)
  const [cores, setCores] = useState(defaults?.defaults.cores ?? 2)
  const [memGb, setMemGb] = useState(Math.round((defaults?.defaults.memory_mb ?? 4096) / 1024))
  const [diskGb, setDiskGb] = useState(defaults?.defaults.disk_gb ?? 32)
  const [ip, setIp] = useState('')
  const [settings, setSettings] = useState<VmSettings>(() => defaults ? settingsFromDefaults(defaults, loadVmSettings()) : { node: '', storage: '', image_storage: 'local', bridge: 'vmbr0', cidr: 24, gateway: '', dns: '', ip_start: '', os: 'cat:debian-13', image_url: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (defaults) setSettings((s) => (s.node ? s : settingsFromDefaults(defaults, loadVmSettings()))) }, [defaults])
  const ok = /^[a-z0-9][a-z0-9-]{0,40}$/.test(stack) && settings.node && settings.storage && settings.gateway && (ip || settings.ip_start)
  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      const vm: FleetVmPlan = { stack, cores, memory_mb: memGb * 1024, disk_gb: diskGb }
      if (ip.trim()) vm.ip = ip.trim()
      await provisionFleet({ ...vmSettingsToRequest(settings), vms: [vm] })
      saveVmSettings(settings)
      onQueued(); onClose()
    } catch (e) { setErr(e instanceof Error ? e.message : 'The request failed') } finally { setBusy(false) }
  }
  return (
    <Sheet title="A stack in its own VM" subtitle="The hub creates the VM on Proxmox, installs Docker and DCS in it and joins it; the stack then lives there" icon={<Server size={18} />} onClose={busy ? () => {} : onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelCls}>Stack = VM name</label>
            <input value={stack} onChange={(e) => setStack(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="media-services" className={`${inputCls} font-mono`} disabled={busy} />
          </div>
          <div><label className={labelCls}>Cores</label><input type="number" min={1} max={64} value={cores} onChange={(e) => setCores(Number(e.target.value) || 1)} className={inputCls} disabled={busy} /></div>
          <div><label className={labelCls}>RAM (GB)</label><input type="number" min={1} max={512} value={memGb} onChange={(e) => setMemGb(Number(e.target.value) || 1)} className={inputCls} disabled={busy} /></div>
          <div><label className={labelCls}>Disk (GB)</label><input type="number" min={8} max={4096} value={diskGb} onChange={(e) => setDiskGb(Number(e.target.value) || 8)} className={inputCls} disabled={busy} /></div>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">VM settings <span className="normal-case tracking-normal font-normal text-slate-500">— remembered for the next VM</span></p>
          <VmSettingsFields value={settings} onChange={setSettings} defaults={defaults} disabled={busy} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <div>
              <label className={labelCls}>Address for this VM</label>
              <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder={`next free from ${settings.ip_start || '…'}`} className={`${inputCls} font-mono`} disabled={busy} />
            </div>
          </div>
        </div>
        <CapabilityNote caps={caps} />
        <p className="text-[11px] text-slate-500">Debian cloud image, imported once · user {defaults?.vm_user || 'dcs'} with the hub's ssh key · the VM's admin is {defaults?.admin_user || 'your account'} with a generated password kept in the hub's secret store · takes a few minutes; watch it on the card.</p>
        {err && <p className="text-xs text-rose-300">{err}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 h-11 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 text-sm font-medium disabled:opacity-50">Cancel</button>
          <button type="button" onClick={submit} disabled={busy || !ok || (caps ? !caps.can_provision : false)} className="flex-1 h-11 rounded-xl bg-amber-500/90 hover:bg-amber-400 text-slate-900 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />} Build the VM
          </button>
        </div>
      </div>
    </Sheet>
  )
}
