import { useLayoutEffect, useState, type RefObject } from 'react'

export interface SlidingIndicatorRect {
  left: number
  top: number
  width: number
  height: number
}

// Measures the active tab button's own offsetLeft/offsetTop/offsetWidth/
// offsetHeight (relative to `containerRef`) so a single floating pill can
// slide/resize to sit exactly behind whichever button is active, instead of
// each button separately owning its own "am I active" background —
// switching tabs then reads as one object travelling between slots rather
// than two flat recolors. Re-measures on resize (flex-wrap can reflow a
// row's own button positions at some widths even with the same active tab).
// Returns null until the first real measurement lands, so the indicator
// simply doesn't render for one frame rather than briefly flashing at a
// wrong 0,0 rect.
//
// Originally EventTabs' own local helper (Overview/Guests/Seating/Reports);
// extracted here once other tab-like toggles (EventsPage's status filter,
// SettingsPage's Users/Permissions switch, AddGuestDrawer's and
// InvitationTemplateDrawer's own mode toggles) wanted the exact same
// sliding-pill feel instead of their own flat per-button recolor.
export function useSlidingIndicator(containerRef: RefObject<HTMLElement | null>, activeKey: string): SlidingIndicatorRect | null {
  const [rect, setRect] = useState<SlidingIndicatorRect | null>(null)

  useLayoutEffect(() => {
    function measure() {
      const container = containerRef.current
      const activeEl = container?.querySelector<HTMLElement>(`[data-tab-key="${activeKey}"]`)
      if (!container || !activeEl) return
      setRect({ left: activeEl.offsetLeft, top: activeEl.offsetTop, width: activeEl.offsetWidth, height: activeEl.offsetHeight })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [containerRef, activeKey])

  return rect
}
