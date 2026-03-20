import { create } from 'zustand'
import type { Plugin, PluginHookInfo, PluginLogEntry } from '../../shared/types'
import * as api from '../api/endpoints'

// Built-in features that act as plugins (togglable without backend installation)
const BUILT_IN_PLUGINS: Plugin[] = [
  {
    name: 'compose-linter',
    version: '1.2.0',
    description: 'Real-time compose validation with 24 rules',
    author: 'DCS Community',
    enabled: true,
    templates: [],
    hooks: ['pre-deploy'],
  },
]

/** Read built-in plugin enabled state from localStorage */
function getBuiltInEnabled(name: string): boolean {
  try {
    const stored = localStorage.getItem(`plugin-enabled-${name}`)
    if (stored !== null) return stored === 'true'
  } catch {}
  return true
}

/** Merge API plugins with built-in plugins. localStorage is the source of truth
 *  for built-in plugin enabled state (survives API refetch, page navigation, refresh). */
function mergeWithBuiltIns(apiPlugins: Plugin[]): Plugin[] {
  const builtInNames = new Set(BUILT_IN_PLUGINS.map(bp => bp.name))
  const apiNames = new Set(apiPlugins.map(p => p.name))

  // For API plugins that are also built-ins, override enabled from localStorage
  const merged = apiPlugins.map(p => {
    if (builtInNames.has(p.name)) {
      return { ...p, enabled: getBuiltInEnabled(p.name) }
    }
    return p
  })

  // Add built-ins not returned by the API
  const extras = BUILT_IN_PLUGINS
    .filter(bp => !apiNames.has(bp.name))
    .map(bp => ({ ...bp, enabled: getBuiltInEnabled(bp.name) }))

  return [...merged, ...extras]
}

interface PluginState {
  plugins: Plugin[]
  loading: boolean
  installing: boolean
  error: string | null

  // Detail panel state
  selectedPlugin: string | null
  hooks: PluginHookInfo[]
  hookContent: string | null
  hookContentName: string | null
  logs: PluginLogEntry[]
  detailLoading: boolean
  testOutput: string | null
  testRunning: boolean

  // Core actions
  fetchPlugins: () => Promise<void>
  installPlugin: (source: string) => Promise<boolean>
  scaffoldPlugin: (def: Parameters<typeof api.scaffoldPlugin>[0]) => Promise<boolean>
  removePlugin: (name: string) => Promise<boolean>
  togglePlugin: (name: string) => Promise<boolean>

  // Detail actions
  selectPlugin: (name: string | null) => void
  fetchHooks: (name: string) => Promise<void>
  fetchHookContent: (pluginName: string, hookName: string) => Promise<void>
  updateHook: (pluginName: string, hookName: string, content: string) => Promise<boolean>
  testHook: (pluginName: string, hookName: string) => Promise<void>
  fetchLogs: (name: string) => Promise<void>
  updateConfig: (name: string, config: Record<string, unknown>) => Promise<boolean>
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: mergeWithBuiltIns([]),
  loading: false,
  installing: false,
  error: null,

  selectedPlugin: null,
  hooks: [],
  hookContent: null,
  hookContentName: null,
  logs: [],
  detailLoading: false,
  testOutput: null,
  testRunning: false,

  fetchPlugins: async () => {
    set({ loading: true, error: null })
    try {
      const res = await api.fetchPlugins()
      set({ plugins: mergeWithBuiltIns(res.plugins), loading: false })
    } catch (err) {
      // Even on error, keep built-in plugins available
      set({ plugins: mergeWithBuiltIns([]), loading: false, error: err instanceof Error ? err.message : 'Failed to fetch plugins' })
    }
  },

  installPlugin: async (source) => {
    set({ installing: true, error: null })
    try {
      await api.installPlugin(source)
      set({ installing: false })
      get().fetchPlugins()
      return true
    } catch (err) {
      set({ installing: false, error: err instanceof Error ? err.message : 'Failed to install plugin' })
      return false
    }
  },

  scaffoldPlugin: async (def) => {
    set({ installing: true, error: null })
    try {
      await api.scaffoldPlugin(def)
      set({ installing: false })
      get().fetchPlugins()
      return true
    } catch (err) {
      set({ installing: false, error: err instanceof Error ? err.message : 'Failed to scaffold plugin' })
      return false
    }
  },

  removePlugin: async (name) => {
    try {
      await api.removePlugin(name)
      set(prev => ({
        plugins: prev.plugins.filter(p => p.name !== name),
        selectedPlugin: prev.selectedPlugin === name ? null : prev.selectedPlugin,
      }))
      return true
    } catch { return false }
  },

  togglePlugin: async (name) => {
    // Check if this is a built-in plugin (not on backend)
    const isBuiltIn = BUILT_IN_PLUGINS.some(bp => bp.name === name)
    const current = get().plugins.find(p => p.name === name)

    if (isBuiltIn && current) {
      // Toggle locally — no API call needed
      const newEnabled = !current.enabled
      set(prev => ({ plugins: prev.plugins.map(p => p.name === name ? { ...p, enabled: newEnabled } : p) }))
      try { localStorage.setItem(`plugin-enabled-${name}`, String(newEnabled)) } catch {}
      return true
    }

    // Backend plugin — call API
    try {
      const updated = await api.togglePlugin(name)
      set(prev => ({ plugins: prev.plugins.map(p => p.name === name ? updated : p) }))
      return true
    } catch {
      // API failed — toggle locally as fallback
      if (current) {
        const newEnabled = !current.enabled
        set(prev => ({ plugins: prev.plugins.map(p => p.name === name ? { ...p, enabled: newEnabled } : p) }))
        try { localStorage.setItem(`plugin-enabled-${name}`, String(newEnabled)) } catch {}
      }
      return true
    }
  },

  // ── Detail panel ──

  selectPlugin: (name) => {
    set({ selectedPlugin: name, hooks: [], hookContent: null, hookContentName: null, logs: [], testOutput: null })
    if (name) {
      get().fetchHooks(name)
      get().fetchLogs(name)
    }
  },

  fetchHooks: async (name) => {
    set({ detailLoading: true })
    try {
      const res = await api.fetchPluginHooks(name)
      set({ hooks: res.hooks, detailLoading: false })
    } catch {
      set({ detailLoading: false })
    }
  },

  fetchHookContent: async (pluginName, hookName) => {
    set({ hookContent: null, hookContentName: hookName })
    try {
      const res = await api.fetchPluginHookContent(pluginName, hookName)
      set({ hookContent: res.content })
    } catch {
      set({ hookContent: '# Failed to load hook content' })
    }
  },

  updateHook: async (pluginName, hookName, content) => {
    try {
      await api.updatePluginHook(pluginName, hookName, content)
      return true
    } catch { return false }
  },

  testHook: async (pluginName, hookName) => {
    set({ testRunning: true, testOutput: null })
    try {
      const res = await api.testPluginHook(pluginName, hookName)
      set({ testOutput: `Exit code: ${res.exit_code}\n\n${res.output}`, testRunning: false })
    } catch (err) {
      set({ testOutput: `Error: ${err instanceof Error ? err.message : 'Test failed'}`, testRunning: false })
    }
  },

  fetchLogs: async (name) => {
    try {
      const res = await api.fetchPluginLogs(name)
      set({ logs: res.entries })
    } catch {
      set({ logs: [] })
    }
  },

  updateConfig: async (name, config) => {
    try {
      await api.updatePluginConfig(name, config)
      return true
    } catch { return false }
  },
}))
