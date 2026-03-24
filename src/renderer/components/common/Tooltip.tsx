// =============================================================================
// Tooltip — Renders a hover tooltip via portal (escapes overflow:hidden)
// =============================================================================

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom'
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const ref = useRef<HTMLDivElement>(null)

  const show = useCallback(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setCoords({
      x: rect.left + rect.width / 2,
      y: position === 'top' ? rect.top - 8 : rect.bottom + 8,
    })
    setVisible(true)
  }, [position])

  const hide = useCallback(() => setVisible(false), [])

  return (
    <>
      <div ref={ref} onMouseEnter={show} onMouseLeave={hide} className="inline-flex">
        {children}
      </div>
      {visible && createPortal(
        <div
          className="fixed z-[99999] pointer-events-none animate-fade-in"
          style={{
            left: coords.x,
            top: coords.y,
            transform: position === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          }}
        >
          <div
            className="px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap shadow-xl backdrop-blur-xl"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0' }}
          >
            {content}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
