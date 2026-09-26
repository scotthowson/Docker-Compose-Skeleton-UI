// =============================================================================
// BackToTop — a small floating arrow in the bottom-right corner that appears
// once the page has been scrolled and glides back to the top when pressed.
// =============================================================================

import React, { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

interface BackToTopProps {
  /** The scrolling element (the app's main content area) */
  scrollRef: React.RefObject<HTMLElement | null>
  /** Pixels scrolled before the button shows */
  threshold?: number
}

export function BackToTop({ scrollRef, threshold = 480 }: BackToTopProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setVisible(el.scrollTop > threshold))
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [scrollRef, threshold])

  return (
    <button
      type="button"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fixed bottom-16 right-5 md:bottom-14 md:right-8 z-40 h-11 w-11 rounded-full
        bg-slate-900/80 backdrop-blur-md border border-white/10 text-slate-300 shadow-lg shadow-black/40
        flex items-center justify-center hover:text-emerald-400 hover:border-emerald-500/30 hover:-translate-y-0.5
        transition-all duration-300 ${visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'}`}
    >
      <ArrowUp size={18} />
    </button>
  )
}

export default BackToTop
