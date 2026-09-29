// =============================================================================
// useModalA11y — what a modal, a sheet or a drawer does for the keyboard, once:
//   · focus moves into it when it opens (the first field, else the first
//     control; `initialFocus` picks another) and goes back to what opened it
//     when it closes
//   · Tab and Shift+Tab cycle inside it and never reach the page behind
//   · Escape closes it (unless an open list inside it wants the key first)
// Modals stack: only the top one answers the keys, so a confirmation asked from
// a sheet takes Escape and Tab for itself and hands them back when it closes.
//
//   const ref = useRef<HTMLDivElement>(null)
//   useModalA11y(ref, onClose)                       // ref: the dialog's own element
//   <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}>
//
// A modal drawn inline in a page (a fixed overlay behind a panel) uses
// <ModalOverlay onClose={…}> instead, which is this hook on the overlay's div.
// A modal that stays mounted while closed passes `active: open`.
// =============================================================================

import { useEffect, useRef, type RefObject } from 'react'

export interface ModalA11yOptions {
  /** the modal is open (default true); pass the open flag for one that stays mounted while closed */
  active?: boolean
  /** what gets focus when it opens: an element, or a selector inside the modal (default: the first field, else the first control) */
  initialFocus?: RefObject<HTMLElement | null> | string
  /** Escape closes it (default true) */
  closeOnEscape?: boolean
  /** focus goes back to what had it before the modal opened (default true) */
  restoreFocus?: boolean
}

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable=""], [contenteditable="true"]'
const TEXT_FIELD = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]):not([type="color"]), textarea, select'

/** the open modals, the top one last */
const openModals: symbol[] = []

// A click on a button does not always focus it (Safari, Firefox on a Mac, a script's .click()), and then nothing
// but the click itself says what opened the modal: the last control clicked, if that was moments ago.
let lastTrigger: { el: HTMLElement; at: number } | null = null
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>('button, a[href], [role="button"], [role="menuitem"], summary')
    if (el) lastTrigger = { el, at: Date.now() }
  }, true)
}

/** the controls Tab can reach inside a modal, in order */
function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.matches(':disabled') || el.getAttribute('tabindex') === '-1') return false
    if (el instanceof HTMLInputElement && el.type === 'hidden') return false
    if (el.closest('[hidden], [inert], [aria-hidden="true"]')) return false
    const style = getComputedStyle(el)
    return style.visibility !== 'hidden' && style.display !== 'none' && el.getClientRects().length > 0
  })
}

function focusInitial(root: HTMLElement, initialFocus: ModalA11yOptions['initialFocus']): void {
  let target: HTMLElement | null = null
  if (typeof initialFocus === 'string') target = root.querySelector<HTMLElement>(initialFocus)
  else if (initialFocus?.current) target = initialFocus.current
  if (!target) target = root.querySelector<HTMLElement>('[data-autofocus]')
  if (!target) {
    const list = focusables(root)
    // a text field, except on a touch screen, where its keyboard would come up over the modal
    const touch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
    target = (touch ? undefined : list.find((el) => el.matches(TEXT_FIELD))) ?? list[0] ?? null
  }
  if (!target) {
    if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1')
    root.style.outline = 'none'
    target = root
  }
  target.focus({ preventScroll: true })
}

export function useModalA11y(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  { active = true, initialFocus, closeOnEscape = true, restoreFocus = true }: ModalA11yOptions = {},
): void {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  // what had focus when the modal was drawn, read during that render: an autoFocus in the modal
  // would already have taken the focus by the time an effect runs
  const openerRef = useRef<HTMLElement | null>(null)
  const wasActive = useRef(false)
  if (active && !wasActive.current && typeof document !== 'undefined') {
    const a = document.activeElement
    const clicked = lastTrigger && Date.now() - lastTrigger.at < 3000 && lastTrigger.el.isConnected ? lastTrigger.el : null
    openerRef.current = a instanceof HTMLElement && a !== document.body ? a : clicked
  }
  wasActive.current = active

  useEffect(() => {
    const root = ref.current
    if (!active || !root) return
    const me = Symbol('modal')
    openModals.push(me)
    if (!root.contains(document.activeElement)) focusInitial(root, initialFocus)

    const onKey = (e: KeyboardEvent) => {
      if (openModals[openModals.length - 1] !== me) return
      if (e.key === 'Escape') {
        if (!closeOnEscape) return
        // an open list inside the modal (a select's options) closes first; the modal on the next press
        if ((e.target as HTMLElement | null)?.closest?.('[aria-haspopup][aria-expanded="true"], [role="combobox"][aria-expanded="true"]')) return
        e.preventDefault()
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables(root)
      const current = document.activeElement as HTMLElement | null
      if (list.length === 0) {
        e.preventDefault()
        if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1')
        root.focus({ preventScroll: true })
        return
      }
      const inside = !!current && root.contains(current)
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && (!inside || current === first || current === root)) {
        e.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!e.shiftKey && (!inside || current === last)) {
        e.preventDefault()
        first.focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', onKey, true)

    return () => {
      document.removeEventListener('keydown', onKey, true)
      const at = openModals.indexOf(me)
      if (at >= 0) openModals.splice(at, 1)
      const opener = openerRef.current
      const here = document.activeElement
      // back to what opened the modal, unless focus has already gone somewhere on purpose
      if (restoreFocus && opener && opener.isConnected && (!here || here === document.body || root.contains(here))) opener.focus({ preventScroll: true })
    }
    // (the options are read once, when the modal opens)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
