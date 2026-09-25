// =============================================================================
// Templates — Stack Templates / Quick Deploy Gallery with category filtering,
//             search, template cards, and deploy modal
// =============================================================================

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
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
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  History,
  Undo2,
  Scan,
  Circle,
  Link,
  ExternalLink,
  Globe2,
  Store,
  Sparkles,
  Network,
  Shield,
  Lock,
  KeyRound,
  Wand2,
  Terminal,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useComposeLinter, useEnvLinter } from '../hooks/useComposeLinter'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { usePluginStore } from '../stores/pluginStore'
import { ErrorState } from '../components/common/PageState'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { useSettingsStore } from '../stores/settingsStore'
import { useAuthStore } from '../stores/authStore'
import { useToast } from '../components/common/Toast'
import { FloatingSaveBar } from '../components/common/FloatingSaveBar'
import { fetchTemplates, fetchTemplateDetail, deployTemplate, importTemplate, updateTemplate, deleteTemplate, fetchStacks, fetchDeployHistory, undeployTemplate, dryRunTemplate, fetchContainers, importTemplateFromUrl, fetchTemplateUrl, fetchTemplateGallery, fetchTraefikStatus, fetchHomarrStatus, fetchStackActivity, fetchSecrets, setSecret, startStack,
  validateCompose,
} from '../api/endpoints'
import type {
  TemplateInfo,
  TemplateDetailResponse,
  TemplateListResponse,
  TemplateDeployResponse,
  StackInfo,
  DeployHistoryEntry,
  DeployHistoryResponse,
  TemplateDryRunResponse,
  ContainerInfo,
  GalleryTemplate,
  StackActivityResponse,
  StackActivityService,
} from '../../shared/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type CategoryId = 'all' | 'media' | 'monitoring' | 'web' | 'databases' | 'development' | 'tools' | 'productivity' | 'automation' | 'security' | 'network' | 'storage' | 'download' | 'entertainment' | 'other'

interface CategoryDef {
  id: CategoryId
  label: string
  icon: React.ElementType
  // Maps template category strings to this filter ID
  aliases: string[]
  color: { badge: string; iconColor: string; border: string }
}

const CATEGORIES: CategoryDef[] = [
  { id: 'all', label: 'All', icon: Package, aliases: [], color: { badge: '', iconColor: '', border: '' } },
  { id: 'media', label: 'Media', icon: Tv, aliases: ['media', 'photos', 'content', 'publishing'],
    color: { badge: 'bg-violet-500/15 text-violet-400 border-violet-500/20', iconColor: 'text-violet-400', border: 'border-l-violet-500/60' } },
  { id: 'monitoring', label: 'Monitoring', icon: BarChart3, aliases: ['monitoring', 'metrics', 'dashboard'],
    color: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20', iconColor: 'text-amber-400', border: 'border-l-amber-500/60' } },
  { id: 'web', label: 'Web', icon: Globe, aliases: ['web'],
    color: { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', iconColor: 'text-emerald-400', border: 'border-l-emerald-500/60' } },
  { id: 'databases', label: 'Databases', icon: Database, aliases: ['databases', 'database', 'db'],
    color: { badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20', iconColor: 'text-cyan-400', border: 'border-l-cyan-500/60' } },
  { id: 'development', label: 'Development', icon: Code, aliases: ['development', 'dev'],
    color: { badge: 'bg-rose-500/15 text-rose-400 border-rose-500/20', iconColor: 'text-rose-400', border: 'border-l-rose-500/60' } },
  { id: 'tools', label: 'Tools', icon: Sparkles, aliases: ['tools', 'utilities', 'remote'],
    color: { badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20', iconColor: 'text-indigo-400', border: 'border-l-indigo-500/60' } },
  { id: 'productivity', label: 'Productivity', icon: Store, aliases: ['productivity', 'notes', 'documents', 'knowledge', 'finance', 'lifestyle'],
    color: { badge: 'bg-teal-500/15 text-teal-400 border-teal-500/20', iconColor: 'text-teal-400', border: 'border-l-teal-500/60' } },
  { id: 'automation', label: 'Automation', icon: Sparkles, aliases: ['automation', 'notifications', 'sync'],
    color: { badge: 'bg-orange-500/15 text-orange-400 border-orange-500/20', iconColor: 'text-orange-400', border: 'border-l-orange-500/60' } },
  { id: 'security', label: 'Security', icon: Shield, aliases: ['security', 'vpn', 'privacy'],
    color: { badge: 'bg-red-500/15 text-red-400 border-red-500/20', iconColor: 'text-red-400', border: 'border-l-red-500/60' } },
  { id: 'network', label: 'Network', icon: Network, aliases: ['network', 'management'],
    color: { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/20', iconColor: 'text-blue-400', border: 'border-l-blue-500/60' } },
  { id: 'storage', label: 'Storage', icon: HardDrive, aliases: ['storage', 'backup'],
    color: { badge: 'bg-sky-500/15 text-sky-400 border-sky-500/20', iconColor: 'text-sky-400', border: 'border-l-sky-500/60' } },
  { id: 'download', label: 'Download', icon: Download, aliases: ['download'],
    color: { badge: 'bg-lime-500/15 text-lime-400 border-lime-500/20', iconColor: 'text-lime-400', border: 'border-l-lime-500/60' } },
  { id: 'entertainment', label: 'Entertainment', icon: Tv, aliases: ['entertainment', 'ai'],
    color: { badge: 'bg-pink-500/15 text-pink-400 border-pink-500/20', iconColor: 'text-pink-400', border: 'border-l-pink-500/60' } },
  { id: 'other', label: 'Other', icon: Package, aliases: [],
    color: { badge: 'bg-slate-500/15 text-slate-400 border-slate-500/20', iconColor: 'text-slate-400', border: 'border-l-slate-500/60' } },
]

/** Resolve a template's category string to a CategoryDef */
function resolveCategory(cat: string): CategoryDef {
  const lower = cat.toLowerCase()
  return CATEGORIES.find((c) => c.id !== 'all' && c.id !== 'other' && c.aliases.includes(lower))
    ?? CATEGORIES[CATEGORIES.length - 1] // 'other'
}

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  CATEGORIES.filter((c) => c.id !== 'all').flatMap((c) => c.aliases.map((a) => [a, c.icon]))
)

const CATEGORY_COLOR_MAP: Record<string, { badge: string; iconColor: string }> = Object.fromEntries(
  CATEGORIES.filter((c) => c.id !== 'all').flatMap((c) =>
    c.aliases.map((a) => [a, { badge: c.color.badge, iconColor: c.color.iconColor }])
  )
)

const DEFAULT_CATEGORY_COLOR = {
  badge: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  iconColor: 'text-slate-400',
}

/** Maps template categories to their default target stack directory name */
const CATEGORY_TO_STACK: Record<string, string> = {
  databases: 'development-tools',
  database: 'development-tools',
  development: 'development-tools',
  dev: 'development-tools',
  media: 'media-services',
  monitoring: 'monitoring-management',
  metrics: 'monitoring-management',
  web: 'networking-security',
  storage: 'storage-backup',
  backup: 'storage-backup',
  automation: 'miscellaneous-services',
  utilities: 'core-infrastructure',
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
  const resolved = resolveCategory(template.category)
  if (filter === 'other') return resolved.id === 'other'
  return resolved.id === filter
}

/** Parse ${VAR_NAME} and ${VAR:-default} patterns from compose YAML */
function parseComposeVariables(compose: string): { name: string; defaultValue: string }[] {
  const varMap = new Map<string, string>()
  // Match ${VAR}, ${VAR:-default}, ${VAR:-}, ${VAR:?err}
  const regex = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::?[-=?+]([^}]*))?\}/g
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
// Client-side compose lint — surfaces common issues the compose-linter
// plugin would catch, directly in the UI before deployment
// ---------------------------------------------------------------------------

interface LintWarning {
  severity: 'warning' | 'info'
  message: string
  service?: string
}

/** Resolve ${VAR:-default}  to a readable port string */
function cleanPortDisplay(raw: string): string {
  // Replace ${VAR:-default} with just the default value, ${VAR} with *
  return raw.replace(/\$\{[^}]*:-([^}]+)\}/g, '$1').replace(/\$\{[^}]+\}/g, '*')
}

function lintCompose(compose: string): LintWarning[] {
  const warnings: LintWarning[] = []
  if (!compose) return warnings

  // Parse services from compose content — only within the services: block
  const services: string[] = []
  const servicesMatch = compose.match(/^services:\s*\n([\s\S]*?)(?=^[a-zA-Z]|\Z)/m)
  if (servicesMatch) {
    const servicesBlock = servicesMatch[1]
    const serviceRegex = /^  ([a-zA-Z_-][a-zA-Z0-9_-]*):/gm
    let m: RegExpExecArray | null
    while ((m = serviceRegex.exec(servicesBlock)) !== null) {
      services.push(m[1])
    }
  }

  for (const svc of services) {
    // Extract the service block (rough heuristic — from service name to next same-indent service or end)
    const svcRegex = new RegExp(`^  ${svc}:(.+?)(?=^  [a-zA-Z_-][a-zA-Z0-9_-]*:|(?![\\s\\S]))`, 'ms')
    const svcMatch = compose.match(svcRegex)
    if (!svcMatch) continue
    const block = svcMatch[0]

    // Check for missing restart policy
    if (!/restart\s*:/.test(block)) {
      warnings.push({ severity: 'warning', message: 'Missing restart policy', service: svc })
    }

    // Check for privileged mode
    if (/privileged\s*:\s*true/.test(block)) {
      warnings.push({ severity: 'warning', message: 'Running in privileged mode', service: svc })
    }

    // Check for ports exposed without bind address (e.g., "8080:8080" without "127.0.0.1:")
    const portsSection = block.match(/ports\s*:\s*\n((?:\s+-\s*.+\n?)+)/)
    if (portsSection) {
      const portLines = portsSection[1].match(/-\s*["']?(\S+?)["']?\s*$/gm) || []
      for (const portLine of portLines) {
        const cleaned = portLine.replace(/^-\s*["']?/, '').replace(/["']?\s*$/, '')
        // If it has a colon but doesn't start with an IP address
        if (cleaned.includes(':') && !/^\d+\.\d+\.\d+\.\d+:/.test(cleaned)) {
          const display = cleanPortDisplay(cleaned)
          warnings.push({ severity: 'info', message: `Port ${display} exposed on all interfaces`, service: svc })
        }
      }
    }

    // Check for missing healthcheck
    if (!/healthcheck\s*:/.test(block)) {
      warnings.push({ severity: 'info', message: 'No health check defined', service: svc })
    }
  }

  return warnings
}

// ---------------------------------------------------------------------------
// Deploy Modal
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Traefik route generation helper
// ---------------------------------------------------------------------------

function generateRouteYaml(serviceName: string, containerName: string, containerPort: string, domain: string, autheliaProtected = false): string {
  const routeId = serviceName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const protocol = ['443', '9443', '8443'].includes(containerPort) ? 'https' : 'http'
  const middlewares = autheliaProtected
    ? `        - "traefik-chain"\n        - "authelia-forwardauth"\n        - "compress-gzip"`
    : `        - "traefik-chain"\n        - "compress-gzip"`
  return `# Auto-generated Traefik route for: ${serviceName}
# Edit the subdomain or middlewares as needed.

http:
  routers:
    ${routeId}-router:
      entryPoints:
        - "websecure"
      rule: "Host(\`${serviceName}.${domain}\`)"
      service: "${routeId}"
      middlewares:
${middlewares}
      tls: {}

  services:
    ${routeId}:
      loadBalancer:
        servers:
          - url: "${protocol}://${containerName}:${containerPort}"`
}

/** Parse services with ports from a compose file for route generation */
const CONTAINER_NAME_OK = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/

/** Every service of a compose file with the container_name it declares ('' when Compose names it) */
function parseComposeServices(compose: string): { name: string; containerName: string }[] {
  const out: { name: string; containerName: string }[] = []
  let inServices = false
  let current: { name: string; containerName: string } | null = null
  for (const line of compose.split('\n')) {
    if (/^services:\s*$/.test(line)) { inServices = true; current = null; continue }
    if (/^[A-Za-z]/.test(line)) { inServices = false; current = null; continue }
    if (!inServices) continue
    const svc = line.match(/^  ([A-Za-z0-9_.-]+):\s*$/)
    if (svc) { current = { name: svc[1], containerName: '' }; out.push(current); continue }
    const cn = current ? line.match(/^    container_name:\s*["']?([^"'#]+?)["']?\s*(?:#.*)?$/) : null
    if (cn && current) current.containerName = cn[1].trim()
  }
  return out
}

function parseServicesWithPorts(compose: string): { name: string; containerName: string; port: string }[] {
  const results: { name: string; containerName: string; port: string }[] = []
  const lines = compose.split('\n')
  let currentService = ''
  let inPorts = false
  let containerName = ''
  let indent = 0

  for (const line of lines) {
    // Detect top-level service (2-space indent, ends with colon)
    const svcMatch = line.match(/^  ([a-zA-Z_-][a-zA-Z0-9_-]*):\s*$/)
    if (svcMatch) {
      currentService = svcMatch[1]
      containerName = ''
      inPorts = false
      indent = 0
      continue
    }

    if (!currentService) continue

    // Detect next top-level key (end of service block)
    if (/^  [a-zA-Z_-]/.test(line) && !line.startsWith('    ')) {
      currentService = ''
      continue
    }
    if (/^[a-zA-Z]/.test(line)) {
      currentService = ''
      continue
    }

    // container_name
    const cnMatch = line.match(/container_name:\s*(.+)/)
    if (cnMatch && currentService) {
      containerName = cnMatch[1].trim()
    }

    // ports section
    if (/^\s+ports:\s*$/.test(line) && currentService) {
      inPorts = true
      indent = line.search(/\S/)
      continue
    }

    // Port entry
    if (inPorts && currentService) {
      const portMatch = line.match(/^\s+-\s+"?([^"]+)"?/)
      if (portMatch) {
        // Resolve ${VAR:-default} patterns to defaults before splitting
        const portMapping = portMatch[1].replace(/\$\{[A-Za-z_][A-Za-z0-9_]*:-([^}]*)\}/g, '$1').replace(/\$\{[A-Za-z_][A-Za-z0-9_]*\}/g, '')
        const parts = portMapping.split(':')
        const containerPort = (parts.length >= 2 ? parts[parts.length - 1] : parts[0]).replace(/\/.*/, '')
        results.push({
          name: currentService,
          containerName: containerName || currentService,
          port: containerPort,
        })
        inPorts = false // Only take the first port
        continue
      }
      // End of ports section
      if (line.trim() && !line.match(/^\s+-/)) {
        inPorts = false
      }
    }
  }
  return results
}

interface DeployModalProps {
  template: TemplateInfo
  detail: TemplateDetailResponse | null
  detailLoading: boolean
  stacks: StackInfo[]
  onClose: () => void
  onDeploy: (targetStack: string, variables: Record<string, string>, autoStart: boolean, replaceServices?: boolean, excludeServices?: string[], customRoutes?: Record<string, string>, connectProxy?: boolean, resourceLimits?: { mem_limit?: string; cpus?: number }, addToHomarr?: boolean, containerNames?: Record<string, string>) => Promise<TemplateDeployResponse | null>
  deploying: boolean
  onUndeploy?: (templateName: string, targetStack: string, services: string[]) => Promise<boolean>
  isAdmin?: boolean
}

// Deployment progress ---------------------------------------------------------
const SECRET_REF_ALL = /\$\{SECRETS[._]([A-Za-z_][A-Za-z0-9_]*)\}/g
const SECRET_REF_ONE = /^\$\{SECRETS[._][A-Za-z_][A-Za-z0-9_]*\}$/
const SECRET_NAME_OK = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/

const DEPLOY_STEPS = [
  { label: 'Merged', hint: 'compose, variables, routes' },
  { label: 'Pull', hint: 'images' },
  { label: 'Create', hint: 'containers' },
  { label: 'Start', hint: 'containers' },
  { label: 'Health', hint: 'checks' },
] as const

/** Index of the step in progress for a server-reported phase */
function stepForPhase(phase: string | undefined, services: StackActivityService[]): number {
  switch (phase) {
    case 'pulling': return 1
    case 'creating': return 2
    case 'starting': case 'stopping': case 'stopped': return 3
    case 'healthcheck': case 'unhealthy': return 4
    case 'running': case 'started': return 5
    case 'exited': return 4
    case 'failed':
      if (services.some((s) => !s.pulled)) return 1
      if (services.some((s) => !s.created)) return 2
      return 3
    default: return 1
  }
}

function phaseLabel(phase: string | undefined): string {
  switch (phase) {
    case 'pulling': return 'Pulling images…'
    case 'creating': return 'Creating containers…'
    case 'starting': return 'Starting containers…'
    case 'healthcheck': return 'Waiting for health checks…'
    case 'running': return 'Running'
    case 'failed': return 'The start did not complete'
    case 'exited': return 'A container exited'
    case 'unhealthy': return 'A health check is failing'
    default: return 'Waiting for the server…'
  }
}

/** Human state of one service during and after a deployment */
function serviceChip(svc: StackActivityService): { text: string; cls: string; busy: boolean } {
  if (svc.state === 'running') {
    if (svc.health === 'starting') return { text: 'starting · health', cls: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20', busy: true }
    if (svc.health === 'unhealthy') return { text: 'unhealthy', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/20', busy: false }
    if (svc.health === 'healthy') return { text: 'healthy', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', busy: false }
    return { text: 'running', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', busy: false }
  }
  if (svc.state === 'exited' || svc.state === 'dead') return { text: 'exited', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/20', busy: false }
  if (svc.state === 'restarting') return { text: 'restarting', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/20', busy: true }
  if (svc.state === 'created') return { text: 'created', cls: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20', busy: true }
  if (!svc.pulled) return { text: 'pulling image', cls: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20', busy: true }
  return { text: 'creating', cls: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20', busy: true }
}

function generateSecretValue(length = 32): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

function isSensitiveVariable(v: { name: string; type?: string }): boolean {
  return v.type === 'password' || /(PASS|SECRET|TOKEN|_KEY$|API_KEY|PRIVATE)/i.test(v.name)
}

function DeployModal({ template, detail, detailLoading, stacks, onClose, onDeploy, deploying, onUndeploy, isAdmin = true }: DeployModalProps) {
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const defaultStack = template.target_stack || CATEGORY_TO_STACK[template.category.toLowerCase()] || ''
  const [targetStack, setTargetStack] = useState(defaultStack)
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
  // F1: Confirmation step
  const [confirming, setConfirming] = useState(false)
  // F2: Custom dropdown open state
  const [dropdownOpen, setDropdownOpen] = useState(false)
  // F4: Local deploying state (stays true through wait period, unlike parent prop)
  const [localDeploying, setLocalDeploying] = useState(false)
  // F4: Success result
  const [deployResult, setDeployResult] = useState<TemplateDeployResponse | null>(null)
  // F4: Undeploy loading
  const [undeploying, setUndeploying] = useState(false)
  const { addToast } = useToast()
  // Real progress of the background start (GET /stacks/{stack}/activity)
  const [activity, setActivity] = useState<StackActivityResponse | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<'pending' | 'running' | 'failed' | 'not-started'>('pending')
  const [autoOpenIn, setAutoOpenIn] = useState<number | null>(null)
  const [showOutput, setShowOutput] = useState(true)
  const outputRef = useRef<HTMLPreElement>(null)
  // Secrets: what the template or a typed value references, and what exists
  const [existingSecrets, setExistingSecrets] = useState<Set<string> | null>(null)
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({})
  const [creatingSecret, setCreatingSecret] = useState<string | null>(null)
  const [storeAsSecret, setStoreAsSecret] = useState<Set<string>>(new Set())
  // Secret-store names for lock-toggled values (default: the variable name)
  const [secretNames, setSecretNames] = useState<Record<string, string>>({})
  // Container names typed on the deploy screen, keyed by service
  const [containerNames, setContainerNames] = useState<Record<string, string>>({})
  const [existingContainerNames, setExistingContainerNames] = useState<Set<string>>(new Set())
  // F5: Dry-run state
  const [dryRunResult, setDryRunResult] = useState<TemplateDryRunResponse | null>(null)
  const [dryRunLoading, setDryRunLoading] = useState(false)
  // F6: Replace conflicting services toggle
  const [replaceServices, setReplaceServices] = useState(false)
  // Lint details panel visibility
  const [showLintDetails, setShowLintDetails] = useState(true)
  // F7: Optional services — initially all enabled per template defaults
  const optionalServices = detail?.template.optional_services ?? template.optional_services ?? []
  const [excludedServices, setExcludedServices] = useState<Set<string>>(() => {
    const disabled = new Set<string>()
    const opts = template.optional_services ?? []
    for (const o of opts) {
      if (!o.default_enabled) disabled.add(o.service)
    }
    return disabled
  })

  // Traefik route editing state
  const [traefikActive, setTraefikActive] = useState(false)
  const [traefikDomain, setTraefikDomain] = useState('')
  const [enableRouting, setEnableRouting] = useState(true)
  const [connectProxy, setConnectProxy] = useState(true)
  const [enableAuthelia, setEnableAuthelia] = useState(false)
  // Homarr integration state
  const [homarrActive, setHomarrActive] = useState(false)
  const [addToHomarr, setAddToHomarr] = useState(false)
  // Resource limits state
  const [enableResourceLimits, setEnableResourceLimits] = useState(false)
  const [memLimit, setMemLimit] = useState('')
  const [cpuLimit, setCpuLimit] = useState('')
  const [showRoutes, setShowRoutes] = useState(false)
  const [showAdvancedRoutes, setShowAdvancedRoutes] = useState(false)
  const [customRoutes, setCustomRoutes] = useState<Record<string, string>>({})
  // Per-service subdomain + enabled state
  const [routeServices, setRouteServices] = useState<{ name: string; containerName: string; port: string; subdomain: string; enabled: boolean }[]>([])

  // Fetch Traefik status on mount (skip for traefik template itself)
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  useEffect(() => {
    if (!isConnected || template.name === 'traefik') return
    fetchTraefikStatus()
      .then((res) => {
        setTraefikActive(res.active)
        setTraefikDomain(res.domain || '')
      })
      .catch(() => {})
  }, [isConnected, template.name])

  // Fetch Homarr status on mount (skip for homarr template itself)
  useEffect(() => {
    if (!isConnected || template.name === 'homarr') return
    fetchHomarrStatus()
      .then((res) => setHomarrActive(res.active && res.has_api_key))
      .catch(() => {})
  }, [isConnected, template.name])

  // Services of the template and the container names they would get
  const composeServices = useMemo(() => (detail?.compose ? parseComposeServices(detail.compose) : []), [detail])
  useEffect(() => {
    if (!isConnected) return
    let cancelled = false
    fetchContainers()
      .then((r) => { if (!cancelled) setExistingContainerNames(new Set(r.containers.map((c) => c.name))) })
      .catch(() => { /* the API refuses duplicates anyway */ })
    return () => { cancelled = true }
  }, [isConnected])
  const containerNameFor = useCallback(
    (svc: { name: string; containerName: string }) => (containerNames[svc.name] ?? '').trim() || svc.containerName,
    [containerNames],
  )
  // Names that would break the deployment (blocking) or collide with a container that exists (warning)
  const containerNameIssues = useMemo(() => {
    const blocking: Record<string, string> = {}
    const warnings: Record<string, string> = {}
    const seen = new Map<string, string>()
    for (const svc of composeServices) {
      if (excludedServices.has(svc.name)) continue
      const name = containerNameFor(svc)
      if (!name) continue
      if (!CONTAINER_NAME_OK.test(name)) { blocking[svc.name] = 'Letters, digits, dot, dash and underscore only'; continue }
      const other = seen.get(name)
      if (other) { blocking[svc.name] = `Same name as the ${other} service`; continue }
      seen.set(name, svc.name)
      if ((containerNames[svc.name] ?? '').trim() && existingContainerNames.has(name)) {
        warnings[svc.name] = 'A container with this name exists — the deploy fails unless it belongs to this stack'
      }
    }
    return { blocking, warnings }
  }, [composeServices, excludedServices, containerNameFor, existingContainerNames, containerNames])
  // Only names that differ from the template go to the API
  const customContainerNames = useMemo(() => {
    const out: Record<string, string> = {}
    for (const svc of composeServices) {
      if (excludedServices.has(svc.name)) continue
      const typed = (containerNames[svc.name] ?? '').trim()
      if (typed && typed !== svc.containerName) out[svc.name] = typed
    }
    return out
  }, [composeServices, excludedServices, containerNames])
  const badSecretNames = useMemo(
    () => Array.from(storeAsSecret).filter((n) => !SECRET_NAME_OK.test((secretNames[n] ?? n).trim())),
    [storeAsSecret, secretNames],
  )

  // Parse services with ports when compose detail loads
  useEffect(() => {
    if (!traefikActive || !traefikDomain || traefikDomain === 'example.com' || !detail?.compose) return
    const services = parseServicesWithPorts(detail.compose)
    setRouteServices(services.map((svc) => ({
      ...svc,
      subdomain: svc.name,
      enabled: true,
    })))
  }, [traefikActive, traefikDomain, detail])

  // Generate route YAML from subdomain state (reactive)
  useEffect(() => {
    if (!enableRouting || routeServices.length === 0 || !traefikDomain) {
      setCustomRoutes({})
      return
    }
    const routes: Record<string, string> = {}
    for (const svc of routeServices) {
      if (!svc.enabled) continue
      routes[svc.name] = generateRouteYaml(svc.subdomain, containerNameFor(svc), svc.port, traefikDomain, enableAuthelia)
    }
    setCustomRoutes(routes)
  }, [enableRouting, routeServices, traefikDomain, enableAuthelia, containerNameFor])

  // Sync variables when detail loads
  const templateVars = detail?.template.variables ?? template.variables ?? []

  // Update variables when detail arrives — merge template-defined + compose-parsed vars
  useEffect(() => {
    if (!detail) return
    const vars = detail.template.variables ?? []
    const composeVars = detail.compose ? parseComposeVariables(detail.compose) : []
    const definedNames = new Set(vars.map((v) => v.name))

    setVariables((prev) => {
      const merged: Record<string, string> = {}
      for (const v of vars) {
        merged[v.name] = prev[v.name] || v.default || ''
      }
      // Add compose-parsed vars not already defined
      for (const cv of composeVars) {
        if (!definedNames.has(cv.name)) {
          merged[cv.name] = prev[cv.name] || cv.defaultValue || ''
        }
      }
      return merged
    })
  }, [detail])

  const handleVariableChange = useCallback((name: string, value: string) => {
    setVariables((prev) => ({ ...prev, [name]: value }))
  }, [])

  // Known secret names (admins only — the list never contains values)
  useEffect(() => {
    if (!isAdmin) { setExistingSecrets(new Set()); return }
    fetchSecrets()
      .then((res) => setExistingSecrets(new Set(res.secrets.map((e) => e.key))))
      .catch(() => setExistingSecrets(new Set()))
  }, [isAdmin])

  // Password-type variables go to the secret store by default
  useEffect(() => {
    const vars = detail?.template.variables ?? []
    setStoreAsSecret(new Set(vars.filter((v) => v.type === 'password').map((v) => v.name)))
  }, [detail])

  // Every ${SECRETS_NAME} the deployment will need: template files + typed values + lock toggles
  const requiredSecrets = useMemo(() => {
    const names = new Set<string>()
    for (const s of detail?.secrets ?? []) names.add(s.name)
    for (const value of Object.values(variables)) {
      for (const m of String(value ?? '').matchAll(SECRET_REF_ALL)) names.add(m[1])
    }
    return Array.from(names).sort()
  }, [detail, variables])
  const willCreateSecrets = useMemo(() => {
    const out = new Set<string>()
    for (const name of storeAsSecret) {
      if ((variables[name] ?? '').trim() && !SECRET_REF_ONE.test(variables[name].trim())) out.add((secretNames[name] ?? name).trim() || name)
    }
    return out
  }, [storeAsSecret, variables, secretNames])
  const missingSecrets = useMemo(
    () => requiredSecrets.filter((n) => !(existingSecrets?.has(n) ?? true) && !willCreateSecrets.has(n)),
    [requiredSecrets, existingSecrets, willCreateSecrets],
  )

  const handleCreateSecret = useCallback(async (name: string) => {
    const value = (secretDrafts[name] ?? '').trim()
    if (!value) { addToast({ type: 'warning', message: `Enter or generate a value for ${name} first` }); return }
    setCreatingSecret(name)
    try {
      await setSecret(name, value)
      setExistingSecrets((prev) => new Set([...(prev ?? []), name]))
      setSecretDrafts((prev) => { const next = { ...prev }; delete next[name]; return next })
      addToast({ type: 'success', message: `Secret ${name} stored — referenced as \${SECRETS_${name}}` })
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : `Could not store ${name}` })
    } finally {
      setCreatingSecret(null)
    }
  }, [secretDrafts, addToast])

  // Poll the stack's activity while the background start runs
  useEffect(() => {
    if (!deployResult || outcome !== 'pending') return
    const stack = deployResult.target_stack
    const startedAt = Date.now()
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let firstError: number | null = null
    const tick = async () => {
      try {
        const a = await fetchStackActivity(stack)
        if (cancelled) return
        setActivity(a)
        setActivityError(null)
        if (a.phase === 'running') { setOutcome('running'); return }
        if (a.phase === 'failed' || a.phase === 'exited' || a.phase === 'unhealthy') { setOutcome('failed'); return }
        if (a.phase === 'healthcheck' && a.finished_at && Date.now() - new Date(a.finished_at).getTime() > 90_000) { setOutcome('running'); return }
        if (!a.active && a.phase === 'started') { setOutcome('running'); return }
        if (!a.active && a.phase === 'idle' && Date.now() - startedAt > 20_000) { setOutcome('running'); return }
      } catch (err) {
        if (cancelled) return
        firstError ??= Date.now()
        setActivityError(err instanceof Error ? err.message : 'Progress unavailable')
        // A server without the activity endpoint: fall back to the old optimistic behaviour
        if (Date.now() - firstError > 20_000) { setOutcome('running'); return }
      }
      if (Date.now() - startedAt > 15 * 60_000) {
        setActivityError('Still not finished after 15 minutes — the start continues in the background')
        setOutcome('failed')
        return
      }
      if (!cancelled) timer = setTimeout(tick, 1500)
    }
    timer = setTimeout(tick, 400)
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [deployResult, outcome])

  // Keep the compose output scrolled to its end
  useEffect(() => {
    const el = outputRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [activity?.output.length, showOutput])

  // Open the container page once everything runs — with a way to stay
  const firstContainer = activity?.services[0]?.container || (deployResult?.services_added?.[0] ? deployResult.containers?.[deployResult.services_added[0]] || deployResult.services_added[0] : '')
  const openContainers = useCallback(() => {
    onClose()
    setCurrentPage('containers', firstContainer ? { focusContainer: firstContainer } : {})
  }, [onClose, setCurrentPage, firstContainer])
  useEffect(() => {
    if (outcome === 'running' && deployResult) setAutoOpenIn(4)
  }, [outcome, deployResult])
  useEffect(() => {
    if (autoOpenIn === null) return
    if (autoOpenIn <= 0) { openContainers(); return }
    const t = setTimeout(() => setAutoOpenIn((v) => (v === null ? null : v - 1)), 1000)
    return () => clearTimeout(t)
  }, [autoOpenIn, openContainers])

  const handleStartNow = useCallback(async () => {
    if (!deployResult) return
    try {
      await startStack(deployResult.target_stack)
      setActivity(null)
      setShowOutput(true)
      setOutcome('pending')
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not start the stack' })
    }
  }, [deployResult, addToast])

  const canDeploy = targetStack.length > 0 && !deploying && !detailLoading

  // F2: Resolve selected stack info
  const selectedStack = stacks.find((s) => s.name === targetStack)

  // F4: Extract service names from template for confirmation panel
  const templateServiceNames = useMemo(() => {
    if (!detail?.compose) return [template.name]
    // Only extract service names from within the services: block
    const servicesMatch = detail.compose.match(/^services:\s*\n([\s\S]*?)(?=^[a-zA-Z]|\Z)/m)
    if (!servicesMatch) return [template.name]
    const matches = servicesMatch[1].match(/^  [a-zA-Z_-][a-zA-Z0-9_-]*:/gm)
    return matches ? matches.map((m) => m.trim().replace(/:$/, '')) : [template.name]
  }, [detail, template.name])

  // Compose lint warnings (client-side compose-linter — respects plugin toggle)
  const linterEnabled = usePluginStore((s) => { const p = s.plugins.find((pl) => pl.name === 'compose-linter'); return !p || p.enabled })
  const lintWarnings = useMemo(() => linterEnabled ? lintCompose(detail?.compose || '') : [], [detail?.compose, linterEnabled])

  // Plugin hooks awareness — which active plugins fire during deployment
  const plugins = usePluginStore((s) => s.plugins)
  const fetchPlugins = usePluginStore((s) => s.fetchPlugins)
  useEffect(() => { fetchPlugins() }, [fetchPlugins])
  const deployHookPlugins = useMemo(() => {
    return plugins.filter(
      (p) => p.enabled && (p.hooks ?? []).some((h) => h === 'pre-deploy' || h === 'post-deploy'),
    )
  }, [plugins])

  // F1: Handle deploy click — first click shows confirmation, second executes
  const handleDeployClick = useCallback(async () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setLocalDeploying(true)
    setActivity(null)
    setActivityError(null)
    setAutoOpenIn(null)
    // Values marked "store as secret" go to the encrypted store first; the
    // deployment then only ever sees the ${SECRETS_NAME} reference
    const varsToSend: Record<string, string> = { ...variables }
    for (const name of storeAsSecret) {
      const val = (variables[name] ?? '').trim()
      if (!val || SECRET_REF_ONE.test(val)) continue
      const secretName = (secretNames[name] ?? name).trim() || name
      if (!SECRET_NAME_OK.test(secretName)) {
        addToast({ type: 'error', message: `${secretName} is not a valid secret name — letters, digits and underscores, starting with a letter` })
        setLocalDeploying(false)
        return
      }
      try {
        await setSecret(secretName, val)
        varsToSend[name] = `\${SECRETS_${secretName}}`
        setExistingSecrets((prev) => new Set([...(prev ?? []), secretName]))
      } catch (err) {
        addToast({ type: 'error', message: `Could not store ${secretName} as a secret: ${err instanceof Error ? err.message : 'request failed'}` })
        setLocalDeploying(false)
        return
      }
    }
    const exclude = excludedServices.size > 0 ? Array.from(excludedServices) : undefined
    const routes = traefikActive && enableRouting && Object.keys(customRoutes).length > 0 ? customRoutes : undefined
    const proxyFlag = traefikActive && connectProxy ? true : undefined
    const resLimits = enableResourceLimits && (memLimit || cpuLimit)
      ? { mem_limit: memLimit || undefined, cpus: cpuLimit ? Number(cpuLimit) : undefined }
      : undefined
    const homarrFlag = homarrActive && addToHomarr ? true : undefined
    const names = Object.keys(customContainerNames).length > 0 ? customContainerNames : undefined
    const result = await onDeploy(targetStack, varsToSend, autoStart, replaceServices || undefined, exclude, routes, proxyFlag, resLimits, homarrFlag, names)
    if (result) {
      setDeployResult(result)
      setOutcome(result.started ? 'pending' : 'not-started')
      setShowOutput(true)
    }
    setLocalDeploying(false)
  }, [confirming, onDeploy, targetStack, variables, autoStart, replaceServices, excludedServices, traefikActive, enableRouting, customRoutes, connectProxy, enableResourceLimits, memLimit, cpuLimit, homarrActive, addToHomarr, storeAsSecret, secretNames, customContainerNames, addToast])

  // F4: Handle "View Stack" navigation
  const handleViewStack = useCallback(() => {
    setCurrentPage('stacks', { highlight: deployResult?.target_stack ?? targetStack })
  }, [setCurrentPage, deployResult, targetStack])

  // F4: Handle "Undo Deploy" (undeploy)
  const handleUndoDeploy = useCallback(async () => {
    if (!deployResult || !onUndeploy) return
    if (!window.confirm(`Undo deploy? This will remove the deployed services from "${deployResult.target_stack}".`)) return
    setUndeploying(true)
    const ok = await onUndeploy(template.name, deployResult.target_stack, deployResult.services_added || [])
    setUndeploying(false)
    if (ok) onClose()
  }, [deployResult, onUndeploy, template.name, onClose])

  // F5: Handle dry-run preview
  const [dryRunError, setDryRunError] = useState<string | null>(null)
  const handleDryRun = useCallback(async () => {
    setDryRunLoading(true)
    setDryRunResult(null)
    setDryRunError(null)
    try {
      const exclude = excludedServices.size > 0 ? Array.from(excludedServices) : undefined
      const res = await dryRunTemplate(template.name, { target_stack: targetStack, variables, exclude_services: exclude })
      setDryRunResult(res)
    } catch (err) {
      setDryRunResult(null)
      setDryRunError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setDryRunLoading(false)
    }
  }, [template.name, targetStack, variables, excludedServices])

  const headerTone = deployResult
    ? (outcome === 'running' ? 'ok' : outcome === 'failed' ? 'bad' : outcome === 'not-started' ? 'held' : 'busy')
    : localDeploying ? 'busy' : 'idle'
  const headerTitle = deployResult
    ? (outcome === 'running' ? 'Deployed and running' : outcome === 'failed' ? 'Deployment needs attention' : outcome === 'not-started' ? 'Merged — not started' : `Deploying ${template.name}`)
    : localDeploying ? `Preparing ${template.name}` : `Deploy: ${template.name}`
  const headerSub = deployResult
    ? (outcome === 'pending'
      ? `${phaseLabel(activity?.phase)}${activity?.elapsed_s ? ` · ${activity.elapsed_s}s` : ''}`
      : `${deployResult.services_added?.length ?? 0} service${(deployResult.services_added?.length ?? 0) === 1 ? '' : 's'} in ${deployResult.target_stack}`)
    : localDeploying ? 'Checking conflicts, merging the compose file, writing variables and routes' : template.description
  const progressServices: StackActivityService[] = activity?.services?.length
    ? activity.services
    : (deployResult?.services_added ?? []).map((svc) => ({ service: svc, container: deployResult?.containers?.[svc] ?? svc, image: '', state: 'missing', health: 'none', pulled: false, created: false, started: false }))
  const currentStep = stepForPhase(activity?.phase, progressServices)

  const renderSecretsPanel = () => requiredSecrets.length === 0 ? null : (
    <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.04] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <KeyRound size={13} className="text-violet-300 shrink-0" />
        <p className="text-xs font-semibold text-violet-200">Secrets this deployment uses</p>
        <span className="ml-auto text-[10px] text-slate-500">
          {existingSecrets === null ? 'checking…' : missingSecrets.length === 0 ? 'all available' : `${missingSecrets.length} missing`}
        </span>
      </div>
      {requiredSecrets.map((name) => {
        const exists = existingSecrets?.has(name) ?? false
        const willCreate = willCreateSecrets.has(name)
        return (
          <div key={name} className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-slate-200">{name}</span>
            {exists ? (
              <span className="text-[9px] px-1.5 py-px rounded bg-emerald-500/10 text-emerald-300">stored</span>
            ) : willCreate ? (
              <span className="text-[9px] px-1.5 py-px rounded bg-cyan-500/10 text-cyan-300">stored when you deploy</span>
            ) : (
              <>
                <span className="text-[9px] px-1.5 py-px rounded bg-amber-500/10 text-amber-300">missing</span>
                <input
                  type="password"
                  value={secretDrafts[name] ?? ''}
                  onChange={(e) => setSecretDrafts((prev) => ({ ...prev, [name]: e.target.value }))}
                  placeholder="value"
                  className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/40"
                />
                <button type="button" onClick={() => setSecretDrafts((prev) => ({ ...prev, [name]: generateSecretValue() }))} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10" title="Generate a random 32-character value">
                  <Wand2 size={11} /> Generate
                </button>
                <button type="button" onClick={() => void handleCreateSecret(name)} disabled={creatingSecret === name || !isAdmin} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-violet-500/15 text-violet-200 border border-violet-500/25 hover:bg-violet-500/25 disabled:opacity-50">
                  {creatingSecret === name ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />} Store
                </button>
              </>
            )}
          </div>
        )
      })}
      <p className="text-[10px] text-slate-500">
        Values live only in the encrypted secret store; the compose and .env files keep the {'${SECRETS_NAME}'} reference and DCS fills it in when the stack starts.
      </p>
    </div>
  )

  const renderOutputPanel = (defaultOpen: boolean) => (
    <div className="rounded-xl border border-white/5 bg-slate-950/70 overflow-hidden">
      <button type="button" onClick={() => setShowOutput((v) => !v)} className="w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors">
        <span className="flex items-center gap-1.5"><Terminal size={11} /> Compose output</span>
        <span>{activity?.output?.length ?? 0} lines · {(showOutput ?? defaultOpen) ? 'hide' : 'show'}</span>
      </button>
      {showOutput && (
        <pre ref={outputRef} className="px-3 pb-3 text-[10px] font-mono text-slate-400 leading-relaxed max-h-48 overflow-y-auto scrollbar-thin whitespace-pre-wrap break-all">
          {(activity?.output ?? []).join('\n') || (activityError ? activityError : 'Waiting for output…')}
        </pre>
      )}
    </div>
  )

  const renderServiceRows = () => (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] divide-y divide-white/[0.04]">
      {progressServices.map((svc) => {
        const chip = serviceChip(svc)
        return (
          <div key={svc.service} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-200 truncate">
                {svc.service}
                {svc.container && svc.container !== svc.service && <span className="text-slate-500 font-mono text-[10px]"> → {svc.container}</span>}
              </p>
              {svc.image && <p className="text-[10px] text-slate-500 font-mono truncate">{svc.image}</p>}
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${chip.cls}`}>
              {chip.busy && <Loader2 size={9} className="animate-spin" />}
              {chip.text}
            </span>
          </div>
        )
      })}
      {progressServices.some((s) => s.detail && (s.health === 'unhealthy' || s.state === 'exited' || s.state === 'dead')) && (
        <div className="px-3 py-2 space-y-1">
          {progressServices.filter((s) => s.detail && (s.health === 'unhealthy' || s.state === 'exited' || s.state === 'dead')).map((s) => (
            <p key={`${s.service}-detail`} className="text-[10px] font-mono text-rose-300/80 whitespace-pre-wrap break-all"><span className="text-slate-500">{s.service}: </span>{s.detail}</p>
          ))}
        </div>
      )}
    </div>
  )

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={localDeploying ? undefined : onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl mx-3 md:mx-4 max-h-[92vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/40 flex flex-col animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
              headerTone === 'ok' ? 'bg-emerald-500/20 border-emerald-500/30'
              : headerTone === 'bad' ? 'bg-rose-500/15 border-rose-500/25'
              : headerTone === 'held' ? 'bg-amber-500/15 border-amber-500/25'
              : headerTone === 'busy' ? 'bg-cyan-500/20 border-cyan-500/30'
              : 'bg-emerald-500/15 border-emerald-500/20'}`}>
              {headerTone === 'ok' ? <CheckCircle size={16} className="text-emerald-400" />
                : headerTone === 'bad' ? <AlertTriangle size={16} className="text-rose-400" />
                : headerTone === 'held' ? <AlertTriangle size={16} className="text-amber-400" />
                : headerTone === 'busy' ? <Loader2 size={16} className="text-cyan-400 animate-spin" />
                : <Rocket size={16} className="text-emerald-400" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-200 truncate">{headerTitle}</h3>
              <p className="text-[11px] text-slate-500 truncate">{headerSub}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors shrink-0 ml-2"
          >
            <X size={16} />
          </button>
        </div>

        {/* Preparing: the deploy request itself (merge, routes, DNS) */}
        {localDeploying && !deployResult ? (
          <div className="flex-1 flex flex-col items-center justify-center py-14 gap-4 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Loader2 size={28} className="text-cyan-400 animate-spin" />
            </div>
            <div className="text-center max-w-sm">
              <p className="text-sm font-semibold text-slate-200">Preparing {template.name}</p>
              <p className="text-xs text-slate-400 mt-1">Checking conflicts, merging the compose file, writing variables and routes into {targetStack}</p>
            </div>
          </div>
        ) : deployResult && outcome === 'pending' ? (
          <>
            {/* Live progress from GET /stacks/{stack}/activity */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 scrollbar-thin animate-fade-in">
              <div className="grid grid-cols-5 gap-1.5">
                {DEPLOY_STEPS.map((st, i) => {
                  const done = i < currentStep
                  const active = i === currentStep
                  return (
                    <div key={st.label} className={`rounded-lg px-2 py-2 text-center border transition-all duration-300 ${done ? 'bg-emerald-500/10 border-emerald-500/20' : active ? 'bg-cyan-500/10 border-cyan-500/25' : 'bg-white/[0.02] border-white/5'}`}>
                      <div className="flex items-center justify-center h-4">
                        {done ? <CheckCircle size={13} className="text-emerald-400" /> : active ? <Loader2 size={13} className="text-cyan-400 animate-spin" /> : <Circle size={10} className="text-slate-600" />}
                      </div>
                      <p className={`text-[11px] font-medium mt-1 ${done ? 'text-emerald-300' : active ? 'text-cyan-200' : 'text-slate-500'}`}>{st.label}</p>
                      <p className="text-[9px] text-slate-600 truncate">{st.hint}</p>
                    </div>
                  )
                })}
              </div>
              {renderServiceRows()}
              {renderOutputPanel(true)}
              {activityError && <p className="text-[10px] text-amber-400/80">{activityError}</p>}
            </div>
            <div className="flex items-center justify-between gap-2 px-4 md:px-5 py-4 border-t border-white/5 shrink-0">
              <p className="text-[10px] text-slate-500">Closing this window does not stop the deployment.</p>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors">Continue in background</button>
                <button onClick={handleViewStack} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-colors">
                  View Stack <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </>
        ) : deployResult ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 scrollbar-thin animate-fade-in">
              {outcome === 'running' && (
                <div className="flex flex-col items-center text-center py-3 gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle size={28} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      {deployResult.services_added?.length || 0} service{(deployResult.services_added?.length || 0) !== 1 ? 's' : ''} running in <span className="font-mono text-emerald-400">{deployResult.target_stack}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Containers are created and started{progressServices.some((s) => s.health === 'healthy') ? ', health checks pass' : ''}.</p>
                  </div>
                  {autoOpenIn !== null && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Loader2 size={12} className="animate-spin text-cyan-400" />
                      Opening the container page in {autoOpenIn}s
                      <button onClick={() => setAutoOpenIn(null)} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10">Stay here</button>
                    </div>
                  )}
                </div>
              )}
              {outcome === 'failed' && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3">
                  <p className="text-xs font-semibold text-rose-300 flex items-center gap-2"><AlertTriangle size={13} /> {phaseLabel(activity?.phase)}</p>
                  <p className="text-[11px] text-rose-200/80 mt-1 break-words">{activity?.error || activityError || 'Compose reported a problem while starting the services. The output below has the details; the compose file was merged and can be edited on the Stacks page.'}</p>
                </div>
              )}
              {outcome === 'not-started' && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
                  <p className="text-xs font-semibold text-amber-300 flex items-center gap-2"><AlertTriangle size={13} /> Merged into {deployResult.target_stack}, containers not started</p>
                  <p className="text-[11px] text-amber-200/80 mt-1">{deployResult.warning || 'Auto-start was off. Start the stack when you are ready.'}</p>
                </div>
              )}
              {outcome === 'not-started' && renderSecretsPanel()}
              {renderServiceRows()}
              {deployResult.backup_file && (
                <p className="text-[10px] text-slate-500">Previous compose file kept as <span className="font-mono">{deployResult.backup_file}</span></p>
              )}
              {(outcome === 'failed' || (activity?.output?.length ?? 0) > 0) && renderOutputPanel(outcome === 'failed')}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 px-4 md:px-5 py-4 border-t border-white/5 shrink-0">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors">Done</button>
              {isAdmin && onUndeploy && (
                <button onClick={handleUndoDeploy} disabled={undeploying} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                  {undeploying ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                  Undo Deploy
                </button>
              )}
              {isAdmin && outcome !== 'running' && (
                <button onClick={handleStartNow} disabled={outcome === 'not-started' && missingSecrets.length > 0} title={outcome === 'not-started' && missingSecrets.length > 0 ? 'Store the missing secrets first' : 'Run the stack start again'} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
                  <Play size={13} />
                  {outcome === 'failed' ? 'Retry start' : 'Start now'}
                </button>
              )}
              {outcome === 'running' && (
                <button onClick={openContainers} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors">
                  <Package size={13} />
                  View Container{(deployResult.services_added?.length ?? 0) > 1 ? 's' : ''}
                </button>
              )}
              <button onClick={handleViewStack} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors">
                View Stack
                <ArrowRight size={13} />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 scrollbar-thin">
              {/* F2: Enriched target stack dropdown */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Target Stack <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500/30 focus:bg-white/[0.05] transition-colors text-left"
                  >
                    {targetStack ? (
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedStack?.status === 'running' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        <span className="truncate">{targetStack}</span>
                        {selectedStack && (
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {selectedStack.status === 'running' ? `${selectedStack.running_containers} running` : 'stopped'}
                          </span>
                        )}
                        {targetStack === defaultStack && (
                          <span className="text-[9px] text-emerald-500/70 font-semibold shrink-0">recommended</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-500">Select a stack...</span>
                    )}
                    <ChevronDown size={14} className={`text-slate-500 transition-transform duration-150 shrink-0 ml-2 ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg bg-slate-800 border border-white/10 shadow-xl shadow-black/30 scrollbar-thin">
                      {stacks.map((s) => (
                        <button
                          key={s.name}
                          onClick={() => { setTargetStack(s.name); setDropdownOpen(false); setConfirming(false) }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors ${s.name === targetStack ? 'bg-white/5' : ''}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.status === 'running' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                          <span className="font-mono text-slate-200 truncate flex-1">{s.name}</span>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {s.status === 'running' ? `${s.running_containers} running` : 'stopped'}
                          </span>
                          {s.name === defaultStack && (
                            <span className="text-[9px] text-emerald-500/70 font-semibold shrink-0">recommended</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {defaultStack && targetStack !== defaultStack && (
                  <p className="text-[10px] text-amber-400/70 mt-1">
                    Suggested stack for this template: <span className="font-mono">{defaultStack}</span>
                  </p>
                )}
              </div>

              {/* Template variables + auto-detected compose env vars */}
              {(() => {
                // Merge template-defined vars with compose-parsed vars
                const composeVars = detail?.compose ? parseComposeVariables(detail.compose) : []
                const definedNames = new Set(templateVars.map((v) => v.name))
                const extraVars = composeVars.filter((cv) => !definedNames.has(cv.name))

                const allVars = [
                  ...templateVars.map((v) => ({
                    name: v.name,
                    label: v.label || v.name,
                    description: v.description || '',
                    defaultValue: v.default || '',
                    required: v.required || false,
                    type: v.type || '',
                    isBoolean: v.type === 'boolean' || v.default === 'true' || v.default === 'false',
                    show_if: v.show_if,
                    options: v.options,
                  })),
                  ...extraVars.map((v) => ({
                    name: v.name,
                    label: v.name,
                    description: '',
                    defaultValue: v.defaultValue,
                    required: false,
                    type: '',
                    isBoolean: v.defaultValue === 'true' || v.defaultValue === 'false',
                  })),
                ]

                return allVars.length > 0 ? (
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Variables
                    </label>
                    <div className="space-y-2.5">
                      {allVars.map((v) => {
                        const value = variables[v.name] ?? v.defaultValue
                        // Conditional visibility: hide fields whose show_if condition isn't met
                        if (v.show_if) {
                          const visible = Object.entries(v.show_if).every(([dep, expected]) => {
                            const depVal = variables[dep] ?? allVars.find((av) => av.name === dep)?.defaultValue ?? ''
                            return depVal === expected
                          })
                          if (!visible) return null
                        }
                        // Segmented toggle buttons for variables with options
                        if (v.options && v.options.length > 0) {
                          return (
                            <div key={v.name}>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs text-slate-300 font-medium">{v.label}</span>
                                {v.required && <span className="text-[9px] text-rose-400 font-semibold">Required</span>}
                              </div>
                              {v.description && <p className="text-[10px] text-slate-500 mb-1.5">{v.description}</p>}
                              <div className="flex rounded-lg overflow-hidden border border-white/10">
                                {v.options.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleVariableChange(v.name, opt.value)}
                                    className={`flex-1 px-3 py-2 text-[11px] font-medium transition-all duration-150 ${
                                      value === opt.value
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                        : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-300'
                                    } ${v.options!.indexOf(opt) > 0 ? 'border-l border-white/10' : ''}`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        }
                        if (v.isBoolean) {
                          const isOn = value === 'true'
                          return (
                            <div key={v.name} className="flex items-center justify-between py-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-300 font-medium">{v.label}</span>
                                  {v.required && <span className="text-[9px] text-rose-400 font-semibold">Required</span>}
                                </div>
                                {v.description && <p className="text-[10px] text-slate-500 mt-0.5">{v.description}</p>}
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{v.name}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleVariableChange(v.name, isOn ? 'false' : 'true')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0 ml-3 ${isOn ? 'bg-emerald-500' : 'bg-slate-700'}`}
                              >
                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${isOn ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                            </div>
                          )
                        }
                        return (
                          <div key={v.name}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs text-slate-400 font-medium">{v.label}</span>
                              {v.required && (
                                <span className="text-[9px] text-rose-400 font-semibold">Required</span>
                              )}
                            </div>
                            {v.description && <p className="text-[10px] text-slate-500 mb-1">{v.description}</p>}
                            <div className="relative">
                              <input
                                type={v.type === 'password' ? 'password' : 'text'}
                                value={value}
                                onChange={(e) => handleVariableChange(v.name, e.target.value)}
                                placeholder={v.defaultValue || v.name}
                                className={`w-full px-3 py-2 rounded-lg bg-white/5 border text-xs text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:ring-1 transition-all ${storeAsSecret.has(v.name) ? 'border-violet-500/30 focus:border-violet-500/50 focus:ring-violet-500/20 pr-10' : 'border-white/5 focus:border-emerald-500/40 focus:ring-emerald-500/20'} ${isSensitiveVariable(v) ? 'pr-10' : ''}`}
                              />
                              {isSensitiveVariable(v) && isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => setStoreAsSecret((prev) => { const next = new Set(prev); if (next.has(v.name)) next.delete(v.name); else next.add(v.name); return next })}
                                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${storeAsSecret.has(v.name) ? 'text-violet-300 bg-violet-500/15' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                  title={storeAsSecret.has(v.name) ? `Stored in the secret store as ${v.name}; the stack .env keeps only \${SECRETS_${v.name}}. Click to write the value into .env instead.` : `Store this value in the encrypted secret store as ${v.name} instead of the .env file`}
                                >
                                  <Lock size={12} />
                                </button>
                              )}
                            </div>
                            {storeAsSecret.has(v.name) && (value ?? '').trim() && !SECRET_REF_ONE.test((value ?? '').trim()) && (() => {
                              const sn = secretNames[v.name] ?? v.name
                              const ok = SECRET_NAME_OK.test(sn)
                              return (
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1 text-[10px] text-violet-300/70">
                                  <span>Saved as secret</span>
                                  <input
                                    type="text"
                                    value={sn}
                                    onChange={(e) => setSecretNames((prev) => ({ ...prev, [v.name]: e.target.value.replace(/[^A-Za-z0-9_]/g, '') }))}
                                    spellCheck={false}
                                    title="Name of the secret in the store — you can pick any name"
                                    className={`w-44 px-1.5 py-0.5 rounded bg-white/5 border text-[10px] font-mono text-violet-200 focus:outline-none transition-colors ${ok ? 'border-violet-500/30 focus:border-violet-500/60' : 'border-rose-500/50'}`}
                                  />
                                  <span>when you deploy — the stack&apos;s .env will hold <span className="font-mono">{`\${SECRETS_${sn || '…'}}`}</span></span>
                                  {!ok && <span className="basis-full text-rose-400">Letters, digits and underscores, starting with a letter</span>}
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null
              })()}

              {/* Container names — what Docker calls each service's container */}
              {composeServices.filter((svc) => !excludedServices.has(svc.name)).length > 0 && (() => {
                const active = composeServices.filter((svc) => !excludedServices.has(svc.name))
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Container names</label>
                      <span className="text-[10px] text-slate-500">{active.length} service{active.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="space-y-2">
                      {active.map((svc) => {
                        const typed = containerNames[svc.name] ?? ''
                        const fallback = svc.containerName || `${(targetStack || 'stack').toLowerCase()}-${svc.name}-1`
                        const blocking = containerNameIssues.blocking[svc.name]
                        const warning = containerNameIssues.warnings[svc.name]
                        return (
                          <div key={svc.name}>
                            <div className="flex items-center gap-2">
                              <span className="w-28 shrink-0 truncate text-[11px] font-mono text-slate-400" title={`service ${svc.name}`}>{svc.name}</span>
                              <input
                                type="text"
                                value={typed}
                                onChange={(e) => setContainerNames((prev) => ({ ...prev, [svc.name]: e.target.value.replace(/\s+/g, '') }))}
                                placeholder={fallback}
                                spellCheck={false}
                                className={`flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-white/5 border text-xs text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:ring-1 transition-all ${blocking ? 'border-rose-500/50 focus:border-rose-500/60 focus:ring-rose-500/20' : warning ? 'border-amber-500/40 focus:border-amber-500/50 focus:ring-amber-500/20' : 'border-white/5 focus:border-emerald-500/40 focus:ring-emerald-500/20'}`}
                              />
                            </div>
                            {(blocking || warning) && (
                              <p className={`text-[10px] mt-1 ml-[7.5rem] ${blocking ? 'text-rose-400' : 'text-amber-300/80'}`}>{blocking || warning}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5">
                      Leave a name empty to keep the template&apos;s default{traefikActive && traefikDomain ? '; HTTPS routes follow the name you choose' : ''}.
                    </p>
                  </div>
                )
              })()}

              {renderSecretsPanel()}

              {/* Auto-start toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-xs font-medium text-slate-300">Auto-start after deploy</p>
                  <p className="text-[11px] text-slate-500">
                    {autoStart && missingSecrets.length > 0
                      ? `Held until ${missingSecrets.join(', ')} exist${missingSecrets.length === 1 ? 's' : ''} — store them above or turn this off`
                      : 'Pull the images, create and start the containers right away'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoStart((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0 ml-3 ${
                    autoStart ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      autoStart ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Optional services toggles */}
              {optionalServices.length > 0 && (
                <div className="space-y-2">
                  {optionalServices.map((opt) => {
                    const isExcluded = excludedServices.has(opt.service)
                    return (
                      <div key={opt.service} className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-xs font-medium text-slate-300">{opt.label}</p>
                          {opt.description && (
                            <p className="text-[11px] text-slate-500">{opt.description}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setExcludedServices((prev) => {
                            const next = new Set(prev)
                            if (isExcluded) next.delete(opt.service)
                            else next.add(opt.service)
                            return next
                          })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0 ml-3 ${
                            !isExcluded ? 'bg-emerald-500' : 'bg-slate-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                              !isExcluded ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Traefik Routing (when Traefik is active and services have ports) */}
              {traefikActive && traefikDomain && traefikDomain !== 'example.com' && routeServices.length > 0 && (
                <div className="rounded-lg border border-emerald-500/15 overflow-hidden">
                  {/* Master toggle + header */}
                  <div className="flex items-center justify-between px-3 py-2.5 bg-emerald-500/5">
                    <button
                      onClick={() => setShowRoutes((prev) => !prev)}
                      className="flex items-center gap-2 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <ChevronDown size={14} className={`transition-transform duration-200 ${showRoutes ? '' : '-rotate-90'}`} />
                      <Network size={13} />
                      HTTPS Routing
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">{enableRouting ? `${routeServices.filter((s) => s.enabled).length} route${routeServices.filter((s) => s.enabled).length !== 1 ? 's' : ''}` : 'Off'}</span>
                      <button
                        type="button"
                        onClick={() => setEnableRouting(!enableRouting)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 ${enableRouting ? 'bg-emerald-500' : 'bg-slate-700'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${enableRouting ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded route details — directly under the HTTPS Routing header */}
                  {showRoutes && enableRouting && (
                    <div className="px-3 py-3 space-y-2 animate-fade-in border-t border-emerald-500/10">
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Each service with ports gets an HTTPS route via Traefik. Edit subdomains or disable services you don't want exposed.
                      </p>

                      {/* Per-service subdomain rows */}
                      {routeServices.map((svc, idx) => (
                        <div key={svc.name} className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-all ${svc.enabled ? 'border-white/5 bg-white/[0.03]' : 'border-white/[0.03] opacity-50'}`}>
                          <button
                            type="button"
                            onClick={() => setRouteServices((prev) => prev.map((s, i) => i === idx ? { ...s, enabled: !s.enabled } : s))}
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${svc.enabled ? 'bg-emerald-500/30 border-emerald-500/40 text-emerald-400' : 'border-white/10'}`}
                          >
                            {svc.enabled && <CheckCircle size={10} />}
                          </button>
                          <input
                            type="text"
                            value={svc.subdomain}
                            onChange={(e) => setRouteServices((prev) => prev.map((s, i) => i === idx ? { ...s, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') } : s))}
                            disabled={!svc.enabled}
                            className="w-24 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/40 disabled:opacity-50 transition-all"
                          />
                          <span className="text-[10px] text-slate-500">.{traefikDomain}</span>
                          <span className="text-[10px] text-slate-500 ml-auto">:{svc.port}</span>
                          <span className="text-[10px] text-slate-500 truncate max-w-[80px]" title={containerNameFor(svc)}>{containerNameFor(svc)}</span>
                        </div>
                      ))}

                      {/* Advanced: raw YAML toggle */}
                      <button
                        onClick={() => setShowAdvancedRoutes((prev) => !prev)}
                        className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors mt-1"
                      >
                        <ChevronDown size={10} className={`transition-transform duration-200 ${showAdvancedRoutes ? '' : '-rotate-90'}`} />
                        Advanced: Edit raw YAML
                      </button>
                      {showAdvancedRoutes && (
                        <div className="space-y-2 animate-fade-in">
                          {Object.entries(customRoutes).map(([svcName, routeYaml]) => (
                            <div key={svcName} className="rounded-lg border border-white/5 overflow-hidden">
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03]">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span className="text-[10px] font-semibold text-slate-400">{svcName}.{traefikDomain}</span>
                              </div>
                              <textarea
                                value={routeYaml}
                                onChange={(e) => setCustomRoutes((prev) => ({ ...prev, [svcName]: e.target.value }))}
                                rows={Math.min(routeYaml.split('\n').length + 1, 16)}
                                spellCheck={false}
                                className="w-full bg-slate-950 text-[10px] font-mono text-slate-300 p-3 border-0 focus:outline-none focus:ring-0 resize-y scrollbar-thin leading-relaxed"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Proxy Network Toggle */}
                  <div className="flex items-center justify-between px-3 py-2 border-t border-emerald-500/10 bg-emerald-500/[0.02]">
                    <div className="flex items-center gap-2">
                      <Network size={12} className="text-slate-500" />
                      <span className="text-[11px] text-slate-400">Connect to <span className="text-emerald-400 font-medium">proxy</span> network</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConnectProxy(!connectProxy)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 ${connectProxy ? 'bg-emerald-500' : 'bg-slate-700'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${connectProxy ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                    </button>
                  </div>

                  {/* Authelia SSO Protection Toggle */}
                  <div className="flex items-center justify-between px-3 py-2 border-t border-emerald-500/10 bg-violet-500/[0.02]">
                    <div className="flex items-center gap-2">
                      <Shield size={12} className="text-violet-400" />
                      <span className="text-[11px] text-slate-400">Protect with <span className="text-violet-400 font-medium">Authelia</span> SSO</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEnableAuthelia(!enableAuthelia)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 ${enableAuthelia ? 'bg-violet-500' : 'bg-slate-700'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${enableAuthelia ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                    </button>
                  </div>
                </div>
              )}

              {/* Homarr Dashboard Toggle — only visible when Homarr is deployed with API key */}
              {homarrActive && (
                <div className="rounded-lg border border-white/5 bg-orange-500/[0.02] overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Store size={13} className="text-orange-400" />
                      <span className="text-[11px] font-medium text-slate-300">Add to <span className="text-orange-400 font-medium">Homarr</span> Dashboard</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddToHomarr(!addToHomarr)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 ${addToHomarr ? 'bg-orange-500' : 'bg-slate-700'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${addToHomarr ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                    </button>
                  </div>
                </div>
              )}

              {/* Resource Limits Toggle */}
              <div className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={13} className="text-amber-400" />
                    <span className="text-[11px] font-medium text-slate-300">Resource Limits</span>
                    <span className="text-[10px] text-slate-500">per service</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableResourceLimits(!enableResourceLimits)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 ${enableResourceLimits ? 'bg-amber-500' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${enableResourceLimits ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                  </button>
                </div>
                {enableResourceLimits && (
                  <div className="px-3 py-3 border-t border-white/5 space-y-3 animate-fade-in">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Memory Limit</label>
                        <select
                          value={memLimit}
                          onChange={(e) => setMemLimit(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-amber-500/40"
                        >
                          <option value="">No limit</option>
                          <option value="128m">128 MB</option>
                          <option value="256m">256 MB</option>
                          <option value="512m">512 MB</option>
                          <option value="1g">1 GB</option>
                          <option value="2g">2 GB</option>
                          <option value="4g">4 GB</option>
                          <option value="8g">8 GB</option>
                          <option value="16g">16 GB</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">CPU Limit</label>
                        <select
                          value={cpuLimit}
                          onChange={(e) => setCpuLimit(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-amber-500/40"
                        >
                          <option value="">No limit</option>
                          <option value="0.5">0.5 CPU</option>
                          <option value="1">1 CPU</option>
                          <option value="2">2 CPUs</option>
                          <option value="4">4 CPUs</option>
                          <option value="8">8 CPUs</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Applies to all services in this template. You can fine-tune per-service limits in the compose editor after deployment.
                    </p>
                  </div>
                )}
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
                        <Loader2 size={18} className="animate-spin text-slate-500" />
                      </div>
                    ) : detail?.compose ? (
                      <pre className="bg-slate-950 rounded-lg p-3 text-[11px] font-mono text-slate-400 overflow-x-auto max-h-[52vh] scrollbar-thin leading-relaxed whitespace-pre-wrap break-all">
                        {detail.compose}
                      </pre>
                    ) : (
                      <div className="bg-slate-950 rounded-lg p-3 text-xs text-slate-500 italic">
                        No compose content available
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Compose Lint Warnings */}
              {lintWarnings.length > 0 && (() => {
                const warnCount = lintWarnings.filter((w) => w.severity === 'warning').length
                const infoCount = lintWarnings.filter((w) => w.severity === 'info').length
                return (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 animate-fade-in">
                    <button
                      type="button"
                      onClick={() => setShowLintDetails((v) => !v)}
                      className="flex items-center gap-2 w-full text-left group"
                    >
                      <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                      <span className="text-xs font-semibold text-amber-300 flex-1">
                        Compose Lint
                      </span>
                      <span className="flex items-center gap-1.5">
                        {warnCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/20">
                            {warnCount} {warnCount === 1 ? 'warning' : 'warnings'}
                          </span>
                        )}
                        {infoCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-500/15 text-slate-400 border border-slate-500/20">
                            {infoCount} {infoCount === 1 ? 'suggestion' : 'suggestions'}
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        size={14}
                        className={`text-amber-500/50 transition-transform duration-200 ${showLintDetails ? '' : '-rotate-90'}`}
                      />
                    </button>
                    {showLintDetails && (
                      <div className="space-y-1 mt-2.5 pl-[22px]">
                        {lintWarnings.map((w) => (
                          <div key={`${w.service}-${w.message}`} className="flex items-start gap-2 text-[11px]">
                            <Circle
                              size={6}
                              className={`mt-1 shrink-0 ${w.severity === 'warning' ? 'text-amber-400 fill-amber-400' : 'text-slate-500 fill-slate-500'}`}
                            />
                            <span className={w.severity === 'warning' ? 'text-amber-200/80' : 'text-slate-400'}>
                              {w.service && <span className="font-mono text-slate-500">{w.service}: </span>}
                              {w.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Plugin Hooks Indicator */}
              {deployHookPlugins.length > 0 && (
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-violet-400 shrink-0" />
                    <p className="text-xs font-semibold text-violet-300">
                      {deployHookPlugins.length} {deployHookPlugins.length === 1 ? 'plugin' : 'plugins'} will run during deployment
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2 pl-[22px]">
                    {deployHookPlugins.map((p) => (
                      <span
                        key={p.name}
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/15"
                      >
                        {p.name}
                        <span className="text-violet-500 ml-1">
                          {(p.hooks ?? []).filter((h) => h === 'pre-deploy' || h === 'post-deploy').join(', ')}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* F5: Dry-run preview result */}
              {dryRunResult && (
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2.5 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Scan size={14} className="text-cyan-400 shrink-0" />
                    <p className="text-xs font-semibold text-cyan-300">Deployment Preview</p>
                  </div>
                  <div className="text-[11px] space-y-2.5 pl-[22px]">
                    {/* Services to add */}
                    <div className="flex flex-wrap gap-1">
                      <span className="text-slate-500">Services:</span>
                      {dryRunResult.services.map((svc) => (
                        <span key={svc} className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">{svc}</span>
                      ))}
                    </div>

                    {/* Service Conflicts */}
                    {dryRunResult.has_service_conflicts && (
                      <div className={`rounded-md p-2 ${replaceServices ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
                        <p className={`font-semibold text-[11px] ${replaceServices ? 'text-amber-400' : 'text-rose-400'}`}>
                          <AlertTriangle size={11} className="inline mr-1" />
                          {replaceServices ? 'Services Will Be Replaced' : 'Service Name Conflicts'}
                        </p>
                        <p className={`text-[10px] mt-0.5 font-mono ${replaceServices ? 'text-amber-300/80' : 'text-rose-300/80'}`}>{dryRunResult.service_conflicts}</p>
                        <label className="flex items-center gap-2 mt-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={replaceServices}
                            onChange={(e) => setReplaceServices(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-slate-800 text-amber-500 focus:ring-amber-500/30 cursor-pointer"
                          />
                          <span className="text-[10px] text-slate-400 group-hover:text-slate-300 transition-colors">
                            Replace existing services with template versions
                          </span>
                        </label>
                      </div>
                    )}

                    {/* Port Conflicts — detailed */}
                    {dryRunResult.has_port_conflicts && (
                      <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-2 space-y-1.5">
                        <p className="text-rose-400 font-semibold text-[11px]">
                          <AlertTriangle size={11} className="inline mr-1" />
                          Port Conflicts Detected
                        </p>
                        {dryRunResult.port_conflicts_detail && dryRunResult.port_conflicts_detail.length > 0 ? (
                          <div className="space-y-1">
                            {dryRunResult.port_conflicts_detail.map((pc) => (
                              <div key={`${pc.port}-${pc.owner}`} className="flex items-center gap-2 text-[10px] flex-wrap">
                                <span className="font-mono text-rose-300 font-bold">:{pc.port}</span>
                                <span className="text-rose-400/70">in use by</span>
                                <span className={`font-mono px-1.5 py-0.5 rounded ${pc.type === 'stack' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/15'}`}>
                                  {pc.owner}
                                </span>
                                <span className="text-rose-400/50 text-[9px]">
                                  ({pc.type})
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-rose-300/80 text-[10px] font-mono">{dryRunResult.port_conflicts}</p>
                        )}
                      </div>
                    )}

                    {/* No conflicts (or all resolved via replace) */}
                    {(!dryRunResult.has_service_conflicts || replaceServices) && !dryRunResult.has_port_conflicts && (
                      <p className="text-emerald-400/80">
                        <CheckCircle size={11} className="inline mr-1" />
                        {replaceServices && dryRunResult.has_service_conflicts
                          ? 'Service conflicts resolved — replacing existing services'
                          : 'No conflicts detected — safe to deploy'}
                      </p>
                    )}

                    {/* Env vars — new additions */}
                    {dryRunResult.env_additions.length > 0 && (
                      <div>
                        <span className="text-slate-500 font-semibold">New env vars to add:</span>
                        <div className="mt-1 space-y-0.5">
                          {dryRunResult.env_additions.map((e) => (
                            <div key={e.key} className="flex items-center gap-2 text-[10px]">
                              <span className="text-emerald-500 font-bold">+</span>
                              <code className="font-mono text-cyan-400">{e.key}</code>
                              <span className="text-slate-500">=</span>
                              <code className="font-mono text-slate-400 truncate">{e.value}</code>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Env vars — already existing */}
                    {dryRunResult.env_existing && dryRunResult.env_existing.length > 0 && (
                      <div>
                        <span className="text-amber-400/80 font-semibold">Env vars already set (will keep existing):</span>
                        <div className="mt-1 space-y-0.5">
                          {dryRunResult.env_existing.map((e) => (
                            <div key={e.key} className="flex items-center gap-2 text-[10px]">
                              <span className="text-amber-500 font-bold">~</span>
                              <code className="font-mono text-amber-400">{e.key}</code>
                              <span className="text-slate-500">=</span>
                              <code className="font-mono text-slate-500 truncate">{e.current_value}</code>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-slate-500">
                      +{dryRunResult.lines_added} lines of compose
                    </p>
                    {/* Compose snippet preview */}
                    {dryRunResult.compose_preview && (
                      <pre className="mt-1 bg-slate-950 rounded p-2 text-[10px] font-mono text-slate-500 overflow-x-auto max-h-[40vh] scrollbar-thin whitespace-pre-wrap break-all leading-relaxed">
                        {dryRunResult.compose_preview}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* Dry-run error */}
              {dryRunError && !dryRunResult && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 animate-fade-in">
                  <p className="text-[11px] text-rose-400">
                    <AlertTriangle size={11} className="inline mr-1" />
                    Preview failed: {dryRunError}
                  </p>
                </div>
              )}

              {/* F1: Confirmation panel */}
              {confirming && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                    <p className="text-xs font-semibold text-amber-300">Confirm Deployment</p>
                  </div>
                  <div className="text-[11px] text-slate-400 space-y-1 pl-[22px]">
                    <p>
                      Target: <span className="font-mono text-slate-300">{targetStack}</span>
                      {selectedStack && (
                        <span className={`ml-1.5 ${selectedStack.status === 'running' ? 'text-emerald-400' : 'text-slate-500'}`}>
                          ({selectedStack.status}{selectedStack.status === 'running' ? `, ${selectedStack.running_containers} containers` : ''})
                        </span>
                      )}
                    </p>
                    <p>
                      Services to {replaceServices ? 'deploy' : 'add'}: <span className="font-mono text-slate-300">{templateServiceNames.join(', ')}</span>
                    </p>
                    {replaceServices && dryRunResult?.has_service_conflicts && (
                      <p className="text-amber-400">
                        Replacing existing: <span className="font-mono">{dryRunResult.service_conflicts}</span>
                      </p>
                    )}
                    <p className="text-amber-400/70 mt-1">
                      This will modify the compose file of <span className="font-mono">{targetStack}</span>. A backup will be created.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-4 md:px-5 py-4 border-t border-white/5 shrink-0">
              <button
                onClick={() => { if (confirming) { setConfirming(false) } else { onClose() } }}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
              >
                {confirming ? 'Back' : 'Cancel'}
              </button>
              {!confirming && (
                <button
                  onClick={handleDryRun}
                  disabled={!targetStack || dryRunLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed press"
                >
                  {dryRunLoading ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                  Preview
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleDeployClick}
                  disabled={!canDeploy || (autoStart && missingSecrets.length > 0) || badSecretNames.length > 0 || Object.keys(containerNameIssues.blocking).length > 0}
                  title={autoStart && missingSecrets.length > 0 ? `Store ${missingSecrets.join(', ')} first, or turn auto-start off` : badSecretNames.length > 0 ? 'Fix the secret names first' : Object.keys(containerNameIssues.blocking).length > 0 ? 'Fix the container names first' : undefined}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed press ${
                    confirming
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/25'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25'
                  }`}
                >
                  {deploying ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : confirming ? (
                    <AlertTriangle size={13} />
                  ) : (
                    <Rocket size={13} />
                  )}
                  {confirming ? 'Confirm & Deploy' : 'Deploy Stack'}
                </button>
              )}
            </div>
          </>
        )}
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
  stacks: StackInfo[]
  onClose: () => void
  onSave: (data: { name: string; compose: string; env: string; metadata: Record<string, unknown> }) => void | boolean | Promise<void | boolean>
  saving: boolean
}

function CreateEditModal({ mode, initial, stacks, onClose, onSave, saving }: CreateEditModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [title, setTitle] = useState((initial?.metadata?.title as string) ?? '')
  const [description, setDescription] = useState((initial?.metadata?.description as string) ?? '')
  const [category, setCategory] = useState((initial?.metadata?.category as string) ?? 'other')
  const [targetStack, setTargetStack] = useState((initial?.metadata?.target_stack as string) ?? '')
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
  const [saved, setSaved] = useState(false)
  // Baseline for change detection: reset after a successful save so the editor can stay open
  const [baseline, setBaseline] = useState({
    compose: initial?.compose ?? '',
    env: initial?.env ?? '',
    title: (initial?.metadata?.title as string) ?? '',
    description: (initial?.metadata?.description as string) ?? '',
    category: (initial?.metadata?.category as string) ?? 'other',
    targetStack: (initial?.metadata?.target_stack as string) ?? '',
  })
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null)
  const [validating, setValidating] = useState(false)
  const lint = useComposeLinter(compose, env)
  const envLint = useEnvLinter(env, compose)

  const canSave = name.trim().length > 0 && compose.trim().length > 0 && !saving

  // Detect changes against the last saved baseline (edit mode)
  const hasChanges = mode === 'edit' ? (
    compose !== baseline.compose ||
    env !== baseline.env ||
    title !== baseline.title ||
    description !== baseline.description ||
    category !== baseline.category ||
    targetStack !== baseline.targetStack
  ) : canSave

  const handleSaveInPlace = useCallback(async () => {
    if (!canSave) return
    // Keep the template's own variables and tags: an edit must not wipe them
    const ok = await onSave({
      name, compose, env,
      metadata: {
        ...(initial?.metadata ?? {}),
        title: title || name, description, category, target_stack: targetStack || undefined,
        tags: (initial?.metadata?.tags as unknown[]) ?? [],
        variables: (initial?.metadata?.variables as unknown[]) ?? [],
      },
    })
    if (ok !== false) {
      setBaseline({ compose, env, title, description, category, targetStack })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }, [canSave, name, compose, env, title, description, category, targetStack, initial, onSave])

  const handleDiscard = useCallback(() => {
    setCompose(baseline.compose)
    setEnv(baseline.env)
    setTitle(baseline.title)
    setDescription(baseline.description)
    setCategory(baseline.category)
    setTargetStack(baseline.targetStack)
  }, [baseline])

  const handleValidate = useCallback(async () => {
    setValidating(true)
    try {
      const res = await validateCompose({ content: compose })
      setValidation({ valid: !!res.valid, errors: res.errors ?? [], warnings: res.warnings ?? [] })
    } catch (err) {
      setValidation({ valid: false, errors: [err instanceof Error ? err.message : 'Validation failed'], warnings: [] })
    } finally {
      setValidating(false)
    }
  }, [compose])

  // Ctrl/Cmd+S saves, Esc closes (asks first when there are unsaved changes)
  const requestClose = useCallback(() => {
    if (hasChanges && mode === 'edit' && !window.confirm('Discard unsaved changes to this template?')) return
    onClose()
  }, [hasChanges, mode, onClose])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); handleSaveInPlace() }
      else if (e.key === 'Escape') { e.preventDefault(); requestClose() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSaveInPlace, requestClose])

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <FloatingSaveBar
        hasChanges={mode === 'edit' && hasChanges}
        saving={saving}
        onSave={handleSaveInPlace}
        onDiscard={handleDiscard}
        message={`Unsaved changes to template ${name || 'untitled'}`}
        zIndex={10000}
      />
      <div className="absolute inset-0" onClick={requestClose} />
      <div className="relative w-full max-w-[95vw] xl:max-w-[1400px] mx-3 md:mx-4 max-h-[95vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/40 flex flex-col animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${mode === 'create' ? 'bg-emerald-500/15 border-emerald-500/20' : 'bg-cyan-500/15 border-cyan-500/20'} border flex items-center justify-center shrink-0`}>
              {mode === 'create' ? <Plus size={16} className="text-emerald-400" /> : <Pencil size={16} className="text-cyan-400" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{mode === 'create' ? 'Create Template' : `Edit: ${initial?.name}`}</h3>
              <p className="text-[10px] text-slate-500">Define a reusable stack template</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Name + metadata row */}
          <div className="px-4 md:px-5 py-4 space-y-3 border-b border-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Template Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                  placeholder="my-template"
                  disabled={mode === 'edit'}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 transition-colors disabled:opacity-50 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Display Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Template"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
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
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => {
                    const cat = e.target.value
                    setCategory(cat)
                    const suggested = CATEGORY_TO_STACK[cat]
                    if (suggested) setTargetStack(suggested)
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/30 transition-colors"
                >
                  <option value="databases">Databases</option>
                  <option value="media">Media</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="web">Web</option>
                  <option value="development">Development</option>
                  <option value="storage">Storage</option>
                  <option value="automation">Automation</option>
                  <option value="utilities">Utilities</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Default Target Stack</label>
              <select
                value={targetStack}
                onChange={(e) => setTargetStack(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/30 transition-colors"
              >
                <option value="">None (user selects at deploy time)</option>
                {stacks.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">Stack where this template's services will be merged when deployed</p>
            </div>
          </div>

          {/* Editor tabs */}
          <div className="flex items-center gap-0.5 px-4 md:px-5 pt-3 pb-0">
            {(['compose', 'env', 'meta'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-t-lg text-[11px] font-medium transition-colors ${activeTab === tab ? 'bg-white/[0.06] text-slate-200 border border-white/10 border-b-transparent' : 'text-slate-500 hover:text-slate-400'}`}
              >
                {tab === 'compose' ? 'docker-compose.yml' : tab === 'env' ? '.env' : 'Variables'}
              </button>
            ))}
          </div>

          <div className="px-4 md:px-5 pb-4">
            {activeTab === 'compose' && (
              <>
              <textarea
                value={compose}
                onChange={(e) => { setCompose(e.target.value); setValidation(null) }}
                spellCheck={false}
                className="w-full h-[58vh] min-h-[320px] px-4 py-3 rounded-lg bg-slate-950/60 border border-white/5 text-xs text-slate-300 font-mono leading-relaxed focus:outline-none focus:border-emerald-500/20 resize-none scrollbar-thin"
                placeholder="services:&#10;  app:&#10;    image: example:latest"
              />
              {/* Live diagnostics from the compose linter (same rules as the stack editor) */}
              <div className="mt-2 rounded-lg bg-slate-950/40 border border-white/5 px-3 py-2 text-[11px]">
                <div className="flex items-center gap-3 text-slate-500">
                  <span className={lint.counts.errors ? 'text-rose-400' : ''}>{lint.counts.errors} error{lint.counts.errors === 1 ? '' : 's'}</span>
                  <span className={lint.counts.warnings ? 'text-amber-400' : ''}>{lint.counts.warnings} warning{lint.counts.warnings === 1 ? '' : 's'}</span>
                  <span>{lint.counts.info} hint{lint.counts.info === 1 ? '' : 's'}</span>
                  {validation && (
                    <span className={validation.valid ? 'text-emerald-400' : 'text-rose-400'}>· compose config: {validation.valid ? 'valid' : 'invalid'}</span>
                  )}
                  <span className="ml-auto text-slate-600">Ctrl+S saves · Esc closes</span>
                </div>
                {(lint.diagnostics.length > 0 || (validation && !validation.valid)) && (
                  <ul className="mt-1.5 space-y-0.5 max-h-28 overflow-y-auto scrollbar-thin">
                    {validation?.errors.map((e, i) => <li key={`v${i}`} className="text-rose-300">{e}</li>)}
                    {lint.diagnostics.slice(0, 40).map((d, i) => (
                      <li key={i} className={d.severity === 'error' ? 'text-rose-300' : d.severity === 'warning' ? 'text-amber-300' : 'text-slate-400'}>
                        {d.line ? `L${d.line} · ` : ''}{d.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              </>
            )}
            {activeTab === 'env' && (
              <textarea
                value={env}
                onChange={(e) => setEnv(e.target.value)}
                spellCheck={false}
                className="w-full h-[58vh] min-h-[320px] px-4 py-3 rounded-lg bg-slate-950/60 border border-white/5 text-xs text-slate-300 font-mono leading-relaxed focus:outline-none focus:border-emerald-500/20 resize-none scrollbar-thin"
                placeholder="# Environment variables for this template"
              />
            )}
            {activeTab === 'meta' && (() => {
              const parsedVars = parseComposeVariables(compose)
              return (
                <div className="rounded-lg bg-slate-950/60 border border-white/5 p-4 space-y-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Detected Variables ({parsedVars.length})
                  </p>
                  {parsedVars.length === 0 ? (
                    <div className="text-xs text-slate-500 py-4 text-center">
                      <p>No custom variables detected in compose file.</p>
                      <p className="mt-1">Use <code className="text-slate-400 bg-white/5 px-1 py-0.5 rounded">${'${VAR_NAME:-default}'}</code> placeholders to add them.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {parsedVars.map((v) => {
                        const isBool = v.defaultValue === 'true' || v.defaultValue === 'false'
                        return (
                          <div key={v.name} className="flex items-center gap-3 py-1.5 px-2 rounded bg-white/[0.03]">
                            <code className="text-[11px] font-mono text-emerald-400 min-w-[140px]">{v.name}</code>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${isBool ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/15' : 'bg-slate-500/10 text-slate-500 border border-slate-500/15'}`}>
                              {isBool ? 'toggle' : 'text'}
                            </span>
                            <span className="text-[10px] text-slate-500">default:</span>
                            <code className="text-[11px] font-mono text-slate-400 flex-1 truncate">
                              {v.defaultValue || <span className="text-slate-500 italic">none</span>}
                            </code>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 mt-2">
                    Standard variables (<code className="text-slate-500">TZ</code>, <code className="text-slate-500">PUID</code>, <code className="text-slate-500">PGID</code>, <code className="text-slate-500">APP_DATA_DIR</code>) are inherited from root .env and excluded above.
                  </p>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 md:px-5 py-3 border-t border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-xs text-emerald-400 animate-fade-in flex items-center gap-1">
                <CheckCircle size={12} /> Saved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {envLint.diagnostics.length > 0 && activeTab === 'env' && (
              <span className="text-[10px] text-amber-400 mr-1">{envLint.diagnostics.length} .env hint{envLint.diagnostics.length === 1 ? '' : 's'}</span>
            )}
            <button
              onClick={handleValidate}
              disabled={validating || !compose.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300 bg-white/5 border border-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
              title="Run docker compose config on the server"
            >
              {validating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Validate
            </button>
            <button onClick={requestClose} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors">
              {mode === 'edit' ? 'Close' : 'Cancel'}
            </button>
            {mode === 'edit' && (
              <button
                onClick={handleSaveInPlace}
                disabled={!canSave || !hasChanges}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save
              </button>
            )}
            {mode === 'create' && (
              <button
                onClick={handleSaveInPlace}
                disabled={!canSave}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed press"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Create Template
              </button>
            )}
          </div>
        </div>

        {/* Floating save bar for edit mode — fixed to viewport bottom, outside modal */}
        {mode === 'edit' && hasChanges && createPortal(
          <div className="fixed bottom-6 inset-x-0 z-[10000] flex justify-center pointer-events-none animate-fade-in-up">
            <div className="flex items-center gap-3 rounded-xl bg-slate-800/95 backdrop-blur-lg border border-white/10 px-5 py-3 shadow-2xl shadow-black/40 pointer-events-auto">
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm text-slate-300">Unsaved changes</span>
              <button onClick={handleDiscard} className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1">
                Discard
              </button>
              <button
                onClick={handleSaveInPlace}
                disabled={saving}
                className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving && <Loader2 size={12} className="animate-spin" />}
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>,
          document.body,
        )}
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// URL Import Modal
// ---------------------------------------------------------------------------

function UrlImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { addToast } = useToast()
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [nameManual, setNameManual] = useState(false)
  const [importing, setImporting] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [compose, setCompose] = useState('')
  const [fetchedUrl, setFetchedUrl] = useState('')
  const [activeTab, setActiveTab] = useState<'compose' | 'env'>('compose')

  // Detected env variables from compose content
  const detectedVars = useMemo(() => {
    if (!compose) return []
    return parseComposeVariables(compose)
  }, [compose])

  // Auto-detect name from URL
  useEffect(() => {
    if (!url || nameManual) return
    try {
      const urlObj = new URL(url)
      const parts = urlObj.pathname.split('/').filter(Boolean)
      const yamlIndex = parts.findIndex(p => /\.(ya?ml)$/i.test(p))
      const suggested = yamlIndex > 0 ? parts[yamlIndex - 1] : parts[parts.length - 1]?.replace(/\.(ya?ml)$/i, '') || ''
      if (suggested && suggested !== 'blob' && suggested !== 'master' && suggested !== 'main' && suggested !== 'refs' && suggested !== 'heads') {
        setName(suggested.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, ''))
      }
    } catch { /* ignore */ }
  }, [url, nameManual])

  // Fetch compose content from URL
  const handleFetch = async () => {
    if (!url) return
    setFetching(true)
    try {
      const res = await fetchTemplateUrl(url)
      setCompose(res.content)
      setFetchedUrl(res.url)
      setActiveTab('compose')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast({ type: 'error', message: `Failed to fetch: ${msg}`, duration: 6000 })
    } finally {
      setFetching(false)
    }
  }

  // Import with the (possibly edited) compose content
  const handleImport = async () => {
    if (!compose) return
    setImporting(true)
    try {
      const safeName = (name || 'imported-template').toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 64)
      const res = await importTemplate({
        name: safeName,
        compose,
        metadata: {
          description: `Imported from ${fetchedUrl || url}`,
          category: 'other',
          tags: ['imported', 'url'],
          source_url: fetchedUrl || url,
        },
      })
      if (res.success) {
        addToast({ type: 'success', message: `Template "${res.name}" imported successfully` })
        onSuccess()
        onClose()
      } else {
        addToast({ type: 'error', message: res.message || 'Import failed' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast({ type: 'error', message: `Import failed: ${msg}`, duration: 6000 })
    } finally {
      setImporting(false)
    }
  }

  const isGitHub = url.includes('github.com') || url.includes('raw.githubusercontent.com')
  const hasFetched = compose.length > 0

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-3xl mx-3 md:mx-4 max-h-[90vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/40 flex flex-col animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
              <Link size={16} className="text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Import from URL</h3>
              <p className="text-[10px] text-slate-500">
                {hasFetched ? 'Review and edit before importing' : 'Paste a link to any docker-compose YAML file'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin">
          {/* URL + Name row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-1.5">
                Compose File URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); if (compose) { setCompose(''); setFetchedUrl('') } }}
                  placeholder="https://github.com/user/repo/blob/main/compose.yaml"
                  className="flex-1 px-3 py-2.5 rounded-lg bg-slate-950/60 border border-white/5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                  autoFocus
                />
                <button
                  onClick={handleFetch}
                  disabled={!url || fetching}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed press shrink-0"
                >
                  {fetching ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                  {fetching ? 'Fetching...' : 'Preview'}
                </button>
              </div>
              {isGitHub && !hasFetched && (
                <p className="text-[10px] text-emerald-500/70 mt-1 flex items-center gap-1">
                  <CheckCircle size={10} />
                  GitHub URL detected — will auto-convert to raw content
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-1.5">
                Template Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setNameManual(true) }}
                placeholder="auto-detected"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-950/60 border border-white/5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
              />
            </div>
          </div>

          {/* Preview / Edit area — only shows after fetch */}
          {hasFetched && (
            <>
              {/* Tab bar */}
              <div className="flex items-center gap-1 border-b border-white/5 -mb-1">
                <button
                  onClick={() => setActiveTab('compose')}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === 'compose'
                      ? 'text-violet-400 border-violet-400'
                      : 'text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                >
                  Compose YAML
                </button>
                <button
                  onClick={() => setActiveTab('env')}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'env'
                      ? 'text-violet-400 border-violet-400'
                      : 'text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                >
                  Variables
                  {detectedVars.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[9px] font-bold bg-violet-500/20 text-violet-400">
                      {detectedVars.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Compose editor */}
              {activeTab === 'compose' && (
                <div className="relative">
                  <textarea
                    value={compose}
                    onChange={(e) => setCompose(e.target.value)}
                    spellCheck={false}
                    className="w-full h-64 px-4 py-3 rounded-lg bg-slate-950/60 border border-white/5 text-xs text-slate-300 font-mono leading-relaxed focus:outline-none focus:border-violet-500/20 resize-none scrollbar-thin"
                    placeholder={'services:\n  app:\n    image: example:latest'}
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <span className="text-[9px] text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded">
                      {compose.split('\n').length} lines
                    </span>
                    {fetchedUrl && (
                      <span className="text-[9px] text-emerald-500/60 bg-slate-800/80 px-1.5 py-0.5 rounded">
                        editable
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Variables panel */}
              {activeTab === 'env' && (
                <div className="rounded-lg bg-slate-950/60 border border-white/5 p-4 space-y-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Detected Variables ({detectedVars.length})
                  </p>
                  {detectedVars.length === 0 ? (
                    <div className="text-xs text-slate-500 py-6 text-center">
                      <p>No custom variables detected in this compose file.</p>
                      <p className="mt-1 text-[10px]">
                        Standard variables (<code className="text-slate-500">TZ</code>, <code className="text-slate-500">PUID</code>, <code className="text-slate-500">PGID</code>, <code className="text-slate-500">APP_DATA_DIR</code>) are inherited from root .env and excluded.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {detectedVars.map((v) => {
                        const isBool = v.defaultValue === 'true' || v.defaultValue === 'false'
                        return (
                          <div key={v.name} className="flex items-center gap-3 py-1.5 px-2 rounded bg-white/[0.03]">
                            <code className="text-[11px] font-mono text-violet-400 min-w-[140px]">{v.name}</code>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${isBool ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/15' : 'bg-slate-500/10 text-slate-500 border border-slate-500/15'}`}>
                              {isBool ? 'toggle' : 'text'}
                            </span>
                            <span className="text-[10px] text-slate-500 shrink-0">default:</span>
                            <code className="text-[11px] font-mono text-slate-400 flex-1 truncate">
                              {v.defaultValue || <span className="text-slate-500 italic">none</span>}
                            </code>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 mt-2">
                    These variables will be configurable when deploying this template. Values shown above are defaults from the compose file.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Supported sources hint — only when no preview */}
          {!hasFetched && (
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.03] p-3">
              <p className="text-[10px] text-slate-500 font-semibold mb-1.5">Supported Sources</p>
              <div className="space-y-1 text-[10px] text-slate-500">
                <p>• GitHub blob or raw URLs (auto-converted)</p>
                <p>• GitLab raw file URLs</p>
                <p>• Any direct link to a docker-compose YAML file</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/5 shrink-0">
          <div className="text-[10px] text-slate-500">
            {hasFetched && fetchedUrl && (
              <span className="flex items-center gap-1">
                <ExternalLink size={10} />
                <span className="font-mono truncate max-w-[300px]">{fetchedUrl}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!compose || importing || !name}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-violet-500/15 text-violet-400 border border-violet-500/20 hover:bg-violet-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed press"
            >
              {importing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Import Template
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Gallery View
// ---------------------------------------------------------------------------

function GalleryView({ onImport, isAdmin = true }: { onImport: (url: string, name: string) => Promise<void>; isAdmin?: boolean }) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const [gallery, setGallery] = useState<GalleryTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [importing, setImporting] = useState<string | null>(null)

  useEffect(() => {
    if (!isConnected) return
    setLoading(true)
    fetchTemplateGallery()
      .then((res) => setGallery(res.templates))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isConnected])

  const categories = useMemo(() => {
    const cats = new Set(gallery.map((t) => t.category))
    return ['all', ...Array.from(cats).sort()]
  }, [gallery])

  const filtered = useMemo(() => {
    return gallery.filter((t) => {
      if (category !== 'all' && t.category !== category) return false
      if (search) {
        const q = search.toLowerCase()
        return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      }
      return true
    })
  }, [gallery, category, search])

  const handleImport = async (t: GalleryTemplate) => {
    setImporting(t.name)
    try {
      await onImport(t.url, t.name)
    } finally {
      setImporting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-slate-500" />
      </div>
    )
  }

  if (gallery.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Store size={24} className="text-slate-500" />
        <p className="text-sm text-slate-500">No gallery templates available</p>
        <p className="text-xs text-slate-500">Add templates to .config/template-gallery.json</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap shrink-0 transition-all duration-150 capitalize ${
                category === cat
                  ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                  : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-0 md:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search gallery..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Gallery grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 stagger-children">
        {filtered.map((t) => {
          const colors = getCategoryColors(t.category)
          const CatIcon = getCategoryIcon(t.category)
          const isImporting = importing === t.name

          return (
            <div
              key={t.name}
              className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 flex flex-col gap-2.5 hover:border-white/10 hover:bg-white/[0.03] transition-all duration-200 group"
            >
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${colors.badge}`}>
                  <CatIcon size={9} />
                  {t.category}
                </span>
                {t.services.length > 0 && (
                  <span className="text-[9px] text-slate-500">{t.services.length} service{t.services.length > 1 ? 's' : ''}</span>
                )}
              </div>
              <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{t.name}</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 flex-1">{t.description}</p>
              {t.services.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {t.services.slice(0, 4).map((svc) => (
                    <span key={svc} className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-slate-500">{svc}</span>
                  ))}
                </div>
              )}
              {isAdmin && (
                <button
                  onClick={() => handleImport(t)}
                  disabled={isImporting}
                  className="mt-auto flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-xs font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/15 hover:bg-violet-500/20 hover:border-violet-500/30 transition-all duration-200 disabled:opacity-50 press"
                >
                  {isImporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  {isImporting ? 'Importing...' : 'Import'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-slate-500">No templates match your search</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Template Card
// ---------------------------------------------------------------------------

type DeployStatus = { state: 'running' | 'deployed' | 'none'; targetStack?: string }

interface TemplateCardProps {
  template: TemplateInfo
  onDeploy: (template: TemplateInfo) => void
  onEdit: (template: TemplateInfo) => void
  onDelete: (template: TemplateInfo) => void
  onExport: (template: TemplateInfo) => void
  deployStatus?: DeployStatus
}

function TemplateCard({ template, onDeploy, onEdit, onDelete, onExport, deployStatus }: TemplateCardProps) {
  const CatIcon = getCategoryIcon(template.category)
  const colors = getCategoryColors(template.category)

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 md:p-5 flex flex-col gap-2.5 hover:border-white/10 hover:bg-white/[0.03] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 group">
      {/* Top row: category badge + deploy status + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors.badge}`}
          >
            <CatIcon size={10} />
            {template.category}
          </span>
          {deployStatus && deployStatus.state !== 'none' && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${
              deployStatus.state === 'running'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                : 'bg-slate-500/10 text-slate-400 border-slate-500/15'
            }`}>
              <Circle size={6} className={deployStatus.state === 'running' ? 'fill-emerald-400 text-emerald-400 animate-pulse' : 'fill-slate-500 text-slate-500'} />
              {deployStatus.state === 'running' ? 'Running' : 'Deployed'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={(e) => { e.stopPropagation(); onExport(template) }}
            className="p-1 rounded text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            title="Export template"
          >
            <Download size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(template) }}
            className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            title="Edit template"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(template) }}
            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
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

      {/* F6: Deployed-to indicator */}
      {deployStatus && deployStatus.state !== 'none' && deployStatus.targetStack && (
        <p className="text-[10px] text-slate-500">
          Deployed to: <span className="font-mono text-slate-500">{deployStatus.targetStack}</span>
        </p>
      )}

      {/* Tags */}
      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {template.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/5 text-slate-500 border border-white/[0.03]"
            >
              {tag}
            </span>
          ))}
          {template.tags.length > 5 && (
            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium text-slate-500">
              +{template.tags.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Deploy button */}
      {template.singleton && deployStatus && deployStatus.state !== 'none' ? (
        <div className="mt-auto flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-lg text-[11px] font-semibold bg-emerald-500/[0.06] text-emerald-500/60 border border-emerald-500/10 cursor-default select-none">
          <CheckCircle size={11} />
          Deployed
        </div>
      ) : deployStatus && deployStatus.state === 'running' ? (
        <button
          onClick={() => onDeploy(template)}
          className="mt-auto flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-lg text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 hover:bg-cyan-500/20 hover:border-cyan-500/25 transition-all duration-200 press"
        >
          <Rocket size={11} />
          Redeploy
        </button>
      ) : (
        <button
          onClick={() => onDeploy(template)}
          className="mt-auto flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all duration-200 press"
        >
          <Play size={11} />
          Deploy
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Templates Page
// ---------------------------------------------------------------------------

export default function Templates() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const userRole = useAuthStore((s) => s.userRole)
  const isAdmin = userRole === 'admin'
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

  // URL import modal state
  const [showUrlImport, setShowUrlImport] = useState(false)
  // Gallery/My Templates tab
  const [activeTab, setActiveTab] = useState<'templates' | 'gallery'>('templates')

  // F3: Deploy history state
  const [showHistory, setShowHistory] = useState(false)
  const [historyData, setHistoryData] = useState<DeployHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Close topmost modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showHistory) { setShowHistory(false); return }
      if (deployTarget) { setDeployTarget(null); return }
      if (detail) { setDetail(null); return }
      if (showUrlImport) { setShowUrlImport(false); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showHistory, deployTarget, detail, showUrlImport])

  // F6: Container list for deploy status
  const [containerList, setContainerList] = useState<ContainerInfo[]>([])

  // Polling
  const { data, loading, error, refresh } = usePolling<TemplateListResponse>(
    fetchTemplates,
    30000,
    { enabled: isConnected },
  )

  // Fetch available stacks for the deploy/edit dropdowns
  const [availableStacks, setAvailableStacks] = useState<StackInfo[]>([])
  useEffect(() => {
    if (!isConnected) return
    fetchStacks().then((res) => setAvailableStacks(res.stacks)).catch(() => {})
  }, [isConnected])

  // F3: Fetch deploy history + F6: containers
  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const [histRes, ctrRes] = await Promise.all([
        fetchDeployHistory().catch(() => ({ history: [], total: 0 } as DeployHistoryResponse)),
        fetchContainers().catch(() => ({ containers: [], total: 0 })),
      ])
      setHistoryData(histRes.history)
      setContainerList(ctrRes.containers)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isConnected) return
    refreshHistory()
  }, [isConnected, refreshHistory])

  // F6: Build deploy status map
  const deployStatusMap = useMemo(() => {
    const map: Record<string, DeployStatus> = {}
    const runningNames = new Set(containerList.filter((c) => c.state === 'running').map((c) => c.name))
    const allNames = new Set(containerList.map((c) => c.name))

    // Walk history newest first — find active deploys (deploy without matching undeploy)
    const undeployed = new Set<string>()
    for (const entry of historyData) {
      const key = `${entry.template}__${entry.target_stack}`
      if (entry.action === 'undeploy') {
        undeployed.add(key)
      } else if (entry.action === 'deploy' && !undeployed.has(key)) {
        // This is an active deploy
        if (!map[entry.template]) {
          // Check if any of the services are running
          const hasRunning = entry.services.some((svc) => {
            for (const cname of runningNames) {
              if (cname.includes(svc)) return true
            }
            return false
          })
          const hasContainer = entry.services.some((svc) => {
            for (const cname of allNames) {
              if (cname.includes(svc)) return true
            }
            return false
          })
          map[entry.template] = {
            state: hasRunning ? 'running' : hasContainer ? 'deployed' : 'deployed',
            targetStack: entry.target_stack,
          }
        }
      }
    }
    return map
  }, [historyData, containerList])

  // Deduplicate consecutive history entries (same action/template/stack within 5s)
  const deduplicatedHistory = useMemo(() => {
    const result: typeof historyData = []
    for (const entry of historyData) {
      const prev = result[result.length - 1]
      if (prev && prev.action === entry.action && prev.template === entry.template
          && prev.target_stack === entry.target_stack
          && Math.abs(new Date(prev.timestamp).getTime() - new Date(entry.timestamp).getTime()) < 5000) {
        continue
      }
      result.push(entry)
    }
    return result
  }, [historyData])

  // For each deploy entry, check if the MOST RECENT action for that template+stack is an undeploy.
  // History is newest-first. Walk through and record the latest action per template+stack.
  const latestActionMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of historyData) {
      const key = `${entry.template}__${entry.target_stack}`
      if (!map.has(key)) {
        map.set(key, entry.action) // First occurrence = most recent
      }
    }
    return map
  }, [historyData])

  const templates = data?.templates ?? []

  // Filtered list
  const filtered = useMemo(() => {
    return templates.filter(
      (t) => matchesCategory(t, activeCategory) && matchesSearch(t, search),
    )
  }, [templates, activeCategory, search])

  // Group templates by resolved category for the "All" view
  const grouped = useMemo(() => {
    if (activeCategory !== 'all') return null
    const groups = new Map<string, { def: CategoryDef; templates: TemplateInfo[] }>()
    // Initialize groups in CATEGORIES order (excluding 'all')
    for (const cat of CATEGORIES) {
      if (cat.id === 'all') continue
      groups.set(cat.id, { def: cat, templates: [] })
    }
    for (const t of filtered) {
      const resolved = resolveCategory(t.category)
      const group = groups.get(resolved.id)
      if (group) group.templates.push(t)
    }
    // Return only non-empty groups, in order
    return Array.from(groups.values()).filter((g) => g.templates.length > 0)
  }, [filtered, activeCategory])

  // Open deploy modal
  const handleOpenDeploy = useCallback(async (template: TemplateInfo) => {
    setDeployTarget(template)
    setDetail(null)
    setDetailLoading(true)
    try {
      const [res, stacksRes] = await Promise.all([
        fetchTemplateDetail(template.name),
        fetchStacks().catch(() => null),
      ])
      setDetail(res)
      if (stacksRes) setAvailableStacks(stacksRes.stacks)
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

  // Execute deployment — returns result on success for the modal's success state (F4)
  const handleDeploy = useCallback(
    async (targetStack: string, variables: Record<string, string>, autoStart: boolean, replaceServices?: boolean, excludeServices?: string[], customRoutes?: Record<string, string>, connectProxy?: boolean, resourceLimits?: { mem_limit?: string; cpus?: number }, addToHomarr?: boolean, containerNames?: Record<string, string>): Promise<TemplateDeployResponse | null> => {
      if (!deployTarget) return null
      setDeploying(true)
      try {
        // Auto-approve privileged mode for built-in templates (user sees linter warning before deploying)
        const needsPrivileged = detail?.compose ? /privileged\s*:\s*true/.test(detail.compose) : false
        const res = await deployTemplate(deployTarget.name, {
          target_stack: targetStack,
          variables,
          auto_start: autoStart,
          replace_services: true,
          exclude_services: excludeServices,
          custom_routes: customRoutes,
          connect_proxy: connectProxy,
          resource_limits: resourceLimits,
          add_to_homarr: addToHomarr,
          allow_privileged: needsPrivileged,
          container_names: containerNames,
        })
        if (res.success) {
          refresh()
          refreshHistory()
          return res
        } else {
          addToast({ type: 'error', message: res.message || 'Deployment failed', duration: 6000 })
          return null
        }
      } catch (err) {
        // F3: Conflict-aware error handling with structured toast messages
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('409') || message.toLowerCase().includes('conflict')) {
          addToast({
            type: 'warning',
            message: message.toLowerCase().includes('port')
              ? `Port conflict — a host port is already in use. Change the port variable or choose a different target stack.`
              : `Service name conflict — these services are already deployed in "${targetStack}". Enable "Replace existing services" in Preview, or choose a different stack.`,
            duration: 8000,
          })
        } else if (message.includes('422') || message.toLowerCase().includes('invalid compose')) {
          addToast({
            type: 'error',
            message: 'Merge failed validation and was rolled back. Check template compose syntax.',
            duration: 8000,
          })
        } else if (message.includes('403')) {
          addToast({
            type: 'error',
            message: 'Admin access required to deploy templates.',
            duration: 6000,
          })
        } else {
          addToast({ type: 'error', message: `Deploy failed: ${message}`, duration: 6000 })
        }
        return null
      } finally {
        setDeploying(false)
      }
    },
    [deployTarget, detail, addToast, refresh, refreshHistory],
  )

  // F4: Undeploy handler
  const handleUndeploy = useCallback(async (templateName: string, targetStack: string, services: string[]): Promise<boolean> => {
    try {
      const res = await undeployTemplate(templateName, {
        target_stack: targetStack,
        services,
        remove_containers: true,
        remove_data: true,
      })
      if (res.success) {
        const parts = [
          res.stack_deleted
            ? `Removed all services from ${targetStack}`
            : `Undeployed ${res.services_removed.length} service(s) from ${targetStack}`,
        ]
        if (res.data_removed) parts.push('configuration data cleaned up')
        addToast({ type: 'success', message: parts.join(' — ') })
        refresh()
        refreshHistory()
        return true
      } else {
        addToast({ type: 'error', message: res.message || 'Undeploy failed', duration: 6000 })
        return false
      }
    } catch (err) {
      addToast({ type: 'error', message: `Undeploy failed: ${err instanceof Error ? err.message : String(err)}`, duration: 6000 })
      return false
    }
  }, [addToast, refresh, refreshHistory])

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
        metadata: { title: template.title || template.name, description: template.description, category: template.category, target_stack: template.target_stack || '', tags: template.tags, variables: template.variables || [] },
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
          addToast({ type: 'success', message: `Template "${data.name}" saved` })
          refresh()   // the editor stays open; keep editing or close with Esc
          return true
        }
        addToast({ type: 'error', message: res.message || 'Failed to update template' })
        return false
      }
      return true
    } catch (err) {
      addToast({ type: 'error', message: `Save failed: ${err instanceof Error ? err.message : String(err)}` })
      return false
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
        metadata: { title: template.title || template.name, description: template.description, category: template.category, target_stack: template.target_stack || '', tags: template.tags, variables: template.variables || [] },
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

  // Import from gallery
  const handleGalleryImport = useCallback(async (url: string, name: string) => {
    try {
      const res = await importTemplateFromUrl(url, name)
      if (res.success) {
        addToast({ type: 'success', message: `Template "${res.name}" imported from gallery` })
        refresh()
      } else {
        addToast({ type: 'error', message: res.message || 'Import failed' })
      }
    } catch (err) {
      addToast({ type: 'error', message: `Import failed: ${err instanceof Error ? err.message : String(err)}` })
    }
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
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center">
          <Package size={24} className="text-slate-500" />
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
      <DisconnectedBanner />
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Rocket size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight"><span className="text-gradient">Stack Templates</span></h2>
            <p className="text-xs text-slate-500">
              {templates.length} template{templates.length !== 1 ? 's' : ''} available
              {filtered.length !== templates.length && ` (${filtered.length} shown)`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Tab switcher */}
          <div className="flex items-center rounded-lg border border-white/5 overflow-hidden mr-1">
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'templates'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              My Templates
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'gallery'
                  ? 'bg-violet-500/15 text-violet-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              <Store size={12} />
              Gallery
            </button>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 hover:border-emerald-500/30 transition-all duration-200 press"
          >
            <Plus size={13} />
            Create
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowUrlImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all duration-200 press"
              title="Import template from URL"
            >
              <Link size={13} />
              URL Import
            </button>
          )}
          {isAdmin && (
            <button
              onClick={handleImportTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 transition-all duration-200 press"
              title="Import template from JSON file"
            >
              <Upload size={13} />
              File
            </button>
          )}
          <button
            onClick={() => { setShowHistory((prev) => !prev); if (!showHistory) refreshHistory() }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 press ${
              showHistory
                ? 'bg-violet-500/15 text-violet-400 border-violet-500/25 hover:bg-violet-500/25'
                : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
            }`}
          >
            <History size={13} />
            History
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 transition-all duration-200 disabled:opacity-50 press"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* F3: Deploy History Panel */}
      {showHistory && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History size={14} className="text-violet-400" />
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Deploy History</h3>
              <span className="text-[10px] text-slate-500">{deduplicatedHistory.length} events</span>
            </div>
            <button onClick={() => setShowHistory(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X size={14} />
            </button>
          </div>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin text-slate-500" />
            </div>
          ) : deduplicatedHistory.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No deployment history yet</p>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-2 px-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Time</th>
                    <th className="text-left py-2 px-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Action</th>
                    <th className="text-left py-2 px-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Template</th>
                    <th className="text-left py-2 px-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Stack</th>
                    <th className="text-left py-2 px-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Services</th>
                    <th className="text-right py-2 px-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deduplicatedHistory.slice(0, 20).map((entry) => (
                    <tr key={entry.id} className="border-b border-white/[0.03] hover:bg-white/[0.03]">
                      <td className="py-2 px-2 text-slate-500 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          entry.action === 'deploy'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-mono text-slate-300">{entry.template}</td>
                      <td className="py-2 px-2 font-mono text-slate-400">{entry.target_stack}</td>
                      <td className="py-2 px-2">
                        <div className="flex flex-wrap gap-1">
                          {entry.services.map((svc) => (
                            <span key={svc} className="px-1 py-0.5 rounded text-[9px] bg-white/5 text-slate-500">{svc}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right">
                        {isAdmin && entry.action === 'deploy' && latestActionMap.get(`${entry.template}__${entry.target_stack}`) !== 'undeploy' && (
                          <button
                            onClick={() => handleUndeploy(entry.template, entry.target_stack, entry.services)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-amber-400 hover:bg-amber-500/10 transition-colors"
                            title="Undeploy these services"
                          >
                            <Undo2 size={10} />
                            Undeploy
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'gallery' ? (
        <GalleryView onImport={handleGalleryImport} isAdmin={isAdmin} />
      ) : (
        <>
          {/* Category filter bar + search */}
          <div className="space-y-3">
            {/* Search bar */}
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${templates.length} templates...`}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/[0.04] border border-white/5 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 focus:bg-white/[0.06] focus:shadow-lg focus:shadow-emerald-500/5 transition-all duration-200"
              />
              {search ? (
                <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  <X size={14} />
                </button>
              ) : (
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 font-mono hidden sm:inline">/</span>
              )}
            </div>

            {/* Category pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORIES.filter((cat) => {
                if (cat.id === 'all') return true
                return templates.some((t) => resolveCategory(t.category).id === cat.id)
              }).map((cat, idx) => {
                const CatIcon = cat.icon
                const isActive = activeCategory === cat.id
                const count = cat.id === 'all' ? templates.length : templates.filter((t) => resolveCategory(t.category).id === cat.id).length
                return (
                  <React.Fragment key={cat.id}>
                    {idx === 1 && <div className="w-px h-5 bg-white/10 mx-0.5" />}
                    <button
                      onClick={() => setActiveCategory(cat.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border whitespace-nowrap transition-all duration-150 ${
                        isActive
                          ? cat.id === 'all'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                            : `${cat.color.badge} shadow-sm`
                          : 'bg-white/[0.03] text-slate-500 border-white/[0.04] hover:bg-white/[0.06] hover:text-slate-300 hover:border-white/10'
                      }`}
                    >
                      <CatIcon size={11} />
                      {cat.label}
                      <span className={`text-[9px] font-semibold ${isActive ? 'opacity-80' : 'text-slate-600'}`}>{count}</span>
                    </button>
                  </React.Fragment>
                )
              })}
            </div>
          </div>

          {/* Loading */}
          {loading && !data && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-slate-500" />
            </div>
          )}
          {error && !data && (
            <ErrorState title="Could not load this page" error={error} onRetry={refresh} />
          )}

          {/* Empty state */}
          {data && templates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center">
                <Package size={22} className="text-slate-500" />
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
              <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center">
                <Search size={22} className="text-slate-500" />
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

          {/* Template cards — grouped by category when viewing "All", flat grid otherwise */}
          {grouped ? (
            <div className="space-y-6">
              {grouped.map((group, gi) => {
                const { def, templates: groupTemplates } = group
                const CatIcon = def.icon
                return (
                  <div key={def.id} className="animate-fade-in" style={{ animationDelay: `${gi * 40}ms` }}>
                    {/* Category section header */}
                    <div className={`flex items-center gap-3 mb-4 pb-2 border-b border-white/[0.04]`}>
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center ${def.color.iconColor}`} style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                        <CatIcon size={14} />
                      </div>
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{def.label}</h3>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${def.color.badge}`}>
                        {groupTemplates.length}
                      </span>
                    </div>
                    {/* Category grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupTemplates.map((template) => (
                        <TemplateCard
                          key={template.name}
                          template={template}
                          onDeploy={handleOpenDeploy}
                          onEdit={handleOpenEdit}
                          onDelete={handleDeleteTemplate}
                          onExport={handleExportTemplate}
                          deployStatus={deployStatusMap[template.name] || { state: 'none' }}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Create Template Card — at the end */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  onClick={handleOpenCreate}
                  className="
                    group relative flex flex-col items-center justify-center
                    min-h-[200px] rounded-xl border border-dashed
                    border-white/10 hover:border-emerald-500/30
                    bg-white/[0.02] hover:bg-emerald-500/[0.04]
                    transition-all duration-300 cursor-pointer
                  "
                >
                  <div className="
                    flex items-center justify-center w-12 h-12 rounded-xl
                    bg-white/5 group-hover:bg-emerald-500/15
                    border border-white/5 group-hover:border-emerald-500/20
                    transition-all duration-300 mb-3
                  ">
                    <Plus className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors duration-300" />
                  </div>
                  <span className="text-sm font-medium text-slate-400 group-hover:text-emerald-400 transition-colors duration-300">
                    Create Template
                  </span>
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-400 mt-1 transition-colors">
                    Build a custom service template
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((template) => (
                <TemplateCard
                  key={template.name}
                  template={template}
                  onDeploy={handleOpenDeploy}
                  onEdit={handleOpenEdit}
                  onDelete={handleDeleteTemplate}
                  onExport={handleExportTemplate}
                  deployStatus={deployStatusMap[template.name] || { state: 'none' }}
                />
              ))}

              {/* Create Template Card */}
              <button
                onClick={handleOpenCreate}
                className="
                  group relative flex flex-col items-center justify-center
                  min-h-[200px] rounded-xl border border-dashed
                  border-white/10 hover:border-emerald-500/30
                  bg-white/[0.02] hover:bg-emerald-500/[0.04]
                  transition-all duration-300 cursor-pointer
                "
              >
                <div className="
                  flex items-center justify-center w-12 h-12 rounded-xl
                  bg-white/5 group-hover:bg-emerald-500/15
                  border border-white/5 group-hover:border-emerald-500/20
                  transition-all duration-300 mb-3
                ">
                  <Plus className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors duration-300" />
                </div>
                <span className="text-sm font-medium text-slate-400 group-hover:text-emerald-400 transition-colors duration-300">
                  Create Template
                </span>
                <span className="text-[10px] text-slate-500 group-hover:text-slate-400 mt-1 transition-colors">
                  Build a custom service template
                </span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Deploy modal */}
      {deployTarget && (
        <DeployModal
          template={deployTarget}
          detail={detail}
          detailLoading={detailLoading}
          stacks={availableStacks}
          onClose={handleCloseDeploy}
          onDeploy={handleDeploy}
          deploying={deploying}
          onUndeploy={handleUndeploy}
          isAdmin={isAdmin}
        />
      )}

      {/* Create / Edit modal */}
      {createEditMode && (
        <CreateEditModal
          mode={createEditMode}
          initial={editInitial}
          stacks={availableStacks}
          onClose={() => { if (!saving) setCreateEditMode(null) }}
          onSave={handleSaveTemplate}
          saving={saving}
        />
      )}

      {/* URL Import modal */}
      {showUrlImport && (
        <UrlImportModal
          onClose={() => setShowUrlImport(false)}
          onSuccess={refresh}
        />
      )}
    </div>
  )
}
