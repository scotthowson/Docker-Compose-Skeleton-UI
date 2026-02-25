// =============================================================================
// Templates — Stack Templates / Quick Deploy Gallery with category filtering,
//             search, template cards, and deploy modal
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Rocket,
  Search,
  RefreshCw,
  Package,
  Database,
  Tv,
  BarChart3,
  Globe,
  Code,
  HardDrive,
  Loader2,
  Play,
  Eye,
  X,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Save,
  Upload,
  Download,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import { fetchTemplates, fetchTemplateDetail, deployTemplate, importTemplate, updateTemplate, deleteTemplate } from '../api/endpoints'
import type {
  TemplateInfo,
  TemplateDetailResponse,
  TemplateListResponse,
} from '../../shared/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type CategoryId = 'all' | 'databases' | 'media' | 'monitoring' | 'web' | 'development' | 'storage'

interface CategoryDef {
  id: CategoryId
  label: string
  icon: React.ElementType
}

const CATEGORIES: CategoryDef[] = [
  { id: 'all', label: 'All', icon: Package },
  { id: 'databases', label: 'Databases', icon: Database },
  { id: 'media', label: 'Media', icon: Tv },
  { id: 'monitoring', label: 'Monitoring', icon: BarChart3 },
  { id: 'web', label: 'Web', icon: Globe },
  { id: 'development', label: 'Development', icon: Code },
  { id: 'storage', label: 'Storage', icon: HardDrive },
]

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  databases: Database,
  database: Database,
  db: Database,
  media: Tv,
  monitoring: BarChart3,
  metrics: BarChart3,
  web: Globe,
  development: Code,
  dev: Code,
  storage: HardDrive,
  backup: HardDrive,
}

const CATEGORY_COLOR_MAP: Record<string, { badge: string; iconColor: string }> = {
  databases: { badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20', iconColor: 'text-cyan-400' },
  database: { badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20', iconColor: 'text-cyan-400' },
  db: { badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20', iconColor: 'text-cyan-400' },
  media: { badge: 'bg-violet-500/15 text-violet-400 border-violet-500/20', iconColor: 'text-violet-400' },
  monitoring: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20', iconColor: 'text-amber-400' },
  metrics: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20', iconColor: 'text-amber-400' },
  web: { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', iconColor: 'text-emerald-400' },
  development: { badge: 'bg-rose-500/15 text-rose-400 border-rose-500/20', iconColor: 'text-rose-400' },
  dev: { badge: 'bg-rose-500/15 text-rose-400 border-rose-500/20', iconColor: 'text-rose-400' },
  storage: { badge: 'bg-sky-500/15 text-sky-400 border-sky-500/20', iconColor: 'text-sky-400' },
  backup: { badge: 'bg-sky-500/15 text-sky-400 border-sky-500/20', iconColor: 'text-sky-400' },
}

const DEFAULT_CATEGORY_COLOR = {
  badge: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  iconColor: 'text-slate-400',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryIcon(category: string): React.ElementType {
  return CATEGORY_ICON_MAP[category.toLowerCase()] ?? Package
}

function getCategoryColors(category: string) {
  return CATEGORY_COLOR_MAP[category.toLowerCase()] ?? DEFAULT_CATEGORY_COLOR
}

function matchesCategory(template: TemplateInfo, filter: CategoryId): boolean {
  if (filter === 'all') return true
  const cat = template.category.toLowerCase()
  // Allow substring matching for flexibility (e.g. "database" matches "databases")
  return cat === filter || cat === filter.slice(0, -1) || filter.startsWith(cat)
}

/** Parse ${VAR_NAME} and ${VAR:-default} patterns from compose YAML */
function parseComposeVariables(compose: string): { name: string; defaultValue: string }[] {
  const varMap = new Map<string, string>()
  // Match ${VAR}, ${VAR:-default}, ${VAR:-}, ${VAR:?err}
  const regex = /\$\{([A-Z_][A-Z0-9_]*)(?::?[-=?+]([^}]*))?\}/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(compose)) !== null) {
    const varName = match[1]
    const defaultVal = match[2] || ''
    // Skip standard inherited vars (these come from root .env)
    if (['TZ', 'PUID', 'PGID', 'APP_DATA_DIR', 'BASE_DIR', 'PROXY_DOMAIN'].includes(varName)) continue
    if (!varMap.has(varName)) {
      varMap.set(varName, defaultVal)
    }
  }
  return Array.from(varMap.entries()).map(([name, defaultValue]) => ({ name, defaultValue }))
}

function matchesSearch(template: TemplateInfo, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    template.name.toLowerCase().includes(q) ||
    template.description.toLowerCase().includes(q) ||
    template.tags.some((t) => t.toLowerCase().includes(q))
  )
}

// ---------------------------------------------------------------------------
// Deploy Modal
// ---------------------------------------------------------------------------

interface DeployModalProps {
  template: TemplateInfo
  detail: TemplateDetailResponse | null
  detailLoading: boolean
  onClose: () => void
  onDeploy: (stackName: string, variables: Record<string, string>, autoStart: boolean) => void
  deploying: boolean
}

function DeployModal({ template, detail, detailLoading, onClose, onDeploy, deploying }: DeployModalProps) {
  const [stackName, setStackName] = useState(template.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))
  const [variables, setVariables] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    const vars = detail?.template.variables ?? template.variables ?? []
    for (const v of vars) {
      init[v.name] = v.default ?? ''
    }
    return init
  })
  const [autoStart, setAutoStart] = useState(true)
  const [showCompose, setShowCompose] = useState(false)

  // Sync variables when detail loads
  const templateVars = detail?.template.variables ?? template.variables ?? []

  // Update variables when detail arrives and we have new variable definitions
  useEffect(() => {
    if (!detail?.template.variables) return
    const vars = detail.template.variables
    setVariables((prev) => {
      const merged: Record<string, string> = {}
      for (const v of vars) {
        merged[v.name] = prev[v.name] || v.default || ''
      }
      return merged
    })
  }, [detail])

  const handleVariableChange = useCallback((name: string, value: string) => {
    setVariables((prev) => ({ ...prev, [name]: value }))
  }, [])

  const canDeploy = stackName.trim().length > 0 && !deploying && !detailLoading

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-3 md:mx-4 max-h-[90vh] bg-slate-900 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 flex flex-col animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Rocket size={16} className="text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-200 truncate">Deploy: {template.name}</h3>
              <p className="text-[11px] text-slate-500 truncate">{template.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors shrink-0 ml-2"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 scrollbar-thin">
          {/* Stack name */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Stack Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={stackName}
              onChange={(e) => setStackName(e.target.value)}
              placeholder="my-stack-name"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 focus:bg-white/[0.05] transition-colors"
            />
          </div>

          {/* Template variables */}
          {templateVars.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Variables
              </label>
              <div className="space-y-2.5">
                {templateVars.map((v) => (
                  <div key={v.name}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-400 font-medium">{v.label || v.name}</span>
                      {v.required && (
                        <span className="text-[9px] text-rose-400 font-semibold">Required</span>
                      )}
                    </div>
                    <input
                      type={v.type === 'password' ? 'password' : 'text'}
                      value={variables[v.name] ?? ''}
                      onChange={(e) => handleVariableChange(v.name, e.target.value)}
                      placeholder={v.default || v.name}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 focus:bg-white/[0.05] transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auto-start toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-xs font-medium text-slate-300">Auto-start after deploy</p>
              <p className="text-[11px] text-slate-500">Automatically start the stack after creation</p>
            </div>
            <button
              onClick={() => setAutoStart((prev) => !prev)}
              className={`relative w-10 h-[22px] rounded-full border transition-colors duration-200 ${
                autoStart
                  ? 'bg-emerald-500/30 border-emerald-500/40'
                  : 'bg-white/[0.06] border-white/[0.08]'
              }`}
            >
              <span
                className={`absolute top-[2px] w-4 h-4 rounded-full transition-all duration-200 ${
                  autoStart
                    ? 'left-[22px] bg-emerald-400'
                    : 'left-[2px] bg-slate-500'
                }`}
              />
            </button>
          </div>

          {/* Compose preview (collapsible) */}
          <div>
            <button
              onClick={() => setShowCompose((prev) => !prev)}
              className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${showCompose ? '' : '-rotate-90'}`}
              />
              <Eye size={13} />
              Compose Preview
            </button>
            {showCompose && (
              <div className="mt-2">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-8 bg-slate-950 rounded-lg">
                    <Loader2 size={18} className="animate-spin text-slate-600" />
                  </div>
                ) : detail?.compose ? (
                  <pre className="bg-slate-950 rounded-lg p-3 text-[11px] font-mono text-slate-400 overflow-x-auto max-h-64 scrollbar-thin leading-relaxed whitespace-pre-wrap break-all">
                    {detail.compose}
                  </pre>
                ) : (
                  <div className="bg-slate-950 rounded-lg p-3 text-xs text-slate-600 italic">
                    No compose content available
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 md:px-5 py-4 border-t border-white/[0.06] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onDeploy(stackName.trim(), variables, autoStart)}
            disabled={!canDeploy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed press"
          >
            {deploying ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Rocket size={13} />
            )}
            Deploy Stack
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Create / Edit Template Modal
// ---------------------------------------------------------------------------

interface CreateEditModalProps {
  mode: 'create' | 'edit'
  initial?: { name: string; compose: string; env: string; metadata: Record<string, unknown> }
  onClose: () => void
  onSave: (data: { name: string; compose: string; env: string; metadata: Record<string, unknown> }) => void
  saving: boolean
}

function CreateEditModal({ mode, initial, onClose, onSave, saving }: CreateEditModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [title, setTitle] = useState((initial?.metadata?.title as string) ?? '')
  const [description, setDescription] = useState((initial?.metadata?.description as string) ?? '')
  const [category, setCategory] = useState((initial?.metadata?.category as string) ?? 'other')
  const [compose, setCompose] = useState(initial?.compose ?? 'services:\n  app:\n    image: example:latest\n    restart: unless-stopped\n    volumes:\n      - ${APP_DATA_DIR:-./App-Data}/App:/data\n')
  const [env, setEnv] = useState(initial?.env ?? `# =============================================================================
# Stack Configuration
# Inherits from root .env — only add stack-specific overrides here
# =============================================================================

# Base path for persistent data (inherited from root .env)
# APP_DATA_DIR is set in the root .env file

# Domain for reverse proxy labels
# PROXY_DOMAIN is set in the root .env file

# User/Group IDs
# PUID and PGID are set in the root .env file

# Timezone
# TZ is set in the root .env file

# Stack-specific overrides below
`)
  const [activeTab, setActiveTab] = useState<'compose' | 'env' | 'meta'>('compose')

  const canSave = name.trim().length > 0 && compose.trim().length > 0 && !saving

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-3xl mx-3 md:mx-4 max-h-[90vh] bg-slate-900 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 flex flex-col animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${mode === 'create' ? 'bg-emerald-500/15 border-emerald-500/20' : 'bg-cyan-500/15 border-cyan-500/20'} border flex items-center justify-center shrink-0`}>
              {mode === 'create' ? <Plus size={16} className="text-emerald-400" /> : <Pencil size={16} className="text-cyan-400" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{mode === 'create' ? 'Create Template' : `Edit: ${initial?.name}`}</h3>
              <p className="text-[10px] text-slate-500">Define a reusable stack template</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Name + metadata row */}
          <div className="px-4 md:px-5 py-4 space-y-3 border-b border-white/[0.06]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Template Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                  placeholder="my-template"
                  disabled={mode === 'edit'}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 transition-colors disabled:opacity-50 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Display Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Template"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description..."
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 focus:outline-none focus:border-emerald-500/30 transition-colors"
                >
                  <option value="databases">Databases</option>
                  <option value="media">Media</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="web">Web</option>
                  <option value="development">Development</option>
                  <option value="storage">Storage</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Editor tabs */}
          <div className="flex items-center gap-0.5 px-4 md:px-5 pt-3 pb-0">
            {(['compose', 'env', 'meta'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-t-lg text-[11px] font-medium transition-colors ${activeTab === tab ? 'bg-white/[0.06] text-slate-200 border border-white/[0.08] border-b-transparent' : 'text-slate-500 hover:text-slate-400'}`}
              >
                {tab === 'compose' ? 'docker-compose.yml' : tab === 'env' ? '.env' : 'Variables'}
              </button>
            ))}
          </div>

          <div className="px-4 md:px-5 pb-4">
            {activeTab === 'compose' && (
              <textarea
                value={compose}
                onChange={(e) => setCompose(e.target.value)}
                spellCheck={false}
                className="w-full h-72 px-4 py-3 rounded-lg bg-slate-950/60 border border-white/[0.06] text-xs text-slate-300 font-mono leading-relaxed focus:outline-none focus:border-emerald-500/20 resize-none scrollbar-thin"
                placeholder="services:&#10;  app:&#10;    image: example:latest"
              />
            )}
            {activeTab === 'env' && (
              <textarea
                value={env}
                onChange={(e) => setEnv(e.target.value)}
                spellCheck={false}
                className="w-full h-72 px-4 py-3 rounded-lg bg-slate-950/60 border border-white/[0.06] text-xs text-slate-300 font-mono leading-relaxed focus:outline-none focus:border-emerald-500/20 resize-none scrollbar-thin"
                placeholder="# Environment variables for this template"
              />
            )}
            {activeTab === 'meta' && (() => {
              const parsedVars = parseComposeVariables(compose)
              return (
                <div className="rounded-lg bg-slate-950/60 border border-white/[0.06] p-4 space-y-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Detected Variables ({parsedVars.length})
                  </p>
                  {parsedVars.length === 0 ? (
                    <div className="text-xs text-slate-600 py-4 text-center">
                      <p>No custom variables detected in compose file.</p>
                      <p className="mt-1">Use <code className="text-slate-400 bg-white/[0.04] px-1 py-0.5 rounded">${'${VAR_NAME:-default}'}</code> placeholders to add them.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {parsedVars.map((v) => (
                        <div key={v.name} className="flex items-center gap-3 py-1.5 px-2 rounded bg-white/[0.02]">
                          <code className="text-[11px] font-mono text-emerald-400 min-w-[160px]">{v.name}</code>
                          <span className="text-[10px] text-slate-600">default:</span>
                          <code className="text-[11px] font-mono text-slate-400 flex-1 truncate">
                            {v.defaultValue || <span className="text-slate-600 italic">none</span>}
                          </code>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-600 mt-2">
                    Standard variables (<code className="text-slate-500">TZ</code>, <code className="text-slate-500">PUID</code>, <code className="text-slate-500">PGID</code>, <code className="text-slate-500">APP_DATA_DIR</code>) are inherited from root .env and excluded above.
                  </p>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 md:px-5 py-3 border-t border-white/[0.06] shrink-0">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave({ name, compose, env, metadata: { title: title || name, description, category, tags: [], variables: [] } })}
            disabled={!canSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed press"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {mode === 'create' ? 'Create Template' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Template Card
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  template: TemplateInfo
  onDeploy: (template: TemplateInfo) => void
  onEdit: (template: TemplateInfo) => void
  onDelete: (template: TemplateInfo) => void
  onExport: (template: TemplateInfo) => void
}

function TemplateCard({ template, onDeploy, onEdit, onDelete, onExport }: TemplateCardProps) {
  const CatIcon = getCategoryIcon(template.category)
  const colors = getCategoryColors(template.category)

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-6 flex flex-col gap-3 hover:border-white/[0.1] hover:bg-white/[0.03] transition-all duration-200 group">
      {/* Top row: category badge + actions */}
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors.badge}`}
        >
          <CatIcon size={10} />
          {template.category}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={(e) => { e.stopPropagation(); onExport(template) }}
            className="p-1 rounded text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            title="Export template"
          >
            <Download size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(template) }}
            className="p-1 rounded text-slate-600 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            title="Edit template"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(template) }}
            className="p-1 rounded text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Delete template"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Template name */}
      <h3 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
        {template.title || template.name}
      </h3>

      {/* Description (max 2 lines) */}
      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 flex-1">
        {template.description || 'No description provided.'}
      </p>

      {/* Tags */}
      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {template.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/[0.04] text-slate-500 border border-white/[0.04]"
            >
              {tag}
            </span>
          ))}
          {template.tags.length > 5 && (
            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium text-slate-600">
              +{template.tags.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Deploy button */}
      <button
        onClick={() => onDeploy(template)}
        className="mt-auto flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all duration-200 press"
      >
        <Play size={12} />
        Deploy
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Templates Page
// ---------------------------------------------------------------------------

export default function Templates() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { addToast } = useToast()

  // State
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all')
  const [search, setSearch] = useState('')
  const [deployTarget, setDeployTarget] = useState<TemplateInfo | null>(null)
  const [detail, setDetail] = useState<TemplateDetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deploying, setDeploying] = useState(false)

  // Create / Edit state
  const [createEditMode, setCreateEditMode] = useState<'create' | 'edit' | null>(null)
  const [editInitial, setEditInitial] = useState<{ name: string; compose: string; env: string; metadata: Record<string, unknown> } | undefined>(undefined)
  const [saving, setSaving] = useState(false)

  // Polling
  const { data, loading, refresh } = usePolling<TemplateListResponse>(
    fetchTemplates,
    30000,
    { enabled: isConnected },
  )

  const templates = data?.templates ?? []

  // Filtered list
  const filtered = useMemo(() => {
    return templates.filter(
      (t) => matchesCategory(t, activeCategory) && matchesSearch(t, search),
    )
  }, [templates, activeCategory, search])

  // Open deploy modal
  const handleOpenDeploy = useCallback(async (template: TemplateInfo) => {
    setDeployTarget(template)
    setDetail(null)
    setDetailLoading(true)
    try {
      const res = await fetchTemplateDetail(template.name)
      setDetail(res)
    } catch {
      // Detail fetch failed; modal will show with limited info
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // Close deploy modal
  const handleCloseDeploy = useCallback(() => {
    if (deploying) return
    setDeployTarget(null)
    setDetail(null)
  }, [deploying])

  // Execute deployment
  const handleDeploy = useCallback(
    async (stackName: string, variables: Record<string, string>, autoStart: boolean) => {
      if (!deployTarget) return
      setDeploying(true)
      try {
        const res = await deployTemplate(deployTarget.name, {
          stack_name: stackName,
          variables,
          auto_start: autoStart,
        })
        if (res.success) {
          addToast({
            type: 'success',
            message: `Stack "${res.stack_name}" deployed successfully${res.started ? ' and started' : ''}`,
          })
          setDeployTarget(null)
          setDetail(null)
          refresh()
        } else {
          addToast({ type: 'error', message: res.message || 'Deployment failed', duration: 6000 })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        addToast({ type: 'error', message: `Deploy failed: ${message}`, duration: 6000 })
      } finally {
        setDeploying(false)
      }
    },
    [deployTarget, addToast, refresh],
  )

  // Open create modal
  const handleOpenCreate = useCallback(() => {
    setEditInitial(undefined)
    setCreateEditMode('create')
  }, [])

  // Open edit modal
  const handleOpenEdit = useCallback(async (template: TemplateInfo) => {
    try {
      const res = await fetchTemplateDetail(template.name)
      setEditInitial({
        name: template.name,
        compose: res.compose || '',
        env: res.env || '',
        metadata: { title: template.title || template.name, description: template.description, category: template.category, tags: template.tags, variables: template.variables || [] },
      })
      setCreateEditMode('edit')
    } catch {
      addToast({ type: 'error', message: 'Failed to load template for editing' })
    }
  }, [addToast])

  // Save create / edit
  const handleSaveTemplate = useCallback(async (data: { name: string; compose: string; env: string; metadata: Record<string, unknown> }) => {
    setSaving(true)
    try {
      if (createEditMode === 'create') {
        const res = await importTemplate({ name: data.name, compose: data.compose, metadata: data.metadata, env: data.env })
        if (res.success) {
          addToast({ type: 'success', message: `Template "${data.name}" created` })
          setCreateEditMode(null)
          refresh()
        } else {
          addToast({ type: 'error', message: res.message || 'Failed to create template' })
        }
      } else {
        const res = await updateTemplate(data.name, { compose: data.compose, metadata: data.metadata, env: data.env })
        if (res.success) {
          addToast({ type: 'success', message: `Template "${data.name}" updated` })
          setCreateEditMode(null)
          refresh()
        } else {
          addToast({ type: 'error', message: res.message || 'Failed to update template' })
        }
      }
    } catch (err) {
      addToast({ type: 'error', message: `Save failed: ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setSaving(false)
    }
  }, [createEditMode, addToast, refresh])

  // Export a template as JSON file
  const handleExportTemplate = useCallback(async (template: TemplateInfo) => {
    try {
      const res = await fetchTemplateDetail(template.name)
      const exportData = {
        name: template.name,
        metadata: { title: template.title || template.name, description: template.description, category: template.category, tags: template.tags, variables: template.variables || [] },
        compose: res.compose || '',
        env: res.env || '',
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `template-${template.name}.json`
      a.click()
      URL.revokeObjectURL(url)
      addToast({ type: 'success', message: `Template "${template.name}" exported` })
    } catch {
      addToast({ type: 'error', message: 'Export failed' })
    }
  }, [addToast])

  // Import a template from JSON file
  const handleImportTemplate = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (!data.name || !data.compose) {
          addToast({ type: 'error', message: 'Invalid template file: must have "name" and "compose" fields' })
          return
        }
        // Sanitize the name
        const safeName = String(data.name).toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 64)
        const res = await importTemplate({
          name: safeName,
          compose: String(data.compose),
          metadata: data.metadata || {},
          env: data.env ? String(data.env) : undefined,
        })
        if (res.success) {
          addToast({ type: 'success', message: `Template "${safeName}" imported` })
          refresh()
        } else {
          addToast({ type: 'error', message: res.message || 'Import failed' })
        }
      } catch (err) {
        addToast({ type: 'error', message: `Import failed: ${err instanceof Error ? err.message : 'Invalid JSON'}` })
      }
    }
    input.click()
  }, [addToast, refresh])

  // Delete template
  const handleDeleteTemplate = useCallback(async (template: TemplateInfo) => {
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return
    try {
      const res = await deleteTemplate(template.name)
      if (res.success) {
        addToast({ type: 'success', message: `Template "${template.name}" deleted` })
        refresh()
      } else {
        addToast({ type: 'error', message: res.message || 'Delete failed' })
      }
    } catch (err) {
      addToast({ type: 'error', message: `Delete failed: ${err instanceof Error ? err.message : String(err)}` })
    }
  }, [addToast, refresh])

  // -------------------------------------------------------------------------
  // Disconnected state
  // -------------------------------------------------------------------------

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
          <Package size={24} className="text-slate-600" />
        </div>
        <p className="text-sm text-slate-500">Connect to a server to browse templates</p>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Rocket size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Stack Templates</h2>
            <p className="text-xs text-slate-500">
              {templates.length} template{templates.length !== 1 ? 's' : ''} available
              {filtered.length !== templates.length && ` (${filtered.length} shown)`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 hover:border-emerald-500/30 transition-all duration-200 press"
          >
            <Plus size={13} />
            Create Template
          </button>
          <button
            onClick={handleImportTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] transition-all duration-200 press"
            title="Import template from JSON file"
          >
            <Upload size={13} />
            Import
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] transition-all duration-200 disabled:opacity-50 press"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Category filter bar + search */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        {/* Category pills — horizontal scrollable on mobile */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {CATEGORIES.map((cat) => {
            const CatIcon = cat.icon
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap shrink-0 transition-all duration-150 ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-white/[0.04] text-slate-400 border-white/[0.06] hover:bg-white/[0.06] hover:text-slate-300'
                }`}
              >
                <CatIcon size={13} />
                {cat.label}
              </button>
            )
          })}
        </div>

        {/* Search bar */}
        <div className="relative flex-1 min-w-0 md:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 focus:bg-white/[0.05] transition-colors"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-slate-600" />
        </div>
      )}

      {/* Empty state */}
      {data && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
            <Package size={22} className="text-slate-600" />
          </div>
          <p className="text-sm text-slate-500 text-center max-w-md">
            No templates available. Import templates or create them in the{' '}
            <code className="font-mono bg-white/[0.06] px-1.5 py-0.5 rounded text-slate-400 text-xs">
              .templates/
            </code>{' '}
            directory.
          </p>
        </div>
      )}

      {/* Filtered empty state */}
      {data && templates.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
            <Search size={22} className="text-slate-600" />
          </div>
          <p className="text-sm text-slate-500">No templates match your filter</p>
          <button
            onClick={() => {
              setSearch('')
              setActiveCategory('all')
            }}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Template card grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => (
            <TemplateCard
              key={template.name}
              template={template}
              onDeploy={handleOpenDeploy}
              onEdit={handleOpenEdit}
              onDelete={handleDeleteTemplate}
              onExport={handleExportTemplate}
            />
          ))}
        </div>
      )}

      {/* Deploy modal */}
      {deployTarget && (
        <DeployModal
          template={deployTarget}
          detail={detail}
          detailLoading={detailLoading}
          onClose={handleCloseDeploy}
          onDeploy={handleDeploy}
          deploying={deploying}
        />
      )}

      {/* Create / Edit modal */}
      {createEditMode && (
        <CreateEditModal
          mode={createEditMode}
          initial={editInitial}
          onClose={() => { if (!saving) setCreateEditMode(null) }}
          onSave={handleSaveTemplate}
          saving={saving}
        />
      )}
    </div>
  )
}
