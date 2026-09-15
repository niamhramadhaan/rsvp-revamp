import { useEffect, useId, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from 'react'
import { createPortal } from 'react-dom'
import { useDrawerPanel } from './DrawerPanelContext'
import { playSound } from '../utils/sound'

export interface DrawerPanelPortalProps {
  open: boolean
  onClose: () => void
  title: string
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  children?: ReactNode
  footer?: ReactNode
  widthPx?: number
}

// Drop-in replacement for the old `Drawer` — same open/onClose/title/icon/
// children/footer shape every call site already uses — except instead of
// rendering its own overlay, it registers its chrome into the single shared
// DrawerPanel (see DrawerPanelContext) and portals its children into that
// panel's body slot. The panel itself renders as a layout sibling of <main>
// (mounted once by DashboardLayout), so it can push <main> around without
// this component needing to know or care where in the tree it's used —
// TopHeader's Calendar drawer and the guest/event drawers nested deep under
// <main> all migrate the same trivial way (see each call site's diff).
export default function DrawerPanelPortal({ open, onClose, title, icon, children, footer, widthPx }: DrawerPanelPortalProps) {
  const { register, bodySlot, openDrawer, closeDrawer, activeOwnerId } = useDrawerPanel()

  // Stable per mounted instance — several DrawerPanelPortals live at once
  // (Calendar, Add Guest, Guest Profile, Create Event×2) and this is how the
  // shared context tells them apart when deciding who may occupy bodySlot.
  const id = useId()

  // Keep portaling for the length of the panel's own close transition
  // (300ms, matching DrawerPanel's CSS duration) so content doesn't vanish
  // out from under it mid-slide — the old Drawer got this for free by
  // staying permanently mounted; here it's this timer instead, since
  // multiple drawers' content can't all live in the DOM at once (only the
  // active one should occupy the shared body slot).
  const [renderPortal, setRenderPortal] = useState(open)

  // Every DrawerPanelPortal instance stays mounted for the app's whole
  // lifetime (see the comment above), so this effect's first run is just
  // "whatever `open` happened to start as" for every drawer at once, not a
  // real open/close — that guard is what stops page load from playing a
  // sound for every never-opened drawer in the tree.
  const mounted = useRef(false)

  useEffect(() => {
    const playTransitionSound = mounted.current
    mounted.current = true

    if (open) {
      setRenderPortal(true)
      openDrawer(id)
      if (playTransitionSound) playSound('open')
      return
    }
    closeDrawer(id)
    if (playTransitionSound) playSound('close')
    const timeout = window.setTimeout(() => setRenderPortal(false), 300)
    return () => window.clearTimeout(timeout)
  }, [open, openDrawer, closeDrawer, id])

  // Guarantees closeDrawer(id) runs when *this instance* goes away, not just
  // when its own `open` prop flips to false while it stays mounted. Without
  // this, unmounting while `open` was still true (e.g. navigating to a
  // different top-level page mid-drawer, which unmounts the whole
  // OverviewContent tree this portal lives in) left the shared context
  // stuck: `open`/`activeOwnerId` frozen at whatever this instance last set
  // them to, chrome frozen at this instance's last-registered title/icon —
  // forever, since nothing else was ever going to clear them. The panel
  // then looked "stuck open with just a header": chrome kept rendering the
  // stale title, but the body came up empty because React had already torn
  // down this instance's own createPortal along with the rest of the
  // component. closeDrawer's own ownership check (only the current owner
  // can actually close) means this is a safe no-op if a different drawer
  // has since taken over — it only fires for real when this instance was
  // still the one holding the slot.
  useEffect(() => {
    return () => closeDrawer(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-registered whenever any of this portal's own chrome inputs actually
  // change (not just on the open-transition effect above) — a footer that
  // changes mid-flight, e.g. a submit button's label flipping to
  // "Creating…", still needs to reach the panel. This used to run with NO
  // dependency array at all ("every render, unconditionally"), which turned
  // out to be one half of a genuine infinite loop: register()'s own
  // setChrome changes DrawerPanelContext's value, DashboardShell (the whole
  // shell's own context consumer) re-renders as a result, and — the other
  // half, fixed in TopHeader.tsx/OverviewContent.tsx/etc. — none of
  // DashboardShell's own children were memoized, so that cascaded into
  // recreating every inline `onClose`/`footer` closure across the entire
  // app on every single cycle, "feeding" this effect a genuinely new prop to
  // notice each time. A dependency array alone doesn't fix a loop like that
  // (the props really were different each time); it's still the right thing
  // to have on top of the memo fix, though — without it, this would keep
  // re-registering on any OTHER unrelated re-render this component ever
  // picks up for, which the memo fix doesn't guard against by itself.
  useEffect(() => {
    if (!renderPortal) return
    register({ title, icon, footer, widthPx, onRequestClose: onClose }, id)
  }, [renderPortal, register, id, title, icon, footer, widthPx, onClose])

  // The ownership check (not just renderPortal) is what keeps two drawers
  // from both landing in the shared bodySlot at once: if a different drawer
  // opens while this one is still inside its 300ms close grace period,
  // activeOwnerId flips away from `id` immediately, and this instance stops
  // portaling right away instead of waiting out its own timeout.
  if (!renderPortal || !bodySlot || activeOwnerId !== id) return null
  return createPortal(children, bodySlot)
}
