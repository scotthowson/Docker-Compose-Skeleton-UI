// =============================================================================
// Modal — Glassmorphic dialog with backdrop blur, title bar, content, actions
// =============================================================================

import React, { useEffect, useCallback, useRef } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
}

export function Modal({ open, onClose, title, children, actions }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  // Close on backdrop click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose],
  )

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="
        fixed inset-0 z-50
        flex items-center justify-center
        bg-black/60 backdrop-blur-sm
        animate-fade-in
      "
    >
      <div
        className="
          relative
          w-full max-w-lg mx-4
          bg-slate-900/90 backdrop-blur-2xl
          border border-white/10 rounded-2xl
          shadow-2xl shadow-black/50
          animate-fade-in
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2
            id="modal-title"
            className="text-base font-semibold text-slate-100"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="
              flex items-center justify-center
              w-8 h-8 rounded-lg
              text-slate-500 hover:text-slate-300
              hover:bg-white/[0.06]
              transition-colors duration-150
            "
            aria-label="Close modal"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 text-sm text-slate-300 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {children}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
