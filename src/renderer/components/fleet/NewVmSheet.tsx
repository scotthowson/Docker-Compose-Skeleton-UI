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
import type { FleetProvisionDefaults, FleetVmPlan, ProxmoxCapabilities } from '../../../shared/types'
import { Sheet, inputCls, labelCls } from './fleetShared'

export interface VmSettings { node: string; storage: string; image_storage: string; bridge: string; cidr: number; gateway: string; dns: string; ip_start: string }
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
  const [settings, setSettings] = useState<VmSettings>(() => defaults ? settingsFromDefaults(defaults, loadVmSettings()) : { node: '', storage: '', image_storage: 'local', bridge: 'vmbr0', cidr: 24, gateway: '', dns: '', ip_start: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (defaults) setSettings((s) => (s.node ? s : settingsFromDefaults(defaults, loadVmSettings()))) }, [defaults])
  const ok = /^[a-z0-9][a-z0-9-]{0,40}$/.test(stack) && settings.node && settings.storage && settings.gateway && (ip || settings.ip_start)
  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      const vm: FleetVmPlan = { stack, cores, memory_mb: memGb * 1024, disk_gb: diskGb }
      if (ip.trim()) vm.ip = ip.trim()
      await provisionFleet({ ...settings, vms: [vm] })
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
