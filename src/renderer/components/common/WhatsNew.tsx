// =============================================================================
// What's New — Changelog card showing recent DCS features and fixes
// =============================================================================

import { useState } from 'react'
import { Sparkles, ChevronDown, Zap, Shield, Cpu, Bell, HardDrive, Store, Package, BarChart3 } from 'lucide-react'

interface ChangelogEntry {
  version: string
  date: string
  highlights: { icon: React.ElementType; color: string; text: string }[]
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.8.0',
    date: '2026-03-31',
    highlights: [
      { icon: Store, color: 'text-orange-400', text: 'Homarr integration — auto-register services on deploy via SQLite' },
      { icon: Cpu, color: 'text-cyan-400', text: 'Live CPU/memory stats on containers page and Top Consumers dashboard card' },
      { icon: BarChart3, color: 'text-amber-400', text: 'Resource limits toggle on template deploy (memory + CPU)' },
      { icon: Bell, color: 'text-rose-400', text: 'NTFY notification engine — custom messages with template variables' },
      { icon: Package, color: 'text-emerald-400', text: 'Registry-based image update detection (no pulling, digest comparison)' },
      { icon: HardDrive, color: 'text-sky-400', text: 'Disk analysis: host disk stats, Docker volumes, per-stack sizes' },
      { icon: Shield, color: 'text-violet-400', text: 'Secrets system: ${SECRETS_KEY} in compose files, encrypted at rest' },
      { icon: Zap, color: 'text-indigo-400', text: 'Plugin hooks wired into stack lifecycle events' },
    ],
  },
  {
    version: '2.7.0',
    date: '2026-03-31',
    highlights: [
      { icon: Sparkles, color: 'text-pink-400', text: '15 template categories with grouped "All" view' },
      { icon: Store, color: 'text-orange-400', text: 'Singleton deploy detection for Traefik, Authelia, etc.' },
      { icon: Shield, color: 'text-violet-400', text: 'Authelia SSO toggle on template deploy screen' },
      { icon: Zap, color: 'text-amber-400', text: 'Floating save bar — consistent edit/save UX across all pages' },
    ],
  },
  {
    version: '2.6.0',
    date: '2026-03-30',
    highlights: [
      { icon: Package, color: 'text-emerald-400', text: 'Nextcloud AIO template with Traefik reverse proxy support' },
      { icon: Shield, color: 'text-red-400', text: 'Compose editor trusts template-deployed stacks' },
      { icon: Cpu, color: 'text-cyan-400', text: 'Container recreate injects secrets properly' },
      { icon: Bell, color: 'text-amber-400', text: 'Background image support (CSP fix for Unsplash)' },
    ],
  },
]

export default function WhatsNew() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-xl p-4 md:p-6 transition-all duration-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pink-500/20 to-violet-500/20 border border-pink-500/10 flex items-center justify-center">
            <Sparkles size={16} className="text-pink-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-200">What's New</p>
            <p className="text-[10px] text-slate-500">v{CHANGELOG[0].version} — {CHANGELOG[0].date}</p>
          </div>
        </div>
        <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
      </button>

      {expanded && (
        <div className="mt-4 space-y-5 animate-fade-in">
          {CHANGELOG.map((release) => (
            <div key={release.version}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-bold text-slate-300">v{release.version}</span>
                <span className="text-[10px] text-slate-600">{release.date}</span>
              </div>
              <div className="space-y-1.5">
                {release.highlights.map((h, i) => {
                  const Icon = h.icon
                  return (
                    <div key={i} className="flex items-start gap-2.5 pl-1">
                      <Icon size={12} className={`${h.color} shrink-0 mt-0.5`} />
                      <span className="text-[11px] text-slate-400 leading-relaxed">{h.text}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
