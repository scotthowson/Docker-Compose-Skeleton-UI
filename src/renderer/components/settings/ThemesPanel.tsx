// =============================================================================
// ThemesPanel — Settings → Themes: the gallery of built-in, server and
// on-this-device themes, the Theme Studio (make or edit one with a live
// preview) and Install (paste JSON, pick a file, or give an https address).
// =============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check, Copy, Download, FileJson, Globe, Link, Loader2, Moon, Palette, Pencil, Plus,
  Server, Smartphone, Sparkles, Sun, Trash2, Upload, X, Eye, EyeOff, RefreshCw,
} from 'lucide-react'
import { useToast } from '../common/Toast'
import { useConfirm } from '../common/ConfirmDialog'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAuthStore } from '../../stores/authStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { useThemeStore, syncDocumentTheme, type ThemeSource } from '../../stores/themeStore'
import { applyTheme, setThemePreviewing } from '../../lib/themeEngine'
import { CSS_SANITIZE_NOTE, sanitizeCss } from '../../lib/cssSanitize'
import { ApiError } from '../../api/client'
import {
  type Theme,
  type ThemeMode,
  type ThemePalette,
  type PaletteKey,
  type ThemeRadius,
  BUILT_IN_THEMES,
  PALETTE_KEYS,
  PALETTE_LABELS,
  THEME_NAME_RE,
  THEME_RADII,
  blankTheme,
  contrastRatio,
  normalizeHex,
  themeFromMeta,
  themeToJson,
  validateTheme,
  HEX_RE,
} from '../../../shared/themes'

// ---------------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------------

const BTN = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all press disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_PRIMARY = `${BTN} bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25`
const BTN_GHOST = `${BTN} bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10`
const BTN_QUIET = `${BTN} text-slate-400 hover:text-slate-200 hover:bg-white/5`
const ICON_BTN = 'p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors'
const INPUT = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all'

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message || `Request failed (${err.status})`
  return err instanceof Error ? err.message : String(err)
}

function slugify(title: string): string {
  const s = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return s.replace(/^[^a-z0-9]+/, '')
}

function downloadJson(name: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name || 'theme'}.theme.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** the theme drawn small: page, sidebar, a card, the brand gradient and the four status dots */
function ThemeThumb({ palette: p, className = '' }: { palette: ThemePalette; className?: string }) {
  const bar = (color: string, w: string, opacity = 1) => (
    <span className={`block h-1 rounded-full ${w}`} style={{ backgroundColor: color, opacity }} />
  )
  return (
    <div className={`w-full h-20 rounded-lg overflow-hidden border ${className}`} style={{ backgroundColor: p.bg, borderColor: p.border }} aria-hidden>
      <div className="flex h-full">
        <div className="w-6 h-full flex flex-col items-center gap-1.5 pt-2" style={{ backgroundColor: p.surface, borderRight: `1px solid ${p.border}` }}>
          <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.accentSecondary})` }} />
          <span className="w-3 h-1 rounded-full" style={{ backgroundColor: p.accent, opacity: 0.9 }} />
          <span className="w-3 h-1 rounded-full" style={{ backgroundColor: p.textMuted, opacity: 0.45 }} />
          <span className="w-3 h-1 rounded-full" style={{ backgroundColor: p.textMuted, opacity: 0.45 }} />
        </div>
        <div className="flex-1 p-2 flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="block h-1.5 w-9 rounded-full" style={{ background: `linear-gradient(90deg, ${p.accent}, ${p.accentSecondary})` }} />
            {bar(p.text, 'w-6', 0.35)}
          </div>
          <div className="flex-1 rounded-md p-1.5 flex flex-col gap-1" style={{ backgroundColor: p.surface, border: `1px solid ${p.border}` }}>
            {bar(p.text, 'w-12', 0.7)}
            {bar(p.textMuted, 'w-16', 0.6)}
            <div className="mt-auto flex items-center gap-1">
              {[p.success, p.warning, p.danger, p.info].map((c, i) => (
                <span key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
              ))}
              <span className="ml-auto h-2 w-7 rounded-sm" style={{ backgroundColor: p.surfaceRaised, border: `1px solid ${p.border}` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SwatchStrip({ palette }: { palette: ThemePalette }) {
  return (
    <div className="flex items-center gap-0.5">
      {PALETTE_KEYS.map((k) => (
        <span key={k} title={`${PALETTE_LABELS[k].label} ${palette[k]}`} className="flex-1 h-1.5 first:rounded-l-full last:rounded-r-full" style={{ backgroundColor: palette[k] }} />
      ))}
    </div>
  )
}

function ModeChip({ mode }: { mode: ThemeMode }) {
  return mode === 'light' ? (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/15"><Sun size={10} /> Light</span>
  ) : (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/15"><Moon size={10} /> Dark</span>
  )
}

function SourceChip({ source }: { source: ThemeSource }) {
  if (source === 'server') return <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400"><Server size={10} /> Server</span>
  if (source === 'local') return <span className="inline-flex items-center gap-1 text-[10px] text-slate-400"><Smartphone size={10} /> This device</span>
  return <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Sparkles size={10} /> Built in</span>
}

/** a sheet: a bottom sheet on the phone, a right-hand drawer on the desktop so the dashboard stays visible behind it */
function Sheet({ title, icon, onClose, children, footer, wide, keepOnBackdrop }: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean; keepOnBackdrop?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-stretch sm:justify-end bg-black/30 animate-fade-in" onClick={keepOnBackdrop ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-xl'} max-h-[92vh] sm:max-h-none sm:h-full flex flex-col bg-slate-900/95 backdrop-blur-2xl border border-white/10 sm:border-y-0 sm:border-r-0 rounded-t-3xl sm:rounded-none sm:rounded-l-2xl shadow-2xl shadow-black/50 animate-slide-up`}
      >
        <div className="sm:hidden pt-2 flex justify-center"><span className="h-1.5 w-12 rounded-full bg-white/15" /></div>
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/5 shrink-0">
          {icon}
          <h3 className="text-sm font-semibold text-slate-100 flex-1">{title}</h3>
          <button type="button" onClick={onClose} className={ICON_BTN} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-white/5 shrink-0 safe-area-bottom">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Theme Studio
// ---------------------------------------------------------------------------

interface StudioProps {
  initial: Theme
  /** editing a theme that already exists (name locked to what is stored) */
  editing: boolean
  isAdmin: boolean
  serverOk: boolean
  onClose: () => void
  onSaved: (theme: Theme, where: 'server' | 'local') => void
}

function contrastLabel(ratio: number): { text: string; cls: string } {
  if (ratio >= 7) return { text: `${ratio.toFixed(1)}:1 AAA`, cls: 'text-emerald-400' }
  if (ratio >= 4.5) return { text: `${ratio.toFixed(1)}:1 AA`, cls: 'text-emerald-400' }
  if (ratio >= 3) return { text: `${ratio.toFixed(1)}:1 low`, cls: 'text-amber-400' }
  return { text: `${ratio.toFixed(1)}:1 poor`, cls: 'text-rose-400' }
}

function ThemeStudio({ initial, editing, isAdmin, serverOk, onClose, onSaved }: StudioProps) {
  const { addToast } = useToast()
  const saveServer = useThemeStore((s) => s.save)
  const saveLocal = useThemeStore((s) => s.saveLocal)
  const [draft, setDraft] = useState<Theme>(() => ({ ...initial, palette: { ...initial.palette } }))
  const [hexText, setHexText] = useState<Record<string, string>>(() => ({ ...initial.palette }))
  const [nameTouched, setNameTouched] = useState(editing || !!initial.name)
  const [preview, setPreview] = useState(true)
  const [saving, setSaving] = useState<'server' | 'local' | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const update = useCallback(<K extends keyof Theme>(key: K, value: Theme[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }, [])

  const setColor = useCallback((key: PaletteKey, value: string) => {
    setHexText((h) => ({ ...h, [key]: value }))
    const norm = normalizeHex(value)
    if (HEX_RE.test(norm)) setDraft((d) => ({ ...d, palette: { ...d.palette, [key]: norm } }))
  }, [])

  // Live preview: the whole dashboard wears the draft while editing; closing puts the real theme back
  useEffect(() => {
    if (!preview) { setThemePreviewing(false); syncDocumentTheme(); return }
    setThemePreviewing(true)
    const t = setTimeout(() => applyTheme(draft), 60)
    return () => clearTimeout(t)
  }, [draft, preview])
  useEffect(() => () => { setThemePreviewing(false); syncDocumentTheme() }, [])

  const validation = useMemo(() => validateTheme(draft), [draft])
  const sanitized = useMemo(() => sanitizeCss(draft.css), [draft.css])
  const p = draft.palette
  const contrastText = contrastLabel(contrastRatio(p.text, p.bg))
  const contrastMuted = contrastLabel(contrastRatio(p.textMuted, p.bg))
  const contrastSurface = contrastLabel(contrastRatio(p.text, p.surface))

  const commit = async (where: 'server' | 'local') => {
    const v = validateTheme(draft)
    if (!v.ok || !v.theme) { setErrors(v.errors); return }
    setErrors([])
    setSaving(where)
    try {
      if (where === 'server') {
        const res = await saveServer(v.theme)
        if (res.stripped && res.stripped.length) addToast({ type: 'info', message: `Saved, with a note: ${res.stripped.join('; ')}` })
        else addToast({ type: 'success', message: `${v.theme.title} ${res.replaced ? 'updated on' : 'saved to'} the server` })
        onSaved(res.theme, 'server')
      } else {
        saveLocal(v.theme)
        addToast({ type: 'success', message: `${v.theme.title} saved on this device` })
        onSaved(v.theme, 'local')
      }
    } catch (err) {
      addToast({ type: 'error', message: `Could not save the theme: ${errorText(err)}` })
    } finally {
      setSaving(null)
    }
  }

  const exportFile = () => {
    const v = validateTheme(draft)
    if (!v.ok || !v.theme) { setErrors(v.errors); return }
    setErrors([])
    downloadJson(v.theme.name, themeToJson(v.theme))
  }

  const footer = (
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none mr-auto">
        <button type="button" onClick={() => setPreview((v) => !v)} className={`${ICON_BTN} ${preview ? 'text-emerald-400' : ''}`} aria-pressed={preview} aria-label="Preview while editing">
          {preview ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        {preview ? 'Previewing live' : 'Preview off'}
      </label>
      <button type="button" onClick={onClose} className={BTN_QUIET}>Cancel</button>
      <button type="button" onClick={exportFile} className={BTN_GHOST}><Download size={14} /> Save as file</button>
      <button type="button" onClick={() => commit('local')} disabled={!!saving} className={isAdmin && serverOk ? BTN_GHOST : BTN_PRIMARY}>
        {saving === 'local' ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />} Save on this device
      </button>
      {isAdmin && serverOk && (
        <button type="button" onClick={() => commit('server')} disabled={!!saving} className={BTN_PRIMARY}>
          {saving === 'server' ? <Loader2 size={14} className="animate-spin" /> : <Server size={14} />} Save to server
        </button>
      )}
    </div>
  )

  return (
    <Sheet title={editing ? `Edit ${initial.title || initial.name}` : 'Theme Studio'} icon={<Palette size={16} className="text-violet-400" />} onClose={onClose} footer={footer} wide keepOnBackdrop>
      <div className="space-y-5">
        {/* Identity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Title</label>
            <input
              type="text"
              value={draft.title}
              placeholder="Midnight Teal"
              onChange={(e) => {
                const title = e.target.value
                setDraft((d) => ({ ...d, title, name: nameTouched ? d.name : slugify(title) }))
              }}
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Name <span className="text-slate-600">(id: a-z, 0-9, dashes)</span></label>
            <input
              type="text"
              value={draft.name}
              placeholder="midnight-teal"
              disabled={editing}
              onChange={(e) => { setNameTouched(true); update('name', e.target.value.toLowerCase()) }}
              className={`${INPUT} font-mono ${draft.name && !THEME_NAME_RE.test(draft.name) ? 'border-rose-500/40' : ''} disabled:opacity-60`}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Description</label>
            <input type="text" value={draft.description} placeholder="One line about the mood" onChange={(e) => update('description', e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Author</label>
            <input type="text" value={draft.author} placeholder="Your name" onChange={(e) => update('author', e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Version</label>
            <input type="text" value={draft.version} placeholder="1.0.0" onChange={(e) => update('version', e.target.value)} className={`${INPUT} font-mono`} />
          </div>
        </div>

        {/* Mode */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1.5">Mode</label>
          <div className="flex items-center gap-2">
            {(['dark', 'light'] as ThemeMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => update('mode', m)}
                className={`${BTN} border ${draft.mode === m
                  ? (m === 'dark' ? 'bg-slate-800 border-violet-500/30 text-violet-400 ring-1 ring-violet-500/20' : 'bg-slate-800 border-amber-500/30 text-amber-400 ring-1 ring-amber-500/20')
                  : 'bg-white/[0.03] border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10'}`}
              >
                {m === 'dark' ? <Moon size={14} /> : <Sun size={14} />} {m === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
            <span className="text-[10px] text-slate-500 ml-1">A light theme layers its palette on the light look.</span>
          </div>
        </div>

        {/* Palette */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-medium text-slate-400">Palette</label>
            <ThemeThumb palette={p} className="!w-36 !h-12" />
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/5 divide-y divide-white/[0.04]">
            {PALETTE_KEYS.map((key) => {
              const hint = key === 'text' ? contrastText : key === 'textMuted' ? contrastMuted : key === 'surface' ? contrastSurface : null
              return (
                <div key={key} className="flex items-center gap-3 px-3 py-2">
                  <label className="relative w-8 h-8 shrink-0 rounded-md border border-white/10 overflow-hidden cursor-pointer" style={{ backgroundColor: p[key] }} title="Pick a colour">
                    <input
                      type="color"
                      value={p[key]}
                      onChange={(e) => setColor(key, e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      aria-label={`${PALETTE_LABELS[key].label} colour`}
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-200 font-medium">{PALETTE_LABELS[key].label}</div>
                    <div className="text-[10px] text-slate-500 truncate">{PALETTE_LABELS[key].hint}{hint && <span className={`ml-1.5 ${hint.cls}`}>· {hint.text}{key === 'surface' ? ' text on surface' : ' on background'}</span>}</div>
                  </div>
                  <input
                    type="text"
                    value={hexText[key] ?? p[key]}
                    onChange={(e) => setColor(key, e.target.value)}
                    onBlur={() => setHexText((h) => ({ ...h, [key]: p[key] }))}
                    spellCheck={false}
                    className={`${INPUT} !w-24 font-mono text-center ${HEX_RE.test(normalizeHex(hexText[key] ?? '')) ? '' : 'border-rose-500/40'}`}
                    aria-label={`${PALETTE_LABELS[key].label} hex`}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Font and radius */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Font <span className="text-slate-600">(must already be on the device)</span></label>
            <input type="text" value={draft.font} placeholder="Inter" onChange={(e) => update('font', e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Roundness</label>
            <div className="flex items-center gap-1">
              {([...THEME_RADII] as ThemeRadius[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => update('radius', r === 'lg' ? '' : r)}
                  className={`${BTN} flex-1 justify-center border uppercase ${(draft.radius || 'lg') === r ? 'bg-slate-800 border-emerald-500/30 text-emerald-400' : 'bg-white/[0.03] border-white/5 text-slate-500 hover:text-slate-300'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Extra CSS */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Extra CSS <span className="text-slate-600">(optional, up to 64 KB)</span></label>
          <textarea
            value={draft.css}
            onChange={(e) => update('css', e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={'/* the palette is available as variables */\n.glass { box-shadow: 0 0 0 1px var(--dcs-border); }'}
            className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-emerald-400 placeholder-slate-700 font-mono focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-violet-500/15 resize-y transition-all leading-relaxed"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            {CSS_SANITIZE_NOTE}
            {sanitized.stripped.length > 0 && <span className="text-amber-400"> Removed here: {sanitized.stripped.join(', ')}.</span>}
            {' '}Variables: --dcs-accent, --dcs-bg, --dcs-surface, --dcs-surface-raised, --dcs-border, --dcs-text, --dcs-text-muted, --dcs-success, --dcs-warning, --dcs-danger, --dcs-info, --dcs-radius.
          </p>
        </div>

        {(errors.length > 0 || (!validation.ok && (draft.name || draft.title))) && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-[11px] text-rose-300 space-y-0.5">
            {(errors.length ? errors : validation.errors).map((e) => <div key={e}>{e}</div>)}
          </div>
        )}
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

type InstallTab = 'paste' | 'file' | 'url'

interface InstallProps {
  isAdmin: boolean
  serverOk: boolean
  onClose: () => void
  onInstalled: (theme: Theme, where: 'server' | 'local') => void
}

function InstallSheet({ isAdmin, serverOk, onClose, onInstalled }: InstallProps) {
  const { addToast } = useToast()
  const confirm = useConfirm()
  const metas = useThemeStore((s) => s.metas)
  const localThemes = useThemeStore((s) => s.localThemes)
  const saveServer = useThemeStore((s) => s.save)
  const saveLocal = useThemeStore((s) => s.saveLocal)
  const importFromUrl = useThemeStore((s) => s.importFromUrl)
  const canServer = isAdmin && serverOk
  const [tab, setTab] = useState<InstallTab>('paste')
  const [where, setWhere] = useState<'server' | 'local'>(canServer ? 'server' : 'local')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // what the pasted / picked document validates to
  const parsed = useMemo(() => {
    if (!text.trim()) return null
    try {
      return validateTheme(JSON.parse(text))
    } catch {
      return { ok: false, errors: ['That is not valid JSON'], theme: null }
    }
  }, [text])

  const readFile = (file: File | undefined) => {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setText(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => addToast({ type: 'error', message: `Could not read ${file.name}` })
    reader.readAsText(file)
  }

  const installDocument = async (theme: Theme) => {
    if (where === 'server') {
      if (metas.some((m) => m.name === theme.name)) {
        const ok = await confirm({ title: 'Replace the server theme?', message: `A theme named "${theme.name}" is stored on the server already. Installing replaces it for everyone who follows it.`, confirmLabel: 'Replace' })
        if (!ok) return
      }
      const res = await saveServer(theme)
      if (res.stripped && res.stripped.length) addToast({ type: 'info', message: `Installed, with a note: ${res.stripped.join('; ')}` })
      else addToast({ type: 'success', message: `${theme.title} installed on the server` })
      onInstalled(res.theme, 'server')
    } else {
      if (localThemes.some((t) => t.name === theme.name)) {
        const ok = await confirm({ title: 'Replace the theme on this device?', message: `You already have a theme named "${theme.name}" on this device.`, confirmLabel: 'Replace' })
        if (!ok) return
      }
      saveLocal(theme)
      addToast({ type: 'success', message: `${theme.title} installed on this device` })
      onInstalled(theme, 'local')
    }
  }

  const install = async () => {
    setBusy(true)
    try {
      if (tab === 'url') {
        const u = url.trim()
        if (!/^https:\/\//i.test(u)) { addToast({ type: 'warning', message: 'Give an https address of a theme JSON file' }); return }
        if (where === 'server') {
          try {
            const res = await importFromUrl(u)
            if (res.stripped && res.stripped.length) addToast({ type: 'info', message: `Installed, with a note: ${res.stripped.join('; ')}` })
            else addToast({ type: 'success', message: `${res.theme.title} installed on the server` })
            onInstalled(res.theme, 'server')
          } catch (err) {
            if (err instanceof ApiError && err.status === 409) {
              const ok = await confirm({ title: 'Replace the server theme?', message: `${err.message}\n\nReplace it for everyone who follows it?`, confirmLabel: 'Replace' })
              if (!ok) return
              const res = await importFromUrl(u, true)
              addToast({ type: 'success', message: `${res.theme.title} replaced on the server` })
              onInstalled(res.theme, 'server')
            } else {
              throw err
            }
          }
        } else {
          // no server import for this person: the browser fetches it (the site must allow cross-origin reads)
          const resp = await fetch(u, { headers: { Accept: 'application/json' } })
          if (!resp.ok) throw new Error(`The address answered ${resp.status}`)
          const body = await resp.text()
          if (body.length > 262144) throw new Error('The document is larger than 256 KB')
          const v = validateTheme(JSON.parse(body))
          if (!v.ok || !v.theme) { addToast({ type: 'error', message: `Not a theme: ${v.errors[0]}` }); return }
          await installDocument(v.theme)
        }
        return
      }
      if (!parsed || !parsed.ok || !parsed.theme) {
        addToast({ type: 'warning', message: parsed?.errors[0] ?? 'Paste a theme document or pick a file first' })
        return
      }
      await installDocument(parsed.theme)
    } catch (err) {
      addToast({ type: 'error', message: `Could not install the theme: ${errorText(err)}` })
    } finally {
      setBusy(false)
    }
  }

  const tabs: Array<{ id: InstallTab; label: string; icon: React.ReactNode }> = [
    { id: 'paste', label: 'Paste JSON', icon: <FileJson size={14} /> },
    { id: 'file', label: 'From file', icon: <Upload size={14} /> },
    { id: 'url', label: 'From URL', icon: <Link size={14} /> },
  ]

  const footer = (
    <div className="flex flex-wrap items-center gap-2">
      {canServer ? (
        <div className="flex items-center gap-1 mr-auto">
          {(['server', 'local'] as const).map((w) => (
            <button key={w} type="button" onClick={() => setWhere(w)} className={`${BTN} border ${where === w ? 'bg-slate-800 border-emerald-500/30 text-emerald-400' : 'bg-white/[0.03] border-white/5 text-slate-500 hover:text-slate-300'}`}>
              {w === 'server' ? <Server size={14} /> : <Smartphone size={14} />} {w === 'server' ? 'Server' : 'This device'}
            </button>
          ))}
        </div>
      ) : (
        <span className="text-[10px] text-slate-500 mr-auto inline-flex items-center gap-1"><Smartphone size={12} /> Installs on this device{isAdmin ? ' (this server has no theme API)' : ''}</span>
      )}
      <button type="button" onClick={onClose} className={BTN_QUIET}>Cancel</button>
      <button type="button" onClick={install} disabled={busy} className={BTN_PRIMARY}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Install
      </button>
    </div>
  )

  return (
    <Sheet title="Install a theme" icon={<Download size={16} className="text-cyan-400" />} onClose={onClose} footer={footer}>
      <div className="space-y-4">
        <div className="flex items-center gap-1 rounded-lg bg-white/[0.03] border border-white/5 p-1">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`${BTN} flex-1 justify-center ${tab === t.id ? 'bg-white/10 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'paste' && (
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setFileName('') }}
            rows={12}
            spellCheck={false}
            placeholder={'{ "schema": 1, "name": "midnight-teal", "title": "Midnight Teal", "mode": "dark", "palette": { "accent": "#2dd4bf", "bg": "#0b1020", "surface": "#111a2e", "text": "#e6edf7" } }'}
            className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-700 font-mono focus:outline-none focus:border-emerald-500/50 resize-y transition-all leading-relaxed"
          />
        )}

        {tab === 'file' && (
          <div
            className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center cursor-pointer hover:border-emerald-500/30 hover:bg-white/[0.04] transition-all"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer.files?.[0]) }}
          >
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
            <Upload size={20} className="mx-auto text-slate-500 mb-2" />
            <p className="text-xs text-slate-300">{fileName || 'Pick a .theme.json file, or drop it here'}</p>
            <p className="text-[10px] text-slate-500 mt-1">A document saved by the Theme Studio, or one exported from another dashboard</p>
          </div>
        )}

        {tab === 'url' && (
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">https address of the theme JSON</label>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/themes/midnight-teal.json" className={`${INPUT} font-mono`} />
            <p className="text-[10px] text-slate-500 mt-1">
              {where === 'server' ? 'The server fetches it (256 KB at most) and stores it.' : 'Fetched by this browser; the site must allow cross-origin reads.'}
            </p>
          </div>
        )}

        {tab !== 'url' && parsed && (
          parsed.ok && parsed.theme ? (
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex items-center gap-3">
              <div className="w-28 shrink-0"><ThemeThumb palette={parsed.theme.palette} className="!h-14" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="text-xs font-semibold text-slate-100 truncate">{parsed.theme.title}</span><ModeChip mode={parsed.theme.mode} /></div>
                <div className="text-[10px] text-slate-500 font-mono">{parsed.theme.name} · v{parsed.theme.version}{parsed.theme.author ? ` · ${parsed.theme.author}` : ''}</div>
                {parsed.theme.description && <div className="text-[10px] text-slate-400 mt-0.5 truncate">{parsed.theme.description}</div>}
                {parsed.theme.css && <div className="text-[10px] text-amber-400 mt-0.5">Carries extra CSS ({(parsed.theme.css.length / 1024).toFixed(1)} KB) — sanitised before use.</div>}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-[11px] text-rose-300 space-y-0.5">
              {parsed.errors.map((e) => <div key={e}>{e}</div>)}
            </div>
          )
        )}
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// The gallery
// ---------------------------------------------------------------------------

interface Entry {
  theme: Theme
  source: ThemeSource
}

export default function ThemesPanel() {
  const { addToast } = useToast()
  const confirm = useConfirm()
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const themeName = useSettingsStore((s) => s.themeName)
  const serverThemeActive = useSettingsStore((s) => s.serverThemeActive)
  const updateSetting = useSettingsStore((s) => s.updateSetting)
  const supported = useThemeStore((s) => s.supported)
  const metas = useThemeStore((s) => s.metas)
  const docs = useThemeStore((s) => s.docs)
  const localThemes = useThemeStore((s) => s.localThemes)
  const loading = useThemeStore((s) => s.loading)
  const storeError = useThemeStore((s) => s.error)
  const refresh = useThemeStore((s) => s.refresh)
  const ensureDoc = useThemeStore((s) => s.ensureDoc)
  const saveServer = useThemeStore((s) => s.save)
  const removeServer = useThemeStore((s) => s.remove)
  const removeLocal = useThemeStore((s) => s.removeLocal)
  const setActive = useThemeStore((s) => s.setActive)

  const serverOk = isConnected && supported === true
  const effective = themeName || serverThemeActive

  const [studio, setStudio] = useState<{ theme: Theme; editing: boolean } | null>(null)
  const [installOpen, setInstallOpen] = useState(false)
  const [working, setWorking] = useState<string | null>(null)

  const entries = useMemo<Entry[]>(() => {
    const byName = new Map<string, Entry>()
    for (const b of BUILT_IN_THEMES) byName.set(b.name, { theme: b, source: 'built-in' })
    for (const m of metas) byName.set(m.name, { theme: docs[m.name] ?? themeFromMeta(m), source: 'server' })
    for (const l of localThemes) byName.set(l.name, { theme: l, source: 'local' })
    const order = (e: Entry) => (e.source === 'built-in' ? 0 : e.source === 'server' ? 1 : 2)
    const builtInIndex = new Map(BUILT_IN_THEMES.map((b, i) => [b.name, i]))
    return [...byName.values()].sort((a, b) => {
      const ba = builtInIndex.has(a.theme.name) ? 0 : 1
      const bb = builtInIndex.has(b.theme.name) ? 0 : 1
      if (ba !== bb) return ba - bb
      if (ba === 0) return (builtInIndex.get(a.theme.name) ?? 0) - (builtInIndex.get(b.theme.name) ?? 0)
      const oa = order(a)
      const ob = order(b)
      if (oa !== ob) return oa - ob
      return a.theme.title.localeCompare(b.theme.title)
    })
  }, [metas, docs, localThemes])

  const titleOf = (name: string) => entries.find((e) => e.theme.name === name)?.theme.title ?? name

  const use = (name: string) => {
    updateSetting('themeName', name)
    addToast({ type: 'success', message: `Now wearing ${titleOf(name)}` })
  }
  const followServer = () => {
    updateSetting('themeName', '')
    addToast({ type: 'info', message: serverThemeActive ? `Following the server's theme, ${titleOf(serverThemeActive)}` : 'Back to the default look' })
  }

  /** the full document (css included) for a server theme before editing, duplicating or exporting it */
  const fullDoc = async (entry: Entry): Promise<Theme> => {
    if (entry.source !== 'server') return entry.theme
    const meta = metas.find((m) => m.name === entry.theme.name)
    if (!meta?.has_css || docs[entry.theme.name]) return docs[entry.theme.name] ?? entry.theme
    return (await ensureDoc(entry.theme.name)) ?? entry.theme
  }

  const setForEveryone = async (entry: Entry) => {
    setWorking(entry.theme.name)
    try {
      const doc = await fullDoc(entry)
      if (entry.source !== 'server') {
        // the server only activates a theme it stores: put the document there first, under the same name
        if (metas.some((m) => m.name === doc.name)) {
          const ok = await confirm({ title: 'Replace the server copy?', message: `The server already stores a theme named "${doc.name}". Setting this one for everyone replaces it.`, confirmLabel: 'Replace and set' })
          if (!ok) return
        }
        await saveServer(doc)
      }
      await setActive(doc.name)
      addToast({ type: 'success', message: `Everyone now follows ${doc.title}` })
    } catch (err) {
      addToast({ type: 'error', message: `Could not set the theme for everyone: ${errorText(err)}` })
    } finally {
      setWorking(null)
    }
  }

  const clearForEveryone = async () => {
    setWorking('__clear')
    try {
      await setActive('')
      addToast({ type: 'info', message: 'Everyone is back to the default look' })
    } catch (err) {
      addToast({ type: 'error', message: `Could not clear the server theme: ${errorText(err)}` })
    } finally {
      setWorking(null)
    }
  }

  const edit = async (entry: Entry) => {
    const doc = await fullDoc(entry)
    setStudio({ theme: doc, editing: true })
  }
  const duplicate = async (entry: Entry) => {
    const doc = await fullDoc(entry)
    setStudio({ theme: { ...doc, name: slugify(`${doc.name}-copy`), title: `${doc.title} copy`, author: '', updated_at: undefined }, editing: false })
  }
  const exportJson = async (entry: Entry) => {
    const doc = await fullDoc(entry)
    downloadJson(doc.name, themeToJson(doc))
  }
  const remove = async (entry: Entry) => {
    const ok = await confirm({
      title: entry.source === 'server' ? 'Delete this theme from the server?' : 'Delete this theme from this device?',
      message: entry.source === 'server'
        ? `"${entry.theme.title}" goes away for everyone; dashboards following it return to the default look.`
        : `"${entry.theme.title}" is removed from this browser.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setWorking(entry.theme.name)
    try {
      if (entry.source === 'server') await removeServer(entry.theme.name)
      else removeLocal(entry.theme.name)
      if (themeName === entry.theme.name) updateSetting('themeName', '')
      addToast({ type: 'success', message: `${entry.theme.title} deleted` })
    } catch (err) {
      addToast({ type: 'error', message: `Could not delete the theme: ${errorText(err)}` })
    } finally {
      setWorking(null)
    }
  }

  const onSaved = (theme: Theme) => {
    setStudio(null)
    setInstallOpen(false)
    // the person was looking at it: keep wearing it
    updateSetting('themeName', theme.name)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[12rem]">
          <p className="text-[11px] text-slate-500">
            A theme is a palette the whole dashboard follows. Pick one for yourself, or make and share your own; it travels as a small JSON document.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && supported !== false && (
            <button type="button" onClick={() => refresh()} className={ICON_BTN} title="Re-read the server's themes" aria-label="Refresh">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
          <button type="button" onClick={() => setInstallOpen(true)} className={BTN_GHOST}><Download size={14} /> Install</button>
          <button type="button" onClick={() => setStudio({ theme: blankTheme('dark'), editing: false })} className={BTN_PRIMARY}><Plus size={14} /> New theme</button>
        </div>
      </div>

      {/* Where the look comes from */}
      <div className="rounded-lg bg-white/[0.03] border border-white/[0.03] px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-slate-300">
          <Globe size={12} className="text-cyan-400" />
          {supported === false
            ? 'This server has no theme API yet: built-in and on-device themes work; sharing needs DCS 3.9.2 or newer.'
            : serverThemeActive
              ? <>Everyone follows <span className="text-slate-100 font-medium">{titleOf(serverThemeActive)}</span></>
              : 'The server sets no theme; everyone gets the default look.'}
        </span>
        {themeName && (
          <span className="inline-flex items-center gap-1.5 text-slate-400 sm:border-l sm:border-white/10 sm:pl-3">
            You picked <span className="text-slate-200 font-medium">{titleOf(themeName)}</span>
            <button type="button" onClick={followServer} className="text-emerald-400 hover:text-emerald-300 font-medium">Follow server</button>
          </span>
        )}
        {isAdmin && serverOk && serverThemeActive && (
          <button type="button" onClick={clearForEveryone} disabled={working === '__clear'} className="ml-auto text-slate-400 hover:text-rose-400 font-medium">Clear for everyone</button>
        )}
        {storeError && <span className="text-amber-400 w-full">Could not read the server's themes: {storeError}</span>}
      </div>

      {/* Gallery */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
        {entries.map((entry) => {
          const t = entry.theme
          const isEffective = effective === t.name
          const isPersonal = themeName === t.name
          const isServerActive = serverThemeActive === t.name
          const busy = working === t.name
          const canManage = entry.source === 'local' || (entry.source === 'server' && isAdmin && serverOk)
          return (
            <div
              key={`${entry.source}:${t.name}`}
              className={`group rounded-xl bg-white/[0.03] border p-3 flex flex-col gap-2.5 transition-all ${isEffective ? 'border-emerald-500/30 ring-1 ring-emerald-500/20' : 'border-white/5 hover:border-white/10'}`}
            >
              <ThemeThumb palette={t.palette} />
              <SwatchStrip palette={t.palette} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-semibold text-slate-100 truncate">{t.title}</span>
                  <ModeChip mode={t.mode} />
                  {isEffective && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"><Check size={10} /> Active</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 min-w-0">
                  <span className="truncate">{t.author ? `by ${t.author}` : `v${t.version}`}</span>
                  <span>·</span>
                  <SourceChip source={entry.source} />
                  {isServerActive && <span className="inline-flex items-center gap-1 text-cyan-400"><Globe size={10} /> Everyone</span>}
                </div>
                {t.description && <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{t.description}</p>}
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-1.5">
                {isPersonal ? (
                  <button type="button" onClick={followServer} className={BTN_GHOST}><Globe size={14} /> Follow server</button>
                ) : (
                  <button type="button" onClick={() => use(t.name)} className={BTN_PRIMARY}><Check size={14} /> Use</button>
                )}
                {isAdmin && serverOk && !isServerActive && (
                  <button type="button" onClick={() => setForEveryone(entry)} disabled={busy} className={BTN_GHOST} title="Every dashboard on this server follows it">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />} Set for everyone
                  </button>
                )}
                <div className="ml-auto flex items-center">
                  {canManage && <button type="button" onClick={() => edit(entry)} className={ICON_BTN} title="Edit" aria-label="Edit"><Pencil size={14} /></button>}
                  <button type="button" onClick={() => duplicate(entry)} className={ICON_BTN} title="Duplicate into the studio" aria-label="Duplicate"><Copy size={14} /></button>
                  <button type="button" onClick={() => exportJson(entry)} className={ICON_BTN} title="Export JSON" aria-label="Export JSON"><FileJson size={14} /></button>
                  {canManage && <button type="button" onClick={() => remove(entry)} disabled={busy} className={`${ICON_BTN} hover:!text-rose-400`} title="Delete" aria-label="Delete"><Trash2 size={14} /></button>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {studio && (
        <ThemeStudio
          initial={studio.theme}
          editing={studio.editing}
          isAdmin={isAdmin}
          serverOk={serverOk}
          onClose={() => setStudio(null)}
          onSaved={onSaved}
        />
      )}
      {installOpen && (
        <InstallSheet isAdmin={isAdmin} serverOk={serverOk} onClose={() => setInstallOpen(false)} onInstalled={onSaved} />
      )}
    </div>
  )
}
