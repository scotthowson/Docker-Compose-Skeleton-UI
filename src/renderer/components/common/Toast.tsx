// =============================================================================
// Toast — Premium notification toast system with glassmorphic design
// =============================================================================

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null)

// ---------------------------------------------------------------------------
// Toast item config
// ---------------------------------------------------------------------------

const toastConfig: Record<
  Toast['type'],
  {
    icon: React.ElementType
    gradient: string
    border: string
    text: string
    iconColor: string
    iconBg: string
    progressColor: string
  }
> = {
  success: {
    icon: CheckCircle2,
    gradient: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
    border: 'border-emerald-500/20',
    text: 'text-slate-200',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15',
    progressColor: 'bg-emerald-400',
  },
  error: {
    icon: XCircle,
    gradient: 'from-rose-500/15 via-rose-500/5 to-transparent',
    border: 'border-rose-500/20',
    text: 'text-slate-200',
    iconColor: 'text-rose-400',
    iconBg: 'bg-rose-500/15',
    progressColor: 'bg-rose-400',
  },
  warning: {
    icon: AlertTriangle,
    gradient: 'from-amber-500/15 via-amber-500/5 to-transparent',
    border: 'border-amber-500/20',
    text: 'text-slate-200',
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/15',
    progressColor: 'bg-amber-400',
  },
  info: {
    icon: Info,
    gradient: 'from-cyan-500/15 via-cyan-500/5 to-transparent',
    border: 'border-cyan-500/20',
    text: 'text-slate-200',
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/15',
    progressColor: 'bg-cyan-400',
  },
}

// ---------------------------------------------------------------------------
// Toast Item Component
// ---------------------------------------------------------------------------

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: string) => void
}) {
  const { icon: Icon, gradient, border, text, iconColor, iconBg, progressColor } = toastConfig[toast.type]
  const [exiting, setExiting] = useState(false)
  const [progress, setProgress] = useState(100)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const duration = toast.duration ?? (toast.type === 'error' ? 6000 : toast.type === 'success' ? 3000 : 4000)

  const dismiss = useCallback(() => {
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), 250)
  }, [toast.id, onDismiss])

  useEffect(() => {
    if (duration <= 0) return

    // Progress bar animation
    const startTime = Date.now()
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      if (remaining <= 0 && progressRef.current) {
        clearInterval(progressRef.current)
      }
    }, 30)

    // Auto-dismiss
    timerRef.current = setTimeout(dismiss, duration)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (progressRef.current) clearInterval(progressRef.current)
    }
  }, [duration, dismiss])

  return (
    <div
      className={`
        relative overflow-hidden
        w-[calc(100vw-2rem)] max-w-[340px]
        backdrop-blur-2xl rounded-xl
        border ${border}
        bg-gradient-to-r ${gradient}
        bg-slate-900/80
        shadow-2xl shadow-black/40
        transition-all duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${exiting
          ? 'opacity-0 translate-x-8 scale-95'
          : 'opacity-100 translate-x-0 scale-100'
        }
      `}
      style={{
        animation: exiting ? undefined : 'toastSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Content */}
      <div className="flex items-start gap-3 px-4 py-3.5">
        {/* Icon */}
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${iconBg} shrink-0 mt-0.5`}>
          <Icon size={16} strokeWidth={2.2} className={iconColor} />
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p className={`text-[13px] font-medium leading-snug ${text}`}>
            {toast.message}
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="shrink-0 p-1 rounded-md text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] transition-all duration-150 mt-0.5"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>

      {/* Progress bar */}
      {duration > 0 && (
        <div className="h-[2px] w-full bg-white/[0.04]">
          <div
            className={`h-full ${progressColor} opacity-60 transition-none`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <style>{`
        @keyframes toastSlideIn {
          0% {
            opacity: 0;
            transform: translateX(24px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

let idCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${++idCounter}-${Date.now()}`
    const newToast: Toast = { ...toast, id }
    setToasts((prev) => [...prev, newToast])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const contextValue = useMemo(
    () => ({ toasts, addToast, removeToast }),
    [toasts, addToast, removeToast],
  )

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Toast container — fixed bottom-right, safe area aware */}
      <div
        className="fixed right-5 z-[10001] flex flex-col gap-2.5 pointer-events-none"
        style={{
          bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
          right: 'calc(1.25rem + env(safe-area-inset-right, 0px))',
        }}
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>')
  }
  return ctx
}
