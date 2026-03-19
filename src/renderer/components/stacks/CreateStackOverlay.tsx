// =============================================================================
// CreateStackOverlay — Full-screen glass overlay for creating a new stack
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Plus,
  Loader2,
  AlertTriangle,
  Sparkles,
  FileCode2,
  FileText,
} from 'lucide-react'
import { createStack, saveStackCompose, saveStackEnv } from '../../api/endpoints'
import { useToast } from '../common/Toast'

interface Props {
  onClose: () => void
  onCreated: () => void
}

const DEFAULT_COMPOSE = `services:
  # Define your services here
  # example:
  #   image: nginx:latest
  #   container_name: example
  #   restart: unless-stopped
  #   ports:
  #     - "8080:80"
  #   volumes:
  #     - \${APP_DATA_DIR}/example:/data
  #   environment:
  #     - TZ=\${TZ}
  #     - PUID=\${PUID}
  #     - PGID=\${PGID}
`

const DEFAULT_ENV = `# =============================================================================
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
`

export default function CreateStackOverlay({ onClose, onCreated }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()

  const [stackName, setStackName] = useState('')
  const [composeContent, setComposeContent] = useState(DEFAULT_COMPOSE)
  const [envContent, setEnvContent] = useState(DEFAULT_ENV)
  const [activeTab, setActiveTab] = useState<'compose' | 'env'>('compose')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-focus name input on mount
  useEffect(() => {
    setTimeout(() => nameInputRef.current?.focus(), 100)
  }, [])

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Backdrop click to close
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose],
  )

  // Sanitize stack name into a valid slug
  const sanitizedName = stackName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  // Handle create
  const handleCreate = useCallback(async () => {
    if (!sanitizedName) return
    setCreating(true)
    setError(null)

    try {
      // Step 1: Create the stack directory
      const result = await createStack(sanitizedName)
      if (!result.success) {
        setError(result.message || 'Failed to create stack')
        setCreating(false)
        return
      }

      // Step 2: Save compose content if user modified it
      if (composeContent.trim() && composeContent !== DEFAULT_COMPOSE) {
        try {
          await saveStackCompose(sanitizedName, composeContent)
        } catch {
          // Non-fatal: stack was created, compose save failed
          addToast({
            type: 'warning',
            message: 'Stack created but compose file could not be saved',
            duration: 4000,
          })
        }
      }

      // Step 3: Save env content if user modified it
      if (envContent.trim() && envContent !== DEFAULT_ENV) {
        try {
          await saveStackEnv(sanitizedName, envContent)
        } catch {
          // Non-fatal
          addToast({
            type: 'warning',
            message: 'Stack created but .env file could not be saved',
            duration: 4000,
          })
        }
      }

      addToast({
        type: 'success',
        message: `Stack "${sanitizedName}" created successfully!`,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create stack')
    } finally {
      setCreating(false)
    }
  }, [sanitizedName, composeContent, envContent, addToast, onCreated, onClose])

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[6vh] animate-fade-in"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="
          relative w-full max-w-3xl mx-4
          bg-slate-900/95 backdrop-blur-2xl
          border border-white/[0.08] rounded-2xl
          shadow-2xl shadow-black/40
          overflow-hidden animate-scale-in
          flex flex-col
          max-h-[88vh]
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-stack-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 id="create-stack-title" className="text-base font-semibold text-slate-100">
                Create New Stack
              </h2>
              <p className="text-xs text-slate-500">
                Set up a new Docker Compose service stack
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="
              flex items-center justify-center w-9 h-9 rounded-lg
              text-slate-500 hover:text-slate-200
              hover:bg-white/[0.06]
              transition-colors duration-150
            "
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-5">
          {/* Stack name input */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Stack Name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={stackName}
              onChange={(e) => {
                setStackName(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && sanitizedName) handleCreate()
              }}
              placeholder="my-new-stack"
              className="
                w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl
                text-sm text-slate-200 placeholder-slate-600 font-mono
                focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20
                transition-all duration-200
              "
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-slate-600">
                Use lowercase letters, numbers, and hyphens
              </p>
              {stackName && sanitizedName !== stackName.trim().toLowerCase() && (
                <p className="text-[10px] text-slate-500">
                  Will be created as: <span className="text-emerald-400 font-mono">{sanitizedName}</span>
                </p>
              )}
              {sanitizedName && (
                <p className="text-[10px] text-slate-500">
                  <span className="text-emerald-400 font-mono">{sanitizedName}</span>
                </p>
              )}
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveTab('compose')}
              className={`
                flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150
                ${activeTab === 'compose'
                  ? 'bg-white/[0.08] text-slate-200 ring-1 ring-white/[0.1]'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                }
              `}
            >
              <FileCode2 size={13} />
              docker-compose.yml
            </button>
            <button
              onClick={() => setActiveTab('env')}
              className={`
                flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150
                ${activeTab === 'env'
                  ? 'bg-white/[0.08] text-slate-200 ring-1 ring-white/[0.1]'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                }
              `}
            >
              <FileText size={13} />
              .env
            </button>
          </div>

          {/* Editor area */}
          <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-slate-950/60">
            {/* Editor header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-slate-900/40">
              {activeTab === 'compose' ? (
                <FileCode2 size={13} className="text-cyan-400" />
              ) : (
                <FileText size={13} className="text-cyan-400" />
              )}
              <span className="text-[11px] text-slate-400 font-mono">
                {activeTab === 'compose' ? 'docker-compose.yml' : '.env'}
              </span>
              <span className="ml-auto text-[10px] text-slate-600">
                {activeTab === 'compose' ? 'YAML' : 'ENV'}
              </span>
            </div>

            {/* Textarea */}
            <textarea
              value={activeTab === 'compose' ? composeContent : envContent}
              onChange={(e) => {
                if (activeTab === 'compose') {
                  setComposeContent(e.target.value)
                } else {
                  setEnvContent(e.target.value)
                }
              }}
              className="
                w-full bg-transparent text-slate-200 font-mono text-sm
                p-4 resize-none focus:outline-none
                placeholder-slate-600 leading-relaxed
              "
              style={{ minHeight: '280px' }}
              spellCheck={false}
              placeholder={
                activeTab === 'compose'
                  ? 'Paste or write your docker-compose.yml here...'
                  : 'Define environment variables (KEY=value)...'
              }
            />

            {/* Editor footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] bg-slate-900/40">
              <span className="text-[10px] text-slate-600 font-mono">
                {(activeTab === 'compose' ? composeContent : envContent).split('\n').length} lines
              </span>
              <span className="text-[10px] text-slate-600">
                {activeTab === 'compose' ? 'YAML' : 'ENV'}
              </span>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 animate-fade-in">
              <AlertTriangle size={15} className="text-rose-400 shrink-0" />
              <p className="text-xs text-rose-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] shrink-0 bg-slate-900/50">
          <p className="text-[11px] text-slate-600">
            Press <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-slate-400 font-mono text-[10px]">Esc</kbd> to cancel
          </p>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="
                px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200
                bg-white/[0.04] hover:bg-white/[0.08]
                rounded-lg border border-white/[0.08]
                transition-all duration-200
              "
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !sanitizedName}
              className="
                flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg
                bg-emerald-500 text-white hover:bg-emerald-400
                shadow-lg shadow-emerald-500/20 transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {creating ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Plus size={15} />
              )}
              Create Stack
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
