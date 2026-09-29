// =============================================================================
// ModalOverlay — the fixed layer behind a modal drawn inline in a page, as a
// dialog that behaves like one: Escape closes it, focus moves in, cycles inside
// and returns to what opened it (hooks/useModalA11y). It renders the div the
// modal used to be, so its classes and click-away handler move over unchanged:
//
//   <ModalOverlay onClose={() => setOpen(false)} className="fixed inset-0 z-[9999] …" onClick={() => setOpen(false)}>
//     <div className="glass …" onClick={(e) => e.stopPropagation()}> … </div>
//   </ModalOverlay>
//
// The dialog is named by `label`, else by the first heading inside it.
// =============================================================================

import { useEffect, useId, useRef, useState, type HTMLAttributes } from 'react'
import { useModalA11y, type ModalA11yOptions } from '../../hooks/useModalA11y'

export interface ModalOverlayProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'>, Pick<ModalA11yOptions, 'initialFocus' | 'closeOnEscape' | 'restoreFocus'> {
  /** Escape calls it; without one the overlay cannot be dismissed from the keyboard (a lock screen) */
  onClose?: () => void
  /** the dialog's name for a screen reader; without it the first heading inside names it */
  label?: string
}

const noop = () => {}

export default function ModalOverlay({ onClose, label, initialFocus, closeOnEscape, restoreFocus, children, ...div }: ModalOverlayProps) {
  const ref = useRef<HTMLDivElement>(null)
  const uid = useId()
  const [headingId, setHeadingId] = useState<string>()
  useModalA11y(ref, onClose ?? noop, { initialFocus, closeOnEscape: onClose ? closeOnEscape : false, restoreFocus })
  useEffect(() => {
    if (label) return
    const heading = ref.current?.querySelector<HTMLElement>('h1, h2, h3, h4')
    if (!heading) return
    if (!heading.id) heading.id = `${uid}-title`
    setHeadingId(heading.id)
  }, [label, uid])
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={label} aria-labelledby={label ? undefined : headingId} {...div}>
      {children}
    </div>
  )
}
