import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react'

/** What a registered guard actually does with an attempted navigation — shown
 * its own "proceed" callback (rather than returning a boolean/Promise) so it
 * can pop its own confirm dialog and only call `proceed` once the admin's
 * actually picked Save or Discard; never calling it at all is exactly how
 * "Cancel" blocks the navigation. */
type GuardHandler = (proceed: () => void) => void

interface SeatEditorGuardApi {
  /** Called by anything that's about to navigate away from the current page/
   * tab/event (IconRail, EventTabs, EventSwitcher) — runs `proceed` right
   * away if nothing's registered a guard (the common case), or hands it to
   * whatever IS registered (SeatMapCanvas, while its edit mode has unsaved
   * changes) to decide whether/when it actually happens. */
  requestNavigation: (proceed: () => void) => void
  /** SeatMapCanvas's own registration — pass a handler while there's
   * something this session would lose by navigating away unprompted (edit
   * mode on, with at least one undo-able change), and `null` the moment
   * either stops being true (or on unmount). Registering again simply
   * replaces whatever was registered before; there's only ever one active
   * seat map editor at a time. */
  registerGuard: (handler: GuardHandler | null) => void
}

const SeatEditorGuardContext = createContext<SeatEditorGuardApi | null>(null)

// Sits once near the app's root (DashboardLayout) — above IconRail, TopHeader
// (EventSwitcher lives there), and the tabbed event dashboard alike, so
// whichever one of those is what "navigate elsewhere" actually means in the
// moment can reach the one seat-map editor that might be open several levels
// further down, without prop-drilling a callback through everything in
// between.
export function SeatEditorGuardProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<GuardHandler | null>(null)

  const registerGuard = useCallback((handler: GuardHandler | null) => {
    handlerRef.current = handler
  }, [])

  const requestNavigation = useCallback((proceed: () => void) => {
    if (handlerRef.current) handlerRef.current(proceed)
    else proceed()
  }, [])

  return <SeatEditorGuardContext.Provider value={{ requestNavigation, registerGuard }}>{children}</SeatEditorGuardContext.Provider>
}

export function useSeatEditorGuard(): SeatEditorGuardApi {
  const ctx = useContext(SeatEditorGuardContext)
  if (!ctx) throw new Error('useSeatEditorGuard must be used within a SeatEditorGuardProvider')
  return ctx
}
