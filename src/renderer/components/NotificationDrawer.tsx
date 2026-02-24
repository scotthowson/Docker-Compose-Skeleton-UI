// =============================================================================
// NotificationDrawer — Slide-out notification center from the right side
// =============================================================================

import { useEffect, useRef, useCallback } from 'react'
import {
  Bell, BellOff, X, Info, CheckCircle, AlertTriangle, XCircle,
  Clock, Trash2, Check,
} from 'lucide-react'
import { useNotificationStore } from '../stores/notificationStore'
import { useSettingsStore } from '../stores/settingsStore'
import type { Notification } from '../stores/notificationStore'
import type { PageId } from '../../shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const typeStyles: Record<Notification['type'], { icon: typeof Info; color: string; bg: string; border: string }> = {
  info: {
    icon: Info,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
  },
  success: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  error: {
    icon: XCircle,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
}

function relativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ---------------------------------------------------------------------------
// NotificationCard
// ---------------------------------------------------------------------------

function NotificationCard({
  notification,
  onNavigate,
}: {
  notification: Notification
  onNavigate: (page: string) => void
}) {
  const { markAsRead, removeNotification } = useNotificationStore()
  const style = typeStyles[notification.type]
  const Icon = style.icon

  const handleClick = () => {
    if (!notification.read) {
      markAsRead(notification.id)
    }
    if (notification.action?.page) {
      onNavigate(notification.action.page)
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`
        group relative flex items-start gap-3 px-4 py-3
        border-b border-white/[0.04]
        transition-all duration-200
        ${notification.action ? 'cursor-pointer' : 'cursor-default'}
        ${notification.read ? 'opacity-60' : ''}
        hover:bg-white/[0.03]
      `}
    >
      {/* Type icon */}
      <div className={`
        flex-shrink-0 flex items-center justify-center
        w-8 h-8 rounded-lg mt-0.5
        ${style.bg} ${style.border} border
      `}>
        <Icon size={14} className={style.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-xs font-semibold leading-snug ${notification.read ? 'text-slate-400' : 'text-slate-200'}`}>
            {notification.title}
          </p>
          {/* Remove button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeNotification(notification.id)
            }}
            className="
              flex-shrink-0 opacity-0 group-hover:opacity-100
              p-0.5 rounded text-slate-600 hover:text-rose-400
              transition-all duration-150
            "
            title="Remove notification"
          >
            <X size={12} />
          </button>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="flex items-center gap-1 text-[10px] text-slate-600">
            <Clock size={9} />
            {relativeTime(notification.timestamp)}
          </span>
          {notification.action && (
            <span className="text-[10px] text-cyan-500/70 font-medium">
              {notification.action.label}
            </span>
          )}
        </div>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-cyan-400/20 flex-shrink-0" />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// NotificationDrawer
// ---------------------------------------------------------------------------

export function NotificationDrawer() {
  const {
    notifications,
    unreadCount,
    drawerOpen,
    markAllRead,
    clearAll,
    setDrawerOpen,
  } = useNotificationStore()

  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    if (!drawerOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [drawerOpen, setDrawerOpen])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setDrawerOpen(false)
      }
    },
    [setDrawerOpen],
  )

  const handleNavigate = useCallback(
    (page: string) => {
      setCurrentPage(page as PageId)
      setDrawerOpen(false)
    },
    [setCurrentPage, setDrawerOpen],
  )

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleBackdropClick}
        className={`
          fixed inset-0 z-50 bg-black/40 backdrop-blur-sm
          transition-opacity duration-300
          ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
      >
        {/* Drawer panel */}
        <div
          ref={panelRef}
          className={`
            absolute top-0 right-0 h-full w-[380px]
            bg-slate-950 border-l border-white/[0.06]
            flex flex-col
            transition-transform duration-300 ease-out
            ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-slate-200">Notifications</h2>
              {unreadCount > 0 && (
                <span className="
                  inline-flex items-center justify-center
                  min-w-[18px] h-[18px] px-1 rounded-full
                  bg-cyan-500/15 text-cyan-400
                  text-[10px] font-bold
                ">
                  {unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Mark all read */}
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="
                    flex items-center gap-1 px-2 py-1 rounded-md
                    text-[10px] font-medium text-slate-500
                    hover:bg-white/[0.05] hover:text-slate-300
                    transition-all duration-150
                  "
                  title="Mark all as read"
                >
                  <Check size={11} />
                  <span>Mark all read</span>
                </button>
              )}

              {/* Clear all */}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="
                    flex items-center gap-1 px-2 py-1 rounded-md
                    text-[10px] font-medium text-slate-500
                    hover:bg-rose-500/10 hover:text-rose-400
                    transition-all duration-150
                  "
                  title="Clear all notifications"
                >
                  <Trash2 size={11} />
                </button>
              )}

              {/* Close */}
              <button
                onClick={() => setDrawerOpen(false)}
                className="
                  flex items-center justify-center w-7 h-7 rounded-lg
                  text-slate-500 hover:bg-white/[0.06] hover:text-slate-300
                  transition-all duration-150 ml-1
                "
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <BellOff size={24} className="text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-400">No notifications yet</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Notifications from your Docker services will appear here
                  </p>
                </div>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onNavigate={handleNavigate}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/[0.06] shrink-0">
              <p className="text-[10px] text-slate-600 text-center">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                {unreadCount > 0 && ` \u00b7 ${unreadCount} unread`}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
