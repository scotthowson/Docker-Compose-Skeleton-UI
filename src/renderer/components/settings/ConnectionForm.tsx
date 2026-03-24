// =============================================================================
// ConnectionForm — Compact server URL with inline status, test & save
// =============================================================================

import React, { useState, useCallback, useEffect } from 'react'
import { Link2, Check, X, Loader2, Save } from 'lucide-react'
import { useConnectionStore } from '../../stores/connectionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { apiClient } from '../../api/client'

type TestStatus = 'idle' | 'testing' | 'success' | 'failed'

const statusStyles: Record<string, { dot: string; bg: string; text: string }> = {
  connected: { dot: 'bg-emerald-400', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  connecting: { dot: 'bg-amber-400 animate-pulse', bg: 'bg-amber-500/15', text: 'text-amber-400' },
  error: { dot: 'bg-rose-400', bg: 'bg-rose-500/15', text: 'text-rose-400' },
  disconnected: { dot: 'bg-slate-400', bg: 'bg-slate-500/15', text: 'text-slate-400' },
}

export default function ConnectionForm() {
  const serverUrl = useConnectionStore((s) => s.serverUrl)
  const connectionStatus = useConnectionStore((s) => s.status)
  const setServerUrl = useConnectionStore((s) => s.setServerUrl)
  const connect = useConnectionStore((s) => s.connect)
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  const [urlInput, setUrlInput] = useState(serverUrl)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [dirty, setDirty] = useState(false)

  // Sync when server URL changes externally (e.g. server switch via ServerSwitcher)
  useEffect(() => {
    setUrlInput(serverUrl)
    setDirty(false)
    setTestStatus('idle')
  }, [serverUrl])

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUrlInput(e.target.value)
      setDirty(e.target.value !== serverUrl)
      setTestStatus('idle')
    },
    [serverUrl],
  )

  const handleTest = useCallback(async () => {
    setTestStatus('testing')

    const prevUrl = apiClient.getBaseUrl()
    apiClient.setBaseUrl(urlInput)

    try {
      const ok = await apiClient.testConnection()
      setTestStatus(ok ? 'success' : 'failed')
    } catch {
      setTestStatus('failed')
    }

    if (dirty) {
      apiClient.setBaseUrl(prevUrl)
    }
  }, [urlInput, dirty])

  const handleSave = useCallback(() => {
    setServerUrl(urlInput)
    updateSetting('serverUrl', urlInput)
    setDirty(false)
    connect()
  }, [urlInput, setServerUrl, updateSetting, connect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (dirty) handleSave()
      else handleTest()
    }
  }, [dirty, handleSave, handleTest])

  const style = statusStyles[connectionStatus] ?? statusStyles.disconnected

  return (
    <div className="space-y-3">
      {/* Status + URL input row */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 transition-colors duration-500 ${style.bg} ${style.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${style.dot}`} />
          {connectionStatus}
        </span>
        <input
          type="url"
          value={urlInput}
          onChange={handleUrlChange}
          onKeyDown={handleKeyDown}
          placeholder="http://127.0.0.1:9876"
          className="
            flex-1 rounded-lg px-3 py-1.5
            text-xs text-slate-200 placeholder-slate-600 font-mono
            bg-black/30 border border-white/10
            focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20
            transition-all duration-200
          "
        />
        <div className="flex items-center justify-center w-5 h-5 shrink-0">
          {testStatus === 'testing' && <Loader2 size={12} className="animate-spin text-amber-400" />}
          {testStatus === 'success' && <Check size={12} className="text-emerald-400" />}
          {testStatus === 'failed' && <X size={12} className="text-rose-400" />}
        </div>
      </div>

      {/* Test result — fixed height */}
      <div className="h-3.5">
        {testStatus === 'success' && (
          <p className="text-[10px] text-emerald-400 animate-fade-in">Connection successful</p>
        )}
        {testStatus === 'failed' && (
          <p className="text-[10px] text-rose-400 animate-fade-in">Failed — check URL and server status</p>
        )}
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleTest}
          disabled={testStatus === 'testing' || !urlInput.trim()}
          className="
            flex items-center gap-1.5 rounded-lg px-3 py-1.5
            text-[11px] font-medium
            text-slate-300 bg-white/5 border border-white/10
            hover:bg-white/10 hover:border-white/15
            disabled:opacity-50 transition-all duration-200 press
          "
        >
          {testStatus === 'testing' ? <Loader2 size={11} className="animate-spin" /> : <Link2 size={11} />}
          Test
        </button>

        <div className={`transition-all duration-200 overflow-hidden ${dirty ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0'}`}>
          <button
            onClick={handleSave}
            className="
              flex items-center gap-1.5 rounded-lg px-3 py-1.5
              text-[11px] font-medium whitespace-nowrap
              text-emerald-400 bg-emerald-500/10 border border-emerald-500/20
              hover:bg-emerald-500/20 hover:border-emerald-500/30
              transition-all duration-200 press
            "
          >
            <Save size={11} />
            Save & Reconnect
          </button>
        </div>
      </div>
    </div>
  )
}
