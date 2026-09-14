import { memo, useEffect, useRef } from 'react'
import { CloseIcon } from './icons/UiIcons'
import { useEnterTransition } from '../hooks/useEnterTransition'
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss'
import { useDrawerPanel } from './DrawerPanelContext'

// The single, always-mounted drawer surface for the whole dashboard.
// DrawerPanelPortal instances (used by AddGuestDrawer, CreateEventDrawer,
// GuestProfileDrawer, EditEventDrawer, the Check-in scan drawer, and
// TopHeader's Calendar drawer) feed their chrome and content into
// DrawerPanelContext; this component is the only one that actually renders
// panel DOM.
//
// Desktop (lg+): a push/reflow panel — DashboardLayout mounts this as a
// grid-cell sibling of <main>, and the grid track's width (not this
// component) does the animating (see DashboardLayout's
// `transition-[grid-template-columns]`), so <main> visibly shrinks to make
// room. No backdrop at this width: there's nothing left to dim once <main>
// has genuinely made space. (A desktop overlay variant was tried briefly —
// see git history — specifically to avoid the per-frame reflow cost this
// push animation carries on a busy tab; reverted back to this push/reflow
// feel per explicit request, that tradeoff accepted knowingly.)
//
// Below lg: a bottom sheet, not the old full-screen slide-in-from-the-right
// overlay — the same "real scrim, drag-handle affordance, rounded top
// corners" presentation EventSwitcher's mobile menu already uses, now
// generalized to every drawer instead of living as a one-off. `max-h-[85vh]`
// (not the old full `inset-y-0`) is what actually makes this read as a
// sheet resting on top of the page rather than a second full-screen page —
// content taller than that scrolls inside the body slot, same as it always
// could.
// memo here doesn't change when this re-renders (it reads chrome/open/
// bodySlot from context directly, so it still correctly re-renders whenever
// those change) — it's just consistent with TopHeader/OverviewContent/
// IconRail's own reasoning: DrawerPanel takes no props, so a parent
// (DashboardShell) re-render should never be a reason for this to redo work
// on its own.
function DrawerPanel() {
  const { open, chrome, setBodySlotNode } = useDrawerPanel()
  const entered = useEnterTransition(open)
  const bodyRef = useRef<HTMLDivElement>(null)
  const Icon = chrome?.icon

  // Swipe-to-dismiss (mobile bottom sheet only — see the handle's own
  // `lg:hidden`, which is the only place these handlers are attached, so
  // dragging is simply never wired up at `lg:`'s push-panel presentation).
  // `sheetRef` drives the live drag by mutating the <aside> below directly
  // (see the hook's own doc for why: React state on every pointermove was
  // the actual cause of both the lag and the missed-dismiss bug).
  const { sheetRef, resetDrag, handlers: dragHandlers } = useSwipeToDismiss({
    onDismiss: () => chrome?.onRequestClose?.(),
  })

  useEffect(() => {
    setBodySlotNode(bodyRef.current)
  }, [setBodySlotNode])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') chrome?.onRequestClose?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, chrome])

  // A fresh drawer for every open — without this, reopening right after a
  // dismiss-by-swipe would still be carrying that swipe's final dragY (a
  // large off-screen value), rendering translated away until some new drag
  // or transition happened to correct it.
  useEffect(() => {
    if (open) resetDrag()
  }, [open, resetDrag])

  return (
    <>
      {/* Backdrop — mobile-only overlay fallback; desktop push/reflow has
          nothing left to dim once <main> has made real room. Plain
          opacity, no backdrop-blur: blurring a live, animating backdrop is
          real GPU cost every frame of the fade, and it's exactly the kind
          of thing that reads as "laggy"/stuttery on a mid-range phone — a
          translucent color fades just as well for a fraction of the cost. */}
      <div
        aria-hidden="true"
        onClick={() => chrome?.onRequestClose?.()}
        className={`fixed inset-0 z-40 bg-ink-900/40 transition-opacity duration-300 ease-out lg:hidden ${
          entered ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        ref={sheetRef}
        inert={!open}
        aria-label={chrome?.title}
        // `flex flex-col` on <aside> ITSELF (not just the inner div below)
        // is the actual scroll fix: the inner div used to get its height
        // from `h-full` (100% of aside), but aside only ever had a
        // *max-height* — no explicit height — and a percentage height only
        // resolves against a definite containing-block height, which
        // `max-height` alone doesn't reliably provide. In practice that
        // meant the inner div (and the scrollable body inside it) fell back
        // to sizing around its own content instead of aside's clamped box,
        // so tall content just rendered past the intended bounds — with
        // nothing to scroll to reach the part that overflowed. A flex
        // container's own max-height DOES correctly constrain a `flex-1`
        // child (see the inner div below, now `flex-1 min-h-0` instead of
        // `h-full`) — the standard, reliable pattern for "a scrollable area
        // capped at a max height," which percentage heights are not.
        //
        // lg:min-h-0 is the same "grid item defaults to min-height: auto"
        // fix SeatMapCanvas needed on the width axis — at `lg:` this
        // <aside> is itself a grid item (DashboardLayout's
        // `[1fr_var(--panel-w)]` row) and would otherwise refuse to shrink
        // below its own content's height regardless of the fix above.
        //
        // max-h-[85dvh] (not the old 85vh): `vh` is measured against the
        // *largest* possible viewport, so on a phone whose address bar is
        // currently showing, 85vh could ask for more height than is
        // actually visible right now — `dvh` tracks the real, current
        // viewport instead (same reasoning DashboardShell's own `h-dvh`
        // root already documents).
        // lg:p-3 (not the old lg:p-4) — unified with DashboardLayout's own
        // lg:gap-3/lg:p-3 around the rail/header. Those two paddings were
        // set at different points (this one predates the later Floating
        // Rail redesign) and never reconciled, so the drawer's own margin
        // read as a slightly different size than the rail/header's —
        // exactly the "inconsistent nudge at every corner" a design review
        // caught. One value now: every floating margin in the shell is 12px.
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] w-full flex-col shadow-2xl transition-transform duration-300 ease-out lg:static lg:inset-auto lg:z-auto lg:h-full lg:max-h-none lg:min-h-0 lg:w-full lg:max-w-none lg:shadow-none lg:p-3 ${
          entered ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'
        }`}
      >
        {/* "Grouped glass sections" (Design B from the round-16 3-way
            comparison, picked over the previously-shipped "Accent rail +
            floating labels") — a plain header/footer (cream now, was white
            before the later "warm card on cool page" pass — see
            --color-cream in index.css), no accent rail down the edge; the
            panel leans on GroupedField.tsx's tinted section cards inside
            the body to carry the accent instead.

            At `lg:` (desktop push/reflow), this reads as its own rounded,
            bordered, shadowed block — the same card language OverviewContent's
            own glass-stage wrapper uses — instead of a flush, square-cornered
            panel sitting edge-to-edge in its grid track; the `lg:p-4` above
            on <aside> is what creates the visible gap around it. Below `lg:`,
            it's a bottom sheet instead — rounded top corners only, no border
            (the shadow + rounding already separate it from the page, a
            border on top of that just double-draws the same edge), and its
            own bottom padding clears a phone's home-indicator safe area
            without adding unwanted space at `lg:`. */}
        <div
          className={`flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-t-3xl bg-cream pb-[max(1rem,env(safe-area-inset-bottom))] transition-opacity duration-300 ease-out lg:rounded-[2rem] lg:border lg:border-black/5 lg:pb-0 lg:shadow-[0_20px_60px_-15px_rgba(16,30,51,0.2)] ${
            entered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Drag handle — the sheet's own dedicated grab target (see
              useSwipeToDismiss). touch-none stops the browser's own scroll/
              refresh gestures from fighting the drag; a larger invisible
              hit-area (via padding) than the visible bar keeps the target
              comfortably above the 44px touch minimum without visually
              enlarging it. `lg:hidden` is also what keeps these handlers
              inert at the desktop push-panel — a display:none element
              can't receive pointer events. */}
          <div
            {...dragHandlers}
            className="flex shrink-0 touch-none justify-center py-2.5 lg:hidden"
          >
            <div className="h-1.5 w-10 rounded-full bg-black/10" />
          </div>

          <div className="flex shrink-0 items-center gap-3 border-b border-black/5 px-6 py-5">
            {Icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-700/10 text-accent-700">
                <Icon className="h-[18px] w-[18px]" />
              </span>
            )}
            <h3 className="flex-1 truncate font-display text-base font-semibold text-ink-900">{chrome?.title}</h3>
            <button
              type="button"
              aria-label="Close"
              onClick={() => chrome?.onRequestClose?.()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-icon-gray transition hover:bg-black/5 hover:text-ink-900 active:scale-[0.97]"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          {/* DrawerPanelPortal.tsx portals its children in here. */}
          <div ref={bodyRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5" />

          {chrome?.footer && <div className="flex shrink-0 items-center justify-end gap-3 border-t border-black/5 px-6 py-4">{chrome.footer}</div>}
        </div>
      </aside>
    </>
  )
}

export default memo(DrawerPanel)
