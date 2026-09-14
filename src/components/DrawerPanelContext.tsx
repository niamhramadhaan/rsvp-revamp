import { createContext, useCallback, useContext, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from 'react'

export interface DrawerChrome {
  title: string
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  footer?: ReactNode
  /** Concrete pixel width for the desktop push-panel's grid track (a
   * `max-w-*` class can't drive an animatable `grid-template-columns`
   * value). Defaults to 448 — the same width today's `max-w-md` renders at
   * — since no current drawer overrides it. */
  widthPx?: number
  /** The active DrawerPanelPortal's own `onClose` prop — the real source of
   * truth for "should this drawer be open" lives in whichever component
   * passed `open`/`onClose` down (GuestSeatingView, EventsPage, ...), so the
   * panel's close button/backdrop/Escape key call this rather than closing
   * themselves, letting that state flow back down the normal way. */
  onRequestClose: () => void
}

interface DrawerPanelContextValue {
  open: boolean
  chrome: DrawerChrome | null
  bodySlot: HTMLDivElement | null
  /** Id of the DrawerPanelPortal instance currently allowed to occupy the
   * shared body slot — see the "single occupant" note on activeOwnerRef
   * below. Portals compare this against their own id to decide whether to
   * actually render into bodySlot / register their chrome. */
  activeOwnerId: string | null
  register: (chrome: DrawerChrome, ownerId: string) => void
  openDrawer: (ownerId: string) => void
  closeDrawer: (ownerId: string) => void
  setBodySlotNode: (node: HTMLDivElement | null) => void
}

const DrawerPanelContext = createContext<DrawerPanelContextValue | null>(null)

// Single shared "which drawer is active" slot for the whole dashboard. Sits
// above IconRail/TopHeader/main in DashboardLayout so any of them can open a
// drawer, while the actual panel DOM renders as a layout sibling of <main>
// only (see DrawerPanel + DashboardLayout) — the two things drawer triggers
// need (an "open this" function reachable from anywhere, and a panel that
// only pushes <main> around, never the rail/header) live at different
// levels of the tree, hence the split between this context and where
// DrawerPanel itself actually mounts.
export function DrawerPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [chrome, setChrome] = useState<DrawerChrome | null>(null)
  const [bodySlot, setBodySlot] = useState<HTMLDivElement | null>(null)
  const [activeOwnerId, setActiveOwnerId] = useState<string | null>(null)

  // Mirrors activeOwnerId synchronously (assigned during render, ahead of
  // any effects) so openDrawer/closeDrawer/register below can read "who
  // owns the slot right now" without taking a dependency on activeOwnerId
  // themselves — see the stability note next to openDrawer/closeDrawer.
  const activeOwnerRef = useRef<string | null>(null)
  activeOwnerRef.current = activeOwnerId

  // Every DrawerPanelPortal (there are several mounted at once — Calendar,
  // Add Guest, Guest Profile, Create Event×2 — only one ever open) depends
  // on openDrawer/closeDrawer in its own effect's dependency array. Wrapping
  // setOpen in a plain inline arrow function here would hand out a new
  // function identity on every Provider render (which happens on every
  // open/chrome/bodySlot change), making *every* portal's effect re-run —
  // including ones whose own `open` prop never changed — which would call
  // closeDrawer() right after the drawer that just opened, closing it again
  // in the same commit. useCallback with no deps keeps these stable for the
  // Provider's whole lifetime so only the portal whose own `open` actually
  // changed re-runs its effect.
  //
  // Each caller now passes its own id, and openDrawer immediately hands it
  // the slot (activeOwnerRef updates before closeDrawer/register from any
  // other portal are called in the same commit). closeDrawer only clears
  // `open` if the caller is still the current owner — a portal whose `open`
  // prop flips to false *after* a different drawer already claimed the slot
  // (e.g. its own state update batched in the same tick) must not stomp on
  // the drawer that just opened.
  const openDrawer = useCallback((ownerId: string) => {
    activeOwnerRef.current = ownerId
    setActiveOwnerId(ownerId)
    setOpen(true)
  }, [])
  const closeDrawer = useCallback((ownerId: string) => {
    if (activeOwnerRef.current !== ownerId) return
    setOpen(false)
  }, [])

  // Chrome updates are similarly gated: only the current owner's chrome may
  // apply. Without this, a drawer that's mid-way through its own 300ms close
  // transition (see DrawerPanelPortal) could re-register its now-stale title/
  // footer over whatever the newly-opened drawer just registered.
  const register = useCallback((chrome: DrawerChrome, ownerId: string) => {
    if (activeOwnerRef.current !== ownerId) return
    setChrome(chrome)
  }, [])

  const value: DrawerPanelContextValue = {
    open,
    chrome,
    bodySlot,
    activeOwnerId,
    register,
    openDrawer,
    closeDrawer,
    setBodySlotNode: setBodySlot,
  }

  return <DrawerPanelContext.Provider value={value}>{children}</DrawerPanelContext.Provider>
}

export function useDrawerPanel(): DrawerPanelContextValue {
  const ctx = useContext(DrawerPanelContext)
  if (!ctx) throw new Error('useDrawerPanel must be used within a DrawerPanelProvider')
  return ctx
}
