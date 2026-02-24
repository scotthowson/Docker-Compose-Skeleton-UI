// =============================================================================
// ConnectionForm — Server connection URL input with test & save
// =============================================================================

import React, { useState, useCallback } from 'react'
import { Link2, Check, X, Loader2, Save } from 'lucide-react'
import { useConnectionStore } from '../../stores/connectionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { apiClient } from '../../api/client'

type TestStatus = 'idle' | 'testing' | 'success' | 'failed'

export default function ConnectionForm() {
  const serverUrl = useConnectionStore((s) => s.serverUrl)
  const setServerUrl = useConnectionStore((s) => s.setServerUrl)
  const connect = useConnectionStore((s) => s.connect)
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  const [urlInput, setUrlInput] = useState(serverUrl)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [dirty, setDirty] = useState(false)

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

    // Temporarily set the URL for testing
    const prevUrl = apiClient.getBaseUrl()
    apiClient.setBaseUrl(urlInput)

    try {
      const ok = await apiClient.testConnection()
      setTestStatus(ok ? 'success' : 'failed')
    } catch {
      setTestStatus('failed')
    }

    // Restore previous URL if we haven't saved yet
    if (dirty) {
      apiClient.setBaseUrl(prevUrl)
    }
  }, [urlInput, dirty])

  const handleSave = useCallback(() => {
    setServerUrl(urlInput)
    updateSetting('serverUrl', urlInput)
    setDirty(false)
    // Reconnect with the new URL
    connect()
  }, [urlInput, setServerUrl, updateSetting, connect])

  const statusIndicator = () => {
    switch (testStatus) {
      case 'testing':
        return <Loader2 size={16} className="animate-spin text-amber-400" />
      case 'success':
        return <Check size={16} className="text-emerald-400" />
      case 'failed':
        return <X size={16} className="text-rose-400" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Link2 size={16} className="text-emerald-400" />
        <h4 className="text-sm font-semibold text-slate-200">Server Connection</h4>
      </div>

      {/* URL input */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
          Server URL
        </label>
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={handleUrlChange}
            placeholder="http://127.0.0.1:9876"
            className="
              flex-1 rounded-lg px-4 py-2.5
              text-sm text-slate-200 placeholder-slate-600 font-mono
              bg-slate-900/60 border border-white/[0.08]
              focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20
              transition-all duration-200
            "
          />
          <div className="flex items-center justify-center w-8 h-8">
            {statusIndicator()}
          </div>
        </div>
      </div>

      {/* Test result message */}
      {testStatus === 'success' && (
        <p className="text-xs text-emerald-400">Connection successful.</p>
      )}
      {testStatus === 'failed' && (
        <p className="text-xs text-rose-400">Connection failed. Check the URL and ensure the server is running.</p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleTest}
          disabled={testStatus === 'testing' || !urlInput.trim()}
          className="
            flex items-center gap-2 rounded-lg px-4 py-2
            text-sm font-medium
            text-slate-300 bg-white/5 border border-white/10
            hover:bg-white/10 hover:border-white/15
            disabled:opacity-50 transition-all duration-200
          "
        >
          {testStatus === 'testing' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Link2 size={14} />
          )}
          Test Connection
        </button>

        {dirty && (
          <button
            onClick={handleSave}
            className="
              flex items-center gap-2 rounded-lg px-4 py-2
              text-sm font-medium
              text-emerald-400 bg-emerald-500/10 border border-emerald-500/20
              hover:bg-emerald-500/20 hover:border-emerald-500/30
              transition-all duration-200
            "
          >
            <Save size={14} />
            Save
          </button>
        )}
      </div>
    </div>
  )
}
