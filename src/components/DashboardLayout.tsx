import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import IconRail, { type DashboardPage } from './IconRail'
import TopHeader from './TopHeader'
import OverviewContent from './OverviewContent'
import EventsPage from './EventsPage'
import SettingsPage from './SettingsPage'
import DrawerPanel from './DrawerPanel'
import { DrawerPanelProvider, useDrawerPanel } from './DrawerPanelContext'
import { SeatEditorGuardProvider, useSeatEditorGuard } from './SeatEditorGuardContext'
import { useCanAccess } from '../data/hooks'
import { GradientBackground } from './ui/favorites'

const DEFAULT_PANEL_WIDTH_PX = 448

export default function DashboardLayout() {
  // Top-level page switch (Overview vs Events) — separate from EventTabs'
  // Overview/Guests/Check-in/Reports sub-nav, which only exists *inside* the
  // 'overview' page. No react-router yet (matches the rest of this app), so
  // this is just which component <main> renders, same pattern as every
  // tab switch elsewhere in this codebase.
  const [page, setPage] = useState<DashboardPage>('overview')

  // DrawerPanelProvider has to sit above this whole shell (IconRail/
  // TopHeader/main all need to be able to open a drawer), but the panel's
  // *width* — read below in DashboardShell — is state that provider holds,
  // so the shell that lays out the grid track has to be a child of the
  // provider, not this component itself.
  return (
    <SeatEditorGuardProvider>
      <DrawerPanelProvider>
        <DashboardShell page={page} onNavigate={setPage} />
      </DrawerPanelProvider>
    </SeatEditorGuardProvider>
  )
}

function DashboardShell({ page, onNavigate }: { page: DashboardPage; onNavigate: (page: DashboardPage) => void }) {
  const { open: panelOpen, chrome } = useDrawerPanel()
  const panelWidthPx = chrome?.widthPx ?? DEFAULT_PANEL_WIDTH_PX
  const { requestNavigation } = useSeatEditorGuard()
  // Guarded — switching to the Events page unmounts OverviewContent (and
  // whatever seat map editor happens to be open several levels under it)
  // outright, with no tab of its own left behind to ask "wait, save first?"
  // the way EventTabs' own in-page switch at least has a chance to. Routing
  // every top-level nav click through the one shared guard (see
  // SeatEditorGuardContext) is what gives it that chance too, instead of
  // silently discarding-by-omission whatever the editor hadn't gotten to
  // yet.
  const guardedNavigate = useCallback((next: DashboardPage) => requestNavigation(() => onNavigate(next)), [requestNavigation, onNavigate])
  // Stable across renders (unlike a fresh inline arrow) — IconRail/TopHeader/
  // OverviewContent/EventsPage are all wrapped in memo specifically so a
  // DashboardShell re-render (this component reads `chrome`, which changes
  // on every open drawer's own footer/title update) doesn't cascade into
  // recreating THEIR props too — see TopHeader's own doc for the infinite
  // loop that produced when it did. An inline `() => onNavigate('overview')`
  // here would silently defeat that for EventsPage specifically, since memo
  // still re-renders when a prop is a genuinely new reference every time.
  const openOverview = useCallback(() => guardedNavigate('overview'), [guardedNavigate])
  // Defensive — the Settings nav item already locks for a role without
  // `roles` access (see IconRail), but this catches the one path around
  // that: already being on the Settings page when a role switch revokes
  // access mid-visit.
  const canOpenSettings = useCanAccess('roles')
  useEffect(() => {
    if (page === 'settings' && !canOpenSettings) onNavigate('overview')
  }, [page, canOpenSettings, onNavigate])

  return (
    // The true full-viewport element now — everything below this line used
    // to sit directly here (`h-dvh w-full`, no cap), stretching edge to edge
    // on any monitor no matter how wide. Past 1600px that read as loosely
    // composed rather than deliberate — a dashboard whose own width is just
    // "however wide the screen happens to be." This wrapper centers the
    // capped shell instead, and its own ink-900 background is what shows
    // through as the side bars once the viewport exceeds that cap — a
    // deliberate near-black brand navy (already used for text and dark
    // surfaces elsewhere, e.g. the seat map's dock), not a raw #000. A
    // `fixed inset-0` overlay (Modal/DrawerPanel's own mobile fallback/etc.)
    // still correctly spans the TRUE viewport, bars included — the right
    // look for a dialog dimming the whole screen, not just the capped column.
    <div className="flex h-dvh w-full justify-center bg-ink-900">
      {/* The chrome (rail + header) never scrolls, on ANY breakpoint — only
          <main> does. Used to be desktop-only (`lg:h-screen
          lg:overflow-hidden`, plain document scroll below that), which
          meant the rail/header rode away with the page on mobile. `h-full`
          (not its own `h-dvh`) — the outer wrapper above already resolved
          the real, current-viewport height (see its own doc for why that
          needs to be `dvh` not `vh`); this just fills whatever that came
          out to. `max-w-[1600px]` is the actual width cap — a no-op below
          that width (nothing to center, this already fills its parent), so
          every breakpoint below it (including every `lg:` rule right here)
          keeps behaving exactly as it did before this wrapper existed.
          bg-page (not bg-white) + lg:gap-3/lg:p-3 is what makes "Floating
          rail" actually float: IconRail and TopHeader both pick up their own
          rounded-corner + shadow treatment below (see each file), but a
          floating card only reads as floating if there's a gap around it
          showing something else underneath — this pale page tint is that
          something else. Mobile (`flex-col`, no gap/padding at that
          breakpoint) is untouched: the icon rail's own horizontal bar stays
          edge-to-edge there, matching how little of that width can be spared. */}
      <div className="relative isolate flex h-full w-full max-w-[1600px] flex-col overflow-hidden lg:flex-row lg:gap-3 lg:p-3">
        {/* GradientBackground positions itself via an inline `style` (not its
            `className`), so wrapping it here is required — passing
            `absolute inset-0` straight to the component would lose to that
            inline style and leave it in normal flex flow, squeezing every
            sibling below into a sliver instead of sitting behind them. */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <GradientBackground className="h-full w-full" />
        </div>

        <IconRail activePage={page} onNavigate={guardedNavigate} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:gap-3">
          <TopHeader />

          {/* Grid row so a drawer can push <main> aside instead of
              overlaying it — only ever affects <main>, never IconRail/
              TopHeader above, since both sit outside this row entirely. The
              grid track (not DrawerPanel itself) drives the width
              animation: a px-to-px `grid-template-columns` transition has
              well-defined start/end values, unlike animating a flex
              child's width to/from `auto`. Below `lg`, DrawerPanel falls
              back to a full-screen overlay (see its own file) — IconRail
              itself collapses to a horizontal bar at that width, so
              there's no room to reflow anything next to a panel. The
              two-column split is therefore `lg:`-only (`grid-cols-1` below
              it): a fixed-position child doesn't participate in grid flow,
              but the *container*'s track sizing still reserves whatever
              `grid-template-columns` says regardless of whether anything
              occupies that track, so without this, <main> would get
              squeezed by a phantom column on narrow viewports even though
              the panel is a full-screen overlay there, not a real grid
              occupant. `--panel-w` is a CSS custom property (not a literal
              template string) so the `lg:` column definition itself never
              needs touching from JS — only the variable's value does. It's
              registered via `@property` in index.css as an animatable
              `<length>`, and the transition is declared on `--panel-w`
              itself (not on `grid-template-columns`, which merely reads it
              via `var()` every frame) — Chromium/Safari/Firefox only
              interpolate a var()-driven property through the custom
              property's own transition, not the consuming property's.

              `@container` (Tailwind v4's built-in container-query utility,
              `container-type: inline-size`) turns <main>'s own rendered
              width — which this grid track genuinely shrinks whenever a
              drawer is open, unlike the outer viewport — into something
              descendants can actually respond to. Nested layouts that used
              a plain `lg:` (viewport-width) breakpoint stayed locked into
              their wide-screen shape even while squeezed by an open
              drawer, since `lg:` has no idea the drawer exists; switching
              those to `@5xl:` (an in-tree-container-relative variant, same
              1024px threshold as the `lg:` it replaces) makes them react to
              the space they actually have. See OverviewContent.tsx's own
              `@5xl:grid-cols-*` rows for the consuming side of this.

              Reverted back to this push/reflow mechanism per explicit
              request, after briefly trying a desktop overlay (see git
              history / DrawerPanel's own doc) specifically to avoid the
              per-frame reflow cost this animation carries on a busy tab —
              that tradeoff was accepted knowingly in exchange for getting
              the original "push" feel back. */}
          <div
            className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden transition-[--panel-w] duration-300 ease-out lg:grid-cols-[1fr_var(--panel-w)]"
            style={{ '--panel-w': `${panelOpen ? panelWidthPx : 0}px` } as CSSProperties}
          >
            <main
              id="dashboard-main"
              // lg:px-3/lg:py-3 (not the old lg:px-10/lg:py-10) — <main>
              // isn't its own floating card, but PageStage's card lives
              // *inside* it, so main's own edge padding stacks on top of
              // the 12px every other floating piece (rail/header/drawer)
              // already uses, pushing PageStage's card 40px further in on
              // every side than the header's or drawer's card sits. That's
              // what read as "still not aligned" even after unifying the
              // drawer's own padding — the header/drawer/PageStage cards
              // need to start at the *same* inset from the grid row's edges
              // to actually line up, and PageStage only ever gets there via
              // main's own padding, since PageStage itself has no margin of
              // its own.
              className="no-scrollbar @container min-h-0 min-w-0 overflow-y-auto px-5 py-6 pb-28 sm:px-8 lg:px-3 lg:py-3"
            >
              {page === 'overview' ? (
                <OverviewContent />
              ) : page === 'events' ? (
                <EventsPage onOpenEvent={openOverview} />
              ) : (
                <SettingsPage />
              )}
            </main>

            <DrawerPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
