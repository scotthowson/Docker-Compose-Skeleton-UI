// =============================================================================
// Login / Initial Setup — Premium glassmorphic auth screen
// =============================================================================

import { useState } from 'react'
import {
  Shield, User, Lock, Eye, EyeOff, ArrowRight,
  Layers, Loader2, AlertCircle, Sparkles, Clock,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'

export default function Login() {
  const {
    hasAccount, loading, error,
    register, login, clearError,
  } = useAuthStore()
  const projectName = useSettingsStore((s) => s.projectName) || 'Docker Compose Skeleton'
  const projectSubtitle = useSettingsStore((s) => s.projectSubtitle) || 'Server Management Dashboard'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // checkAccountExists is already called by App.tsx — do NOT call it here
  // or it creates an infinite mount/unmount loop (loading→unmount Login→remount→repeat)

  // Mode is determined by whether an account exists
  const isSetup = !hasAccount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (isSetup && password !== confirmPassword) {
      return
    }

    setSubmitting(true)
    clearError()

    if (isSetup) {
      await register(username, password)
    } else {
      await login(username, password, rememberMe)
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
    <div className="h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full bg-emerald-500/[0.03] blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full bg-cyan-500/[0.03] blur-3xl" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-violet-500/[0.02] blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 mb-4">
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
        <div className="glass p-8">
          {/* Setup banner */}
          {isSetup && (
            <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 mb-6">
              <Sparkles size={16} className="text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-300">Initial Setup</p>
                <p className="text-[10px] text-emerald-400/70 mt-0.5">
                  Create your admin account to get started
                </p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-100">
              {isSetup ? 'Create Admin Account' : 'Welcome Back'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {isSetup
                ? 'Set up your credentials to secure the dashboard'
                : 'Enter your credentials to access the dashboard'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                    transition-all duration-200
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
                  autoComplete={isSetup ? 'new-password' : 'current-password'}
                  className="
                    w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg
                    text-sm text-slate-200 placeholder-slate-600
                    focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25
                    transition-all duration-200
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
              {isSetup && (
                <p className="text-[10px] text-slate-600 mt-1">
                  Min 6 characters, must include an uppercase letter and a number
                </p>
              )}
            </div>

            {/* Confirm Password (setup only) */}
            {isSetup && (
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
                      focus:outline-none focus:ring-1 transition-all duration-200
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
            )}

            {/* Remember Me (login only) */}
            {!isSetup && (
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
                  <span className="text-xs text-slate-400">Remember me for 4 hours</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2.5">
                <AlertCircle size={14} className="text-rose-400 shrink-0" />
                <p className="text-xs text-rose-300">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !username.trim() || !password.trim() || (isSetup && password !== confirmPassword)}
              className="
                flex items-center justify-center gap-2 w-full py-3 rounded-lg
                text-sm font-semibold
                bg-emerald-500 text-white
                hover:bg-emerald-400
                shadow-lg shadow-emerald-500/25
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isSetup ? (
                <Sparkles size={16} />
              ) : (
                <ArrowRight size={16} />
              )}
              {submitting
                ? (isSetup ? 'Creating Account...' : 'Signing In...')
                : (isSetup ? 'Create Account & Start' : 'Sign In')
              }
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <Shield size={12} className="text-slate-600" />
          <p className="text-[10px] text-slate-600">
            PBKDF2 encrypted credentials stored locally on this device only
          </p>
        </div>
      </div>
    </div>
  )
}
