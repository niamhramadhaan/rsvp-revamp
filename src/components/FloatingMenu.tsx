import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

export interface FloatingMenuProps {
  open: boolean
  onClose: () => void
  /** The trigger button this menu opens under — measured (not assumed) to
   * place the menu, so it works the same whether the trigger sits in a
   * fixed header or scrolls around inside a table row. */
  anchorRef: RefObject<HTMLButtonElement | null>
  /** Which of the trigger's edges the menu's own same-side edge lines up
   * with — 'end' (right edges flush) matches every kebab/filter menu this
   * replaces; 'start' lines up left edges instead. */
  align?: 'start' | 'end'
  /** Gap between the trigger's bottom edge and the menu, in px. */
  gap?: number
  /** Classes for the menu panel itself (width, radius, background, shadow,
   * ring — everything but position, which this component owns). */
  className?: string
  children: ReactNode
}

// A handful of dropdowns in this app (GuestFilterPopover, EventSwitcher's
// desktop card, AutoAssignDrawer's invite filter) sit as a plain `absolute`
// child of their own trigger, which is fine as long as nothing between that
// trigger and the page root clips overflow. Two menus don't have that
// luxury — GuestsView's own row kebab lives inside the guest table's
// rounded `overflow-hidden` card (plus its `overflow-x-auto` scroll
// wrapper for narrow screens), and EventsPage's card kebab sits inside the
// event photo's own `overflow-hidden` crop — so an ordinary `absolute`
// panel there gets sliced off at whichever ancestor's edge it crosses,
// however high its own z-index.
//
// This portals the menu straight into `document.body` instead, positioned
// with real viewport coordinates (`position: fixed`) measured off the
// trigger itself, so it always draws above whatever would otherwise clip
// it. React still bubbles a portal's events through the *component* tree
// it was rendered from (not the DOM tree it lands in), so a click inside
// this menu still reaches this component the normal way — that's also why
// the backdrop and the menu body both stop propagation here: a caller
// whose trigger sits inside something with its own onClick (EventsPage's
// whole card opens the event on click) relies on that, not on DOM nesting,
// to keep a menu interaction from also firing the thing underneath it.
export default function FloatingMenu({ open, onClose, anchorRef, align = 'end', gap = 4, className, children }: FloatingMenuProps) {
  const [rect, setRect] = useState<{ top: number; left: number; right: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setRect(null)
      return
    }
    function measure() {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setRect({ top: r.bottom, left: r.left, right: window.innerWidth - r.right })
    }
    measure()
    // Recomputed (not just closed) on resize or scroll — `capture: true` on
    // scroll catches an inner scrollable ancestor's own scroll (e.g. the
    // guest table's horizontal overflow-x-auto), not only the window's —
    // so the menu tracks its trigger instead of drifting away from it.
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, anchorRef])

  if (!open || !rect) return null

  const style: React.CSSProperties = { position: 'fixed', top: rect.top + gap, zIndex: 50 }
  if (align === 'end') style.right = rect.right
  else style.left = rect.left

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onClose() }} />
      <div style={style} className={className} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </>,
    document.body,
  )
}
