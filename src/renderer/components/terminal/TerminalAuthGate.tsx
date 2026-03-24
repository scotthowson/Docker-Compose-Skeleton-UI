// =============================================================================
// TerminalAuthGate — Linux system credential gate for terminal access
// =============================================================================

import { useState, useRef, useEffect } from 'react'
import { Shield, User, Lock, Loader2, AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react'
import { terminalAuth } from '../../api/endpoints'

interface Props {
  onAuthenticated: (token: string, username: string) => void
}

export default function TerminalAuthGate({ onAuthenticated }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberSession, setRememberSession] = useState(true)
  const [mounted, setMounted] = useState(false)

  const usernameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    usernameRef.current?.focus()
    requestAnimationFrame(() => setMounted(true))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password || loading) return

    setLoading(true)
    setError('')

    try {
      const res = await terminalAuth(username.trim(), password)
      if (res.success && res.token) {
        if (rememberSession) {
          sessionStorage.setItem('terminal-session', JSON.stringify({
            token: res.token,
            username: res.username,
          }))
        }
        onAuthenticated(res.token, res.username)
      } else {
        setError(res.message || 'Authentication failed')
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err) {
        const apiErr = err as { status: number; message?: string }
        if (apiErr.status === 429) {
          setError('Too many failed attempts. Please try again in 15 minutes.')
        } else if (apiErr.status === 401) {
          setError('Invalid Linux username or password.')
        } else {
          setError(apiErr.message || 'Authentication failed')
        }
      } else {
        setError(err instanceof Error ? err.message : 'Connection failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] px-4">
      <div
        className={`
          w-full max-w-md transition-all duration-500 ease-out
          ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        `}
      >
        {/* Icon header */}
        <div className="flex flex-col items-center mb-8">
          <div className={`
            flex items-center justify-center w-16 h-16 rounded-2xl mb-4
            bg-emerald-500/10 border border-emerald-500/20
            transition-all duration-700 ease-out
            ${mounted ? 'scale-100 rotate-0' : 'scale-75 -rotate-12'}
          `}>
            <KeyRound size={28} className="text-emerald-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-semibold text-slate-200">Linux System Authentication</h2>
          <p className="text-xs text-slate-500 mt-1 text-center">
            Enter your Linux account credentials to access the terminal
          </p>
        </div>

        {/* Login card */}
        <form
          onSubmit={handleSubmit}
          className="
            bg-slate-900/60 backdrop-blur-xl border border-white/5
            rounded-2xl p-6 space-y-5
            shadow-xl shadow-black/20
            gradient-border
          "
        >
          {/* Security badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <Shield size={14} className="text-emerald-500/60 shrink-0" />
            <span className="text-[11px] text-emerald-400/70">
              Credentials are validated against the server's Linux system accounts
            </span>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-rose-500/8 border border-rose-500/15 animate-fade-in">
              <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
              <span className="text-xs text-rose-300">{error}</span>
            </div>
          )}

          {/* Username field */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Username
            </label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                ref={usernameRef}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="linux username"
                disabled={loading}
                autoComplete="username"
                className="
                  w-full pl-10 pr-4 py-2.5 rounded-xl text-sm
                  bg-slate-800/60 border border-white/5
                  text-slate-200 placeholder-slate-600
                  focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20
                  disabled:opacity-50 transition-all duration-200
                "
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="linux password"
                disabled={loading}
                autoComplete="current-password"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                className="
                  w-full pl-10 pr-11 py-2.5 rounded-xl text-sm
                  bg-slate-800/60 border border-white/5
                  text-slate-200 placeholder-slate-600
                  focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20
                  disabled:opacity-50 transition-all duration-200
                "
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Remember toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Remember for this session</span>
            <button
              type="button"
              onClick={() => setRememberSession(!rememberSession)}
              className={`
                relative w-9 h-5 rounded-full transition-colors duration-200
                ${rememberSession
                  ? 'bg-emerald-500/30 border-emerald-500/40'
                  : 'bg-slate-700/50 border-white/5'
                }
                border
              `}
            >
              <span className={`
                absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200
                ${rememberSession
                  ? 'left-[18px] bg-emerald-400'
                  : 'left-0.5 bg-slate-500'
                }
              `} />
            </button>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="
              w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium
              bg-emerald-500/15 text-emerald-400 border border-emerald-500/20
              hover:bg-emerald-500/25 hover:text-emerald-300 hover:border-emerald-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
            "
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <Shield size={15} />
                Authenticate
              </>
            )}
          </button>
        </form>

        {/* Footer hint */}
        <p className="text-center text-[10px] text-slate-700 mt-4">
          Terminal sessions expire after 4 hours. Close the browser tab to end immediately.
        </p>
      </div>
    </div>
  )
}
