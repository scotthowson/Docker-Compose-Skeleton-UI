// =============================================================================
// MobileNav — the phone shell's navigation: a bottom bar with the four pages
// you reach for most, and a "More" sheet listing everything else in groups.
// Shown under 768 px only; the sidebar takes over above that.
// =============================================================================

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { LayoutDashboard, Layers, Box, HeartPulse, Menu, X, Search } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAuthStore } from '../../stores/authStore'
import { useHealthStore } from '../../stores/healthStore'
import { useApiLink } from '../../hooks/useApiLink'
import { navItems } from './Sidebar'
import { ADMIN_ONLY_PAGES } from '../../../shared/types'
import type { PageId } from '../../../shared/types'

const PRIMARY: { id: PageId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'stacks', label: 'Stacks', icon: Layers },
  { id: 'containers', label: 'Containers', icon: Box },
  { id: 'health', label: 'Health', icon: HeartPulse },
]

const GROUPS: { label: string; ids: PageId[] }[] = [
  { label: 'Core', ids: ['images', 'networks', 'volumes', 'dns', 'templates'] },
  { label: 'Watch', ids: ['proxmox', 'uptime', 'trends', 'topology', 'updates', 'activity', 'event-feed', 'notifications'] },
  { label: 'Manage', ids: ['secrets', 'schedules', 'automations', 'bookmarks', 'file-browser', 'plugins', 'backup', 'snapshots'] },
  { label: 'System', ids: ['terminal', 'logs', 'environment', 'diagnostics', 'system', 'maintenance', 'disk-analysis', 'cronjobs', 'users', 'export', 'config', 'settings'] },
]

export function MobileNav() {
  const currentPage = useSettingsStore((s) => s.currentPage)
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const userRole = useAuthStore((s) => s.userRole)
  const unhealthyReported = useHealthStore((s) => s.report?.summary?.unhealthy ?? 0)
  const link = useApiLink()
  // an old count is not a fact while the API does not answer
  const unhealthy = link.live ? unhealthyReported : 0
  const [moreOpen, setMoreOpen] = useState(false)
  const isAdmin = userRole === 'admin'
  const byId = new Map(navItems.map((n) => [n.id, n]))
  const onPrimary = PRIMARY.some((p) => p.id === currentPage)

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  const go = (id: PageId) => { setCurrentPage(id); setMoreOpen(false) }

  return (
    <>
      <nav
        aria-label="Main"
        className="md:hidden shrink-0 border-t border-white/[0.06] bg-slate-900/85 backdrop-blur-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch h-[64px]">
          {PRIMARY.map((p) => {
            const active = currentPage === p.id
            const Icon = p.icon
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => go(p.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 select-none transition-colors ${active ? 'text-emerald-400' : 'text-slate-500 active:text-slate-300'}`}
              >
                <span className={`relative flex items-center justify-center w-12 h-7 rounded-full transition-colors ${active ? 'bg-emerald-500/15' : ''}`}>
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                  {p.id === 'health' && unhealthy > 0 && (
                    <span className="absolute -top-0.5 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-4 text-center ring-2 ring-slate-900">{unhealthy}</span>
                  )}
                </span>
                <span className="text-[11px] font-medium leading-none">{p.label}</span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-1 select-none transition-colors ${!onPrimary || moreOpen ? 'text-emerald-400' : 'text-slate-500 active:text-slate-300'}`}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            <span className={`flex items-center justify-center w-12 h-7 rounded-full ${!onPrimary || moreOpen ? 'bg-emerald-500/15' : ''}`}>
              <Menu size={22} strokeWidth={!onPrimary ? 2.4 : 2} />
            </span>
            <span className="text-[11px] font-medium leading-none">{onPrimary ? 'More' : (byId.get(currentPage)?.label ?? 'More')}</span>
          </button>
        </div>
      </nav>

      {moreOpen && createPortal(
        <div className="fixed inset-0 z-[80] md:hidden" role="dialog" aria-modal="true" aria-label="All pages">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-fade-in" onClick={() => setMoreOpen(false)} />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[86vh] flex flex-col rounded-t-3xl bg-slate-900 border-t border-white/10 shadow-2xl shadow-black/60 animate-slide-up"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="shrink-0 pt-2 pb-1 flex justify-center"><span className="h-1.5 w-12 rounded-full bg-white/15" /></div>
            <div className="shrink-0 flex items-center justify-between px-5 pb-2">
              <h2 className="text-base font-semibold text-slate-100">Everything</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setMoreOpen(false); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })), 50) }}
                  className="w-10 h-10 rounded-full bg-white/5 text-slate-300 flex items-center justify-center active:bg-white/10"
                  aria-label="Search"
                >
                  <Search size={18} />
                </button>
                <button type="button" onClick={() => setMoreOpen(false)} className="w-10 h-10 rounded-full bg-white/5 text-slate-300 flex items-center justify-center active:bg-white/10" aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto px-4 pb-4 space-y-4 overscroll-contain">
              {GROUPS.map((g) => {
                const items = g.ids.map((id) => byId.get(id)).filter((n): n is NonNullable<typeof n> => !!n && (!ADMIN_ONLY_PAGES.has(n.id) || isAdmin))
                if (!items.length) return null
                return (
                  <section key={g.label}>
                    <h3 className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{g.label}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {items.map((n) => {
                        const Icon = n.icon
                        const active = currentPage === n.id
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => go(n.id)}
                            className={`flex items-center gap-3 px-3.5 h-[52px] rounded-2xl border text-left transition-colors ${active ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : 'bg-white/[0.03] border-white/5 text-slate-200 active:bg-white/10'}`}
                          >
                            <Icon size={20} className={active ? 'text-emerald-400' : 'text-slate-400'} />
                            <span className="text-[15px] font-medium truncate">{n.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

export default MobileNav
