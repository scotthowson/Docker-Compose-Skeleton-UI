// =============================================================================
// Login / Initial Setup — Premium glassmorphic auth screen
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Shield, User, Lock, Eye, EyeOff, ArrowRight, Globe,
  Layers, Loader2, AlertCircle, Sparkles, Clock, KeyRound, UserPlus,
  Wifi, WifiOff,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useConnectionStore } from '../stores/connectionStore'
import { authRegister, authLogin, authSetup, authVerify, fetchSetupStatus } from '../api/endpoints'
import { apiClient, ApiError, ApiNetworkError } from '../api/client'

export default function Login() {
  const {
    hasAccount, loading, error,
    register, login, clearError, setApiToken,
  } = useAuthStore()
  const projectName = useSettingsStore((s) => s.projectName) || 'Docker Compose Skeleton'
  const projectSubtitle = useSettingsStore((s) => s.projectSubtitle) || 'Server Management Dashboard'
  const lastUsername = useSettingsStore((s) => s.lastUsername)
  const sessionDurationMinutes = useSettingsStore((s) => s.sessionDurationMinutes)
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const { setServerUrl } = useConnectionStore()

  const [username, setUsername] = useState(lastUsername || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [serverUrl, setServerUrlLocal] = useState(apiClient.getBaseUrl())
  const [serverAuthError, setServerAuthError] = useState<string | null>(null)
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const connTestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [connected, setConnected] = useState(false)
  const isFirstRender = useRef(true)

  // Derive session label from settings
  const sessionLabel = (() => {
    if (sessionDurationMinutes <= 0) return 'Stay signed in'
    if (sessionDurationMinutes < 60) return `Remember me for ${sessionDurationMinutes} min`
    if (sessionDurationMinutes === 60) return 'Remember me for 1 hour'
    if (sessionDurationMinutes < 1440) return `Remember me for ${sessionDurationMinutes / 60} hours`
    if (sessionDurationMinutes === 1440) return 'Remember me for 1 day'
    return `Remember me for ${Math.round(sessionDurationMinutes / 1440)} days`
  })()

  // Debounced connection test when serverUrl changes
  const testConnection = useCallback(async (url: string) => {
    setConnStatus('testing')
    try {
      const prev = apiClient.getBaseUrl()
      apiClient.setBaseUrl(url)
      try {
        const ok = await apiClient.testConnection()
        setConnStatus(ok ? 'ok' : 'fail')
      } catch {
        setConnStatus('fail')
      } finally {
        apiClient.setBaseUrl(prev)
      }
    } catch {
      setConnStatus('fail')
    }
  }, [])

  // Fire connection test immediately on first render, debounce subsequent changes
  useEffect(() => {
    if (connTestTimer.current) clearTimeout(connTestTimer.current)
    if (!serverUrl.trim()) {
      setConnStatus('idle')
      return
    }
    if (isFirstRender.current) {
      isFirstRender.current = false
      testConnection(serverUrl)
    } else {
      connTestTimer.current = setTimeout(() => testConnection(serverUrl), 800)
    }
    return () => { if (connTestTimer.current) clearTimeout(connTestTimer.current) }
  }, [serverUrl, testConnection])

  // Reset connected state when server URL changes (user is typing a new address)
  useEffect(() => {
    setConnected(false)
  }, [serverUrl])

  // When server is reachable, verify setup status before showing auth form.
  // Uses raw fetch() — NOT apiClient.get() — because authStore eagerly restores a
  // stale Bearer token on module load, and that Authorization header triggers a CORS
  // preflight which fails on the file:// origin used by packaged Electron builds.
  // Retries up to 3 times for transient failures (server starting, CORS settling).
  // If server is uninitialized → clear stale local data + redirect to Setup Wizard.
  // If server is initialized  → reveal the auth form (Phase 2).
  // If all attempts fail      → stay on Phase 1 (don't silently show login).
  useEffect(() => {
    if (connStatus !== 'ok') {
      setConnected(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const maxAttempts = 3
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (cancelled) return
        try {
          const ctrl = new AbortController()
          const tid = setTimeout(() => ctrl.abort(), 5000)
          const resp = await fetch(`${serverUrl}/setup/status`, { method: 'GET', signal: ctrl.signal })
          clearTimeout(tid)
          if (cancelled) return
          if (resp.ok) {
            const status = await resp.json()
            // Persist the verified server URL
            apiClient.setBaseUrl(serverUrl)
            setServerUrl(serverUrl)
            useSettingsStore.getState().updateSetting('serverUrl', serverUrl)
            if (!status.initialized) {
              // Server was factory-reset — clear stale local accounts from prior install
              if (window.electronAPI) {
                await window.electronAPI.setSetting('userAccounts', undefined)
              }
              localStorage.removeItem('userAccounts')
              localStorage.removeItem('auth-session')
              localStorage.removeItem('api-auth-token')
              apiClient.setAuthToken(null)
              useAuthStore.setState({ hasAccount: false, isAuthenticated: false, currentUser: null })
              setCurrentPage('setup')
            } else {
              setConnected(true)
            }
            return // Success — exit retry loop
          }
          // Non-ok response (404 etc.) — treat as initialized, show login
          apiClient.setBaseUrl(serverUrl)
          setServerUrl(serverUrl)
          useSettingsStore.getState().updateSetting('serverUrl', serverUrl)
          setConnected(true)
          return
        } catch {
          // Retry after a brief delay
          if (attempt < maxAttempts - 1) {
            await new Promise(r => setTimeout(r, 400))
          }
        }
      }
      // All attempts failed — stay on Phase 1 instead of silently showing login
      if (!cancelled) {
        setConnStatus('fail')
      }
    })()
    return () => { cancelled = true }
    // serverUrl intentionally omitted — effect should only fire on connStatus
    // transitions; the URL reset effect above handles URL changes separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connStatus, setCurrentPage, setServerUrl])

  // checkAccountExists is already called by App.tsx — do NOT call it here
  // or it creates an infinite mount/unmount loop (loading→unmount Login→remount→repeat)

  // Mode is determined by whether an account exists
  const isSetup = !hasAccount

  /** Attempt server-side Bearer token auth after local auth succeeds.
   *  Only network errors (server unreachable) allow offline fallback.
   *  All other errors (401, 403, 500) are real failures that block login. */
  const attemptServerAuth = async (user: string, pass: string, isInitialSetup: boolean): Promise<boolean> => {
    setServerAuthError(null)
    try {
      // First check if server requires auth
      try {
        await authVerify()
        // If verify succeeds, server has no auth required (localhost) — skip
        return true
      } catch (err) {
        if (err instanceof ApiNetworkError) {
          // Server unreachable — allow offline/local-only mode
          return true
        }
        if (err instanceof ApiError && err.status === 401) {
          // Server requires auth — proceed to login/setup below
        } else if (err instanceof ApiError && err.status === 404) {
          // Server has no auth endpoint or needs initial setup
          if (isInitialSetup) {
            try {
              const setupRes = await authSetup(user, pass)
              if (setupRes.success && setupRes.token) {
                setApiToken(setupRes.token)
                return true
              }
            } catch (setupErr) {
              if (setupErr instanceof ApiNetworkError) return true
              setServerAuthError(setupErr instanceof ApiError ? setupErr.message : 'Server setup failed')
              return false
            }
          }
          return true
        } else {
          // Real server error (500, etc.) — block login
          setServerAuthError(err instanceof ApiError ? err.message : 'Server error')
          return false
        }
      }

      // Server requires auth — authenticate
      try {
        const loginRes = isInitialSetup
          ? await authSetup(user, pass)
          : await authLogin(user, pass)
        if (loginRes.success && loginRes.token) {
          setApiToken(loginRes.token)
          return true
        }
        setServerAuthError('Server authentication failed')
        return false
      } catch (err) {
        if (err instanceof ApiNetworkError) {
          // Server unreachable — allow offline fallback
          return true
        }
        setServerAuthError(err instanceof ApiError ? err.message : 'Authentication failed')
        return false
      }
    } catch (err) {
      if (err instanceof ApiNetworkError) return true
      setServerAuthError('Unexpected authentication error')
      return false
    }
  }

  /** Switch between login and register modes, resetting form state */
  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode)
    setUsername(newMode === 'login' && lastUsername ? lastUsername : '')
    setPassword('')
    setConfirmPassword('')
    setInviteCode('')
    setShowPassword(false)
    setRegisterError(null)
    clearError()
  }

  /** Handle invite-code registration via the REST API */
  const handleInviteRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setRegisterError(null)
    clearError()

    if (!inviteCode.trim()) {
      setRegisterError('Invite code is required')
      return
    }
    if (!username.trim() || !password.trim()) {
      setRegisterError('Username and password are required')
      return
    }
    if (password.length < 8) {
      setRegisterError('Password must be at least 8 characters')
      return
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setRegisterError('Password must contain at least one uppercase letter and one number')
      return
    }
    if (password !== confirmPassword) {
      setRegisterError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      // Apply server URL before API call and persist it
      if (serverUrl !== apiClient.getBaseUrl()) {
        apiClient.setBaseUrl(serverUrl)
        setServerUrl(serverUrl)
        useSettingsStore.getState().updateSetting('serverUrl', serverUrl)
      }

      // Check if server is uninitialized — redirect to setup wizard
      try {
        const status = await fetchSetupStatus()
        if (!status.initialized) {
          setCurrentPage('setup')
          setSubmitting(false)
          return
        }
      } catch {
        // Server unreachable — proceed with normal auth
      }

      const res = await authRegister(username.trim(), password, inviteCode.trim())
      if (res.success && res.token) {
        // Store the API Bearer token
        setApiToken(res.token)

        // Persist session — use dynamic duration from settings
        const durationMs = sessionDurationMinutes <= 0 ? 0 : sessionDurationMinutes * 60 * 1000
        sessionStorage.setItem('currentUser', res.username)
        const session = {
          username: res.username,
          expiresAt: durationMs === 0 ? 0 : Date.now() + durationMs,
          token: res.token,
        }
        localStorage.setItem('auth-session', JSON.stringify(session))

        // Also create local account so app lock works offline
        await register(username.trim(), password)

        // Remember username for next session
        useSettingsStore.getState().updateSetting('lastUsername', username.trim())

        // Update zustand auth state to trigger route change
        useAuthStore.setState({
          isAuthenticated: true,
          currentUser: res.username,
          hasAccount: true,
        })
      } else {
        setRegisterError('Registration failed — unexpected response')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      setRegisterError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (isSetup && password !== confirmPassword) {
      return
    }

    setSubmitting(true)
    clearError()
    setServerAuthError(null)

    // Apply server URL before auth and persist it
    if (serverUrl !== apiClient.getBaseUrl()) {
      apiClient.setBaseUrl(serverUrl)
      setServerUrl(serverUrl)
      useSettingsStore.getState().updateSetting('serverUrl', serverUrl)
    }

    // Check if server is uninitialized — redirect to setup wizard
    try {
      const status = await fetchSetupStatus()
      if (!status.initialized) {
        setCurrentPage('setup')
        setSubmitting(false)
        return
      }
    } catch {
      // Server unreachable — proceed with normal auth
    }

    let localSuccess = false
    if (isSetup) {
      localSuccess = await register(username, password)
    } else {
      localSuccess = await login(username, password, rememberMe)
    }

    // If local auth succeeded, attempt server-side Bearer token auth
    if (localSuccess) {
      await attemptServerAuth(username, password, isSetup)
      // Remember username for next session
      useSettingsStore.getState().updateSetting('lastUsername', username.trim())
    }

    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <Layers className="w-7 h-7 text-emerald-400" />
          </div>
          <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-y-auto overflow-x-hidden scrollbar-thin"
      style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}
    >
      {/* Animated background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full bg-emerald-500/[0.05] blur-3xl animate-float-slow" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full bg-cyan-500/[0.05] blur-3xl animate-float-slow" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-violet-500/[0.04] blur-3xl animate-float-slow" style={{ animationDelay: '6s' }} />
        <div className="absolute -bottom-1/4 left-1/3 w-[28rem] h-[28rem] rounded-full bg-rose-500/[0.03] blur-3xl animate-float-slow" style={{ animationDelay: '9s' }} />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          animation: 'float 20s ease-in-out infinite',
        }}
      />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 mb-4 animate-float">
            <Layers className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            {projectName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {projectSubtitle}
          </p>
        </div>

        {/* Form card */}
        <div className="glass gradient-border p-8">

          {/* ════════════════════════════════════════════════════════════════
              Phase 1 — Server Connection (shown until server is verified)
              ════════════════════════════════════════════════════════════════ */}
          {!connected ? (
            <div className="animate-fade-in">
              {/* Connection banner */}
              <div className="flex items-center gap-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-4 py-3 mb-6">
                <Globe size={16} className="text-cyan-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-cyan-300">Server Connection</p>
                  <p className="text-[10px] text-cyan-400/70 mt-0.5">
                    Connect to your DCS server to get started
                  </p>
                </div>
              </div>

              {/* Header */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-100">Connect to Server</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Enter the address of your DCS API server
                </p>
              </div>

              {/* Server URL — press Enter or click button to test */}
              <form onSubmit={(e) => {
                e.preventDefault()
                if (connTestTimer.current) clearTimeout(connTestTimer.current)
                if (serverUrl.trim()) testConnection(serverUrl)
              }}>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Server Address</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    <input
                      type="url"
                      value={serverUrl}
                      onChange={(e) => setServerUrlLocal(e.target.value)}
                      placeholder="http://192.168.1.100:9876"
                      autoFocus
                      autoComplete="url"
                      className="
                        w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-lg
                        text-sm text-slate-200 placeholder-slate-600
                        focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25
                        transition-all duration-300
                      "
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {connStatus === 'testing' && <Loader2 size={14} className="text-slate-500 animate-spin" />}
                      {connStatus === 'ok' && <Wifi size={14} className="text-emerald-400" />}
                      {connStatus === 'fail' && <WifiOff size={14} className="text-rose-400" />}
                    </div>
                  </div>
                  {connStatus === 'ok' ? (
                    <p className="text-[10px] text-emerald-400/80 mt-1">
                      Connected — verifying server…
                    </p>
                  ) : connStatus === 'fail' ? (
                    <p className="text-[10px] text-rose-400/80 mt-1">
                      Server unreachable — check address and ensure API is running
                    </p>
                  ) : connStatus === 'testing' ? (
                    <p className="text-[10px] text-cyan-400/80 mt-1">
                      Connecting…
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-600 mt-1">
                      IP address and port of your DCS API server
                    </p>
                  )}
                </div>

                {/* Test Connection button */}
                <button
                  type="submit"
                  disabled={connStatus === 'testing' || connStatus === 'ok' || !serverUrl.trim()}
                  className="
                    w-full mt-4 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-300 press
                    bg-cyan-500/20 text-cyan-300 border border-cyan-500/30
                    hover:bg-cyan-500/30 hover:border-cyan-500/50
                    disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cyan-500/20
                    flex items-center justify-center gap-2
                  "
                >
                  {connStatus === 'testing' ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Testing Connection…
                    </>
                  ) : connStatus === 'ok' ? (
                    <>
                      <Wifi size={14} />
                      Connected
                    </>
                  ) : (
                    <>
                      <Wifi size={14} />
                      Test Connection
                    </>
                  )}
                </button>
              </form>
            </div>

          ) : (
          <>
          {/* ════════════════════════════════════════════════════════════════
              Phase 2 — Authentication (server verified as initialized)
              ════════════════════════════════════════════════════════════════ */}

          {/* ── Initial Setup (admin creation) — unchanged ── */}
          {isSetup && (
            <>
              {/* Setup banner */}
              <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 mb-6">
                <Sparkles size={16} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-emerald-300">Initial Setup</p>
                  <p className="text-[10px] text-emerald-400/70 mt-0.5">
                    Create your admin account to get started
                  </p>
                </div>
              </div>

              {/* Header */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-100">Create Admin Account</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Set up your credentials to secure the dashboard
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Server URL */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Server Address</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    <input
                      type="url"
                      value={serverUrl}
                      onChange={(e) => { setServerUrlLocal(e.target.value); setServerAuthError(null) }}
                      placeholder="http://192.168.1.100:9876"
                      autoComplete="url"
                      className="
                        w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-lg
                        text-sm text-slate-200 placeholder-slate-600
                        focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25
                        transition-all duration-300
                      "
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {connStatus === 'testing' && <Loader2 size={14} className="text-slate-500 animate-spin" />}
                      {connStatus === 'ok' && <Wifi size={14} className="text-emerald-400" />}
                      {connStatus === 'fail' && <WifiOff size={14} className="text-rose-400" />}
                    </div>
                  </div>
                  {connStatus === 'fail' ? (
                    <p className="text-[10px] text-rose-400/80 mt-1">
                      Server unreachable — check address and ensure API is running
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-600 mt-1">
                      IP address and port of your DCS API server
                    </p>
                  )}
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); clearError() }}
                      placeholder="Enter username"
                      autoFocus
                      autoComplete="username"
                      className="
                        w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg
                        text-sm text-slate-200 placeholder-slate-600
                        focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25
                        transition-all duration-300
                      "
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); clearError() }}
                      placeholder="Enter password"
                      autoComplete="new-password"
                      className="
                        w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg
                        text-sm text-slate-200 placeholder-slate-600
                        focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25
                        transition-all duration-300
                      "
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">
                    Min 8 characters, must include an uppercase letter and a number
                  </p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      className={`
                        w-full pl-10 pr-4 py-3 bg-white/5 border rounded-lg
                        text-sm text-slate-200 placeholder-slate-600
                        focus:outline-none focus:ring-1 transition-all duration-300
                        ${confirmPassword && password !== confirmPassword
                          ? 'border-rose-500/50 focus:border-rose-500/50 focus:ring-rose-500/25'
                          : 'border-white/10 focus:border-emerald-500/50 focus:ring-emerald-500/25'
                        }
                      `}
                    />
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[10px] text-rose-400 mt-1">Passwords do not match</p>
                  )}
                </div>

                {/* Error */}
                {(error || serverAuthError) && (
                  <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2.5">
                    <AlertCircle size={14} className="text-rose-400 shrink-0" />
                    <p className="text-xs text-rose-300">{serverAuthError || error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || !username.trim() || !password.trim() || password !== confirmPassword}
                  className="
                    flex items-center justify-center gap-2 w-full py-3 rounded-lg
                    text-sm font-semibold
                    bg-emerald-500 text-white
                    hover:bg-emerald-400
                    shadow-lg shadow-emerald-500/25
                    hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]
                    transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {submitting ? 'Creating Account...' : 'Create Account & Start'}
                </button>
              </form>
            </>
          )}

          {/* ── Sign In mode ── */}
          {!isSetup && mode === 'login' && (
            <div key="login-mode" className="animate-fade-in">
              {/* Header */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-100">Welcome Back</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your credentials to access the dashboard
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Server URL */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Server Address</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    <input
                      type="url"
                      value={serverUrl}
                      onChange={(e) => { setServerUrlLocal(e.target.value); setServerAuthError(null) }}
                      placeholder="http://192.168.1.100:9876"
                      autoComplete="url"
                      className="
                        w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-lg
                        text-sm text-slate-200 placeholder-slate-600
                        focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25
                        transition-all duration-300
                      "
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {connStatus === 'testing' && <Loader2 size={14} className="text-slate-500 animate-spin" />}
                      {connStatus === 'ok' && <Wifi size={14} className="text-emerald-400" />}
                      {connStatus === 'fail' && <WifiOff size={14} className="text-rose-400" />}
                    </div>
                  </div>
                  {connStatus === 'fail' ? (
                    <p className="text-[10px] text-rose-400/80 mt-1">
                      Server unreachable — check address and ensure API is running
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-600 mt-1">
                      IP address and port of your DCS API server
                    </p>
                  )}
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); clearError() }}
                      placeholder="Enter username"
                      autoFocus
                      autoComplete="username"
                      className="
                        w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg
                        text-sm text-slate-200 placeholder-slate-600
                        focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25
                        transition-all duration-300
                      "
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); clearError() }}
                      placeholder="Enter password"
                      autoComplete="current-password"
                      className="
                        w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg
                        text-sm text-slate-200 placeholder-slate-600
                        focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25
                        transition-all duration-300
                      "
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRememberMe(!rememberMe)}
                    className={`
                      flex items-center justify-center w-4 h-4 rounded border transition-all
                      ${rememberMe
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'bg-white/5 border-white/20 hover:border-white/30'
                      }
                    `}
                  >
                    {rememberMe && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <Clock size={11} className="text-slate-500" />
                    <span className="text-xs text-slate-400">{sessionLabel}</span>
                  </div>
                </div>

                {/* Error */}
                {(error || serverAuthError) && (
                  <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2.5">
                    <AlertCircle size={14} className="text-rose-400 shrink-0" />
                    <p className="text-xs text-rose-300">{serverAuthError || error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || !username.trim() || !password.trim()}
                  className="
                    flex items-center justify-center gap-2 w-full py-3 rounded-lg
                    text-sm font-semibold
                    bg-emerald-500 text-white
                    hover:bg-emerald-400
                    shadow-lg shadow-emerald-500/25
                    hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]
                    transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                  {submitting ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

              {/* Switch to register mode */}
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-xs text-slate-500 hover:text-cyan-400 transition-colors duration-200"
                >
                  Have an invite code? <span className="font-medium text-cyan-400/80 hover:text-cyan-300">Register</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Register with Invite Code mode ── */}
          {!isSetup && mode === 'register' && (
            <div key="register-mode" className="animate-fade-in">
              {/* Invite banner */}
              <div className="flex items-center gap-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-4 py-3 mb-6">
                <KeyRound size={16} className="text-cyan-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-cyan-300">Invite Registration</p>
                  <p className="text-[10px] text-cyan-400/70 mt-0.5">
                    Use an invite code to create your account
                  </p>
                </div>
              </div>

              {/* Header */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-100">Create Account</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your invite code and choose your credentials
                </p>
              </div>

              <form onSubmit={handleInviteRegister} className="space-y-4">
                {/* Server URL */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Server Address</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    <input
                      type="url"
                      value={serverUrl}
                      onChange={(e) => { setServerUrlLocal(e.target.value); setRegisterError(null) }}
                      placeholder="http://192.168.1.100:9876"
                      autoComplete="url"
                      className="
                        w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-lg
                        text-sm text-slate-200 placeholder-slate-600
                        focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25
                        transition-all duration-300
                      "
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {connStatus === 'testing' && <Loader2 size={14} className="text-slate-500 animate-spin" />}
                      {connStatus === 'ok' && <Wifi size={14} className="text-emerald-400" />}
                      {connStatus === 'fail' && <WifiOff size={14} className="text-rose-400" />}
                    </div>
                  </div>
                  {connStatus === 'fail' ? (
                    <p className="text-[10px] text-rose-400/80 mt-1">
                      Server unreachable — check address and ensure API is running
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-600 mt-1">
                      IP address and port of your DCS API server
                    </p>
                  )}
                </div>

                {/* Invite Code */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Invite Code</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => { setInviteCode(e.target.value); setRegisterError(null) }}
                      placeholder="Enter invite code"
                      autoFocus
                      autoComplete="off"
                      className="
                        w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg
                        text-sm text-slate-200 placeholder-slate-600
                        focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25
                        transition-all duration-300
                      "
                    />
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setRegisterError(null) }}
                      placeholder="Choose a username"
                      autoComplete="username"
                      className="
                        w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg
                        text-sm text-slate-200 placeholder-slate-600
                        focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25
                        transition-all duration-300
                      "
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setRegisterError(null) }}
                      placeholder="Choose a password"
                      autoComplete="new-password"
                      className="
                        w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg
                        text-sm text-slate-200 placeholder-slate-600
                        focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25
                        transition-all duration-300
                      "
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">
                    Min 8 characters, must include an uppercase letter and a number
                  </p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setRegisterError(null) }}
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      className={`
                        w-full pl-10 pr-4 py-3 bg-white/5 border rounded-lg
                        text-sm text-slate-200 placeholder-slate-600
                        focus:outline-none focus:ring-1 transition-all duration-300
                        ${confirmPassword && password !== confirmPassword
                          ? 'border-rose-500/50 focus:border-rose-500/50 focus:ring-rose-500/25'
                          : 'border-white/10 focus:border-cyan-500/50 focus:ring-cyan-500/25'
                        }
                      `}
                    />
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[10px] text-rose-400 mt-1">Passwords do not match</p>
                  )}
                </div>

                {/* Error */}
                {(registerError || error) && (
                  <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2.5">
                    <AlertCircle size={14} className="text-rose-400 shrink-0" />
                    <p className="text-xs text-rose-300">{registerError || error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || !inviteCode.trim() || !username.trim() || !password.trim() || password !== confirmPassword}
                  className="
                    flex items-center justify-center gap-2 w-full py-3 rounded-lg
                    text-sm font-semibold
                    bg-cyan-500 text-white
                    hover:bg-cyan-400
                    shadow-lg shadow-cyan-500/25
                    hover:shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98]
                    transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <UserPlus size={16} />
                  )}
                  {submitting ? 'Creating Account...' : 'Register'}
                </button>
              </form>

              {/* Switch to login mode */}
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-xs text-slate-500 hover:text-emerald-400 transition-colors duration-200"
                >
                  Already have an account? <span className="font-medium text-emerald-400/80 hover:text-emerald-300">Sign In</span>
                </button>
              </div>
            </div>
          )}

          </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <Shield size={12} className="text-slate-600" />
          <p className="text-[10px] text-slate-600">
            {!connected
              ? 'Secure connection to your DCS API server'
              : !isSetup && mode === 'register'
                ? 'Secure registration via server-validated invite codes'
                : 'PBKDF2 encrypted credentials stored locally on this device only'
            }
          </p>
        </div>
      </div>
    </div>
  )
}
