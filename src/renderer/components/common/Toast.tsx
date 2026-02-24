// =============================================================================
// Toast — Notification toast system with context provider and useToast hook
// =============================================================================

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
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
  { icon: React.ElementType; bg: string; border: string; text: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-300',
    iconColor: 'text-emerald-400',
  },
  error: {
    icon: XCircle,
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    text: 'text-rose-300',
    iconColor: 'text-rose-400',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-300',
    iconColor: 'text-amber-400',
  },
  info: {
    icon: Info,
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    text: 'text-cyan-300',
    iconColor: 'text-cyan-400',
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
  const { icon: Icon, bg, border, text, iconColor } = toastConfig[toast.type]
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), 200)
  }, [toast.id, onDismiss])

  useEffect(() => {
    const duration = toast.duration ?? 4000
    if (duration > 0) {
      timerRef.current = setTimeout(dismiss, duration)
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current)
      }
    }
  }, [toast.duration, dismiss])

  return (
    <div
      className={`
        flex items-start gap-3
        w-80 px-4 py-3
        backdrop-blur-2xl rounded-xl
        border ${border} ${bg}
        shadow-xl shadow-black/30
        transition-all duration-200 ease-out
        ${exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-slide-in'}
      `}
      style={{
        animation: exiting ? undefined : 'slideInRight 0.25s ease-out',
      }}
    >
      <Icon size={18} strokeWidth={2} className={`shrink-0 mt-0.5 ${iconColor}`} />
      <p className={`flex-1 text-sm ${text}`}>{toast.message}</p>
      <button
        onClick={dismiss}
        className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>

      <style>{`
        @keyframes slideInRight {
          0% { opacity: 0; transform: translateX(16px); }
          100% { opacity: 1; transform: translateX(0); }
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

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}

      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
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
