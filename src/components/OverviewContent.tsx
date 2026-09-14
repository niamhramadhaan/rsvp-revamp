import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import PageStage from './PageStage'
import EventBanner from './overview/EventBanner'
import QuickActionsPanel from './overview/QuickActionsPanel'
import EventCountdownWidget from './overview/EventCountdownWidget'
import StatTiles from './overview/StatTiles'
import CheckInProgressRing from './overview/CheckInProgressRing'
import GuestListMiniWidget from './overview/GuestListMiniWidget'
import RecentActivityFeed, { RecentActivityTable } from './overview/RecentActivityFeed'
import RecentCheckinsWidget from './overview/RecentCheckinsWidget'
import EventTabs from './overview/EventTabs'
import GuestsView from './overview/GuestsView'
import SeatingView from './overview/SeatingView'
import ReportsView from './overview/ReportsView'
import GuestProfileDrawer from './overview/GuestProfileDrawer'
import EditEventDrawer from './overview/EditEventDrawer'
import InvitationTemplateDrawer from './overview/InvitationTemplateDrawer'
import AddGuestDrawer from './overview/AddGuestDrawer'
import SendInvitationsDrawer from './overview/SendInvitationsDrawer'
import DrawerPanelPortal from './DrawerPanelPortal'
import Toast, { type ToastState, type ToastTone } from './Toast'
import { useSeatEditorGuard } from './SeatEditorGuardContext'
import { ClockIcon } from './icons/UiIcons'
import { useCanAccess, useCurrentEvent, useGuests, useSeatMap } from '../data/hooks'
import { getGuestCounts, getGuestGroupLabel, getRecentActivity } from '../data/selectors'
import { unassignSeat } from '../data/seating'
import type { Event } from '../data/types'

// Lazy: CheckInDrawer pulls in html5-qrcode (the camera/QR+barcode decode
// engine), which alone is a few hundred kB — worth code-splitting since
// most visits to this dashboard never scan a ticket at all, and mobile
// connections (the ones staff actually use this on) are exactly where that
// cost matters most. There's no Check-in tab anymore (see EventTabs — its
// own "recent check-ins" log duplicated Overview's Recent Activity feed);
// QuickActionsPanel's "Open Check-in" is now the only launcher, but
// `scanDrawerMounted` still exists so the component isn't added to the tree
// (and its chunk downloaded) until that button is actually pressed, rather
// than loading it unconditionally just because `lazy()` is in scope.
const CheckInDrawer = lazy(() => import('./overview/CheckInDrawer'))

type OverviewTab = 'overview' | 'guests' | 'seating' | 'reports'

// The page's own hero headline (see this component's own doc further down
// for where it renders) — a time-of-day greeting rather than repeating the
// current event's name a third time (EventSwitcher's header already shows
// it, EventBanner's photo shows it again right below this), so this reads
// as a distinct "page voice" instead of a redundant caption.
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// The whole page is scoped to ONE event — whichever is currently selected via
// the TopHeader event switcher. Switching events, or creating a new one, both
// happen up there; nothing here reaches across events (see plan.md).
//
// The outer "glass stage" wrapper's frosted look is now opacity-only
// (bg-white/60, no backdrop-blur — see the comment further down for why
// that got dropped). The individual widgets below stay blur-free too,
// sitting as opaque-ish cards on top of this one tinted layer, not each
// blurring independently on top of it.
// Wrapped in memo — see TopHeader's own doc for why: DashboardShell (this
// component's parent) re-renders on every DrawerPanelContext `chrome`
// change, which without this cascaded into a full re-render of this whole
// page (recreating EditEventDrawer's/AddGuestDrawer's/etc. own inline
// footer/onClose props every time), feeding straight back into another
// `chrome` update. OverviewContent takes no props, so this is a pure win.
function OverviewContent() {
  const { requestNavigation } = useSeatEditorGuard()
  const [currentEvent] = useCurrentEvent()
  const guests = useGuests(currentEvent?.id)
  const { seatMap, seats, groups, layoutBlocks } = useSeatMap(currentEvent?.id)
  const [toast, setToast] = useState<ToastState | null>(null)
  const showToast = useCallback((message: string, tone: ToastTone = 'success') => setToast({ message, tone }), [])
  const [activeTab, setActiveTab] = useState<OverviewTab>('overview')
  // Falls back to Overview if the current role loses access to whatever
  // tab is open (e.g. an admin flips their own profile to Staff mid-visit
  // — see UserIdCardModal) rather than leaving a now-hidden tab rendered.
  const canGuests = useCanAccess('guests')
  const canSeating = useCanAccess('seating')
  const canReports = useCanAccess('reports')
  useEffect(() => {
    if (activeTab === 'guests' && !canGuests) setActiveTab('overview')
    else if (activeTab === 'seating' && !canSeating) setActiveTab('overview')
    else if (activeTab === 'reports' && !canReports) setActiveTab('overview')
  }, [activeTab, canGuests, canSeating, canReports])
  const [editEventOpen, setEditEventOpen] = useState(false)
  // Which guest's profile is open — owned here (not inside GuestsView/
  // SeatingView) so the same drawer instance/handlers work from every
  // surface that opens it (Overview's mini widget, the Guests tab, the
  // Seating tab's own guest dock) without duplicating GuestProfileDrawer
  // per surface.
  const [viewingGuestId, setViewingGuestId] = useState<string | null>(null)
  // Which event's invitation-template drawer is open — handed off from
  // EditEventDrawer's own button (see openInvitationTemplateDrawer below),
  // same shared-single-slot hand-off GuestProfileDrawer's own onViewTicket
  // used to do for the now-removed TicketDrawer.
  const [templateEvent, setTemplateEvent] = useState<Event | null>(null)
  // Whether CheckInDrawer has ever been requested — see the lazy-import
  // comment above for why this exists at all (keeping the component out of
  // the tree, not just deferring its own render, until first requested).
  // Once true it stays true; the drawer's own `open` prop is what actually
  // shows/hides it after that.
  const [scanDrawerMounted, setScanDrawerMounted] = useState(false)
  const [scanDrawerOpen, setScanDrawerOpen] = useState(false)
  // Owned here (not inside GuestsView) now that QuickActionsPanel's own
  // "Add Guests" button needs to open the exact same drawer/instance —
  // same "one shared drawer, several launchers" pattern viewingGuestId
  // above already uses for GuestProfileDrawer.
  const [addGuestOpen, setAddGuestOpen] = useState(false)
  const [sendInvitesOpen, setSendInvitesOpen] = useState(false)
  // Recent Activity's own "View all" — the full, unbounded feed in a side
  // drawer (see RecentActivityFeed's onViewAll doc), same shared-drawer
  // surface every other side panel here already uses.
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false)

  const counts = getGuestCounts(guests)
  // 20, not 5 — RecentActivityFeed's own list now scrolls inside a fixed-
  // height card (see that file) instead of being capped short, so there's
  // room to actually show more than a handful before an admin has to leave
  // Overview to see older activity.
  const activity = getRecentActivity(guests, 20)
  const seatById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats])
  // Guest.groupLabel is gone — a guest's "group" is derived from whichever
  // seat they're assigned to (see selectors.ts's getGuestGroupLabel and
  // types.ts's Guest doc), so this map is what GuestProfileDrawer reads that
  // back through (GuestsView's own table view derives it the same way, but
  // builds its own groupById from the same `groups` prop rather than
  // reaching across into this one).
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])
  const viewingGuest = viewingGuestId ? (guests.find((g) => g.id === viewingGuestId) ?? null) : null
  const viewingGuestSeatLabel = viewingGuest?.seatId ? (seatById.get(viewingGuest.seatId)?.label ?? null) : null
  const viewingGuestGroupLabel = viewingGuest ? (getGuestGroupLabel(viewingGuest, seatById, groupById) ?? null) : null

  // Every one of these opener functions is the ONLY way any drawer/side
  // panel here ever turns on — closeAllDrawers() runs first every time,
  // guaranteeing whichever one this call is actually opening gets a real
  // false→true edge on its own `open` prop, not a same-value no-op.
  //
  // Why that matters: the shared drawer surface (DrawerPanelContext) can
  // only ever show one owner's content at a time — its own openDrawer()
  // unconditionally steals the slot the moment ANY drawer's `open` prop
  // flips true, but closeDrawer() only clears the shared `open` flag, never
  // who's recognized as the owner. So a drawer that gets preempted (a
  // second one opens on top of it, without the first ever being closed)
  // keeps its OWN `open` prop stuck at `true` in this component's state —
  // invisible (it no longer owns the shared slot), but still `true`. The
  // next attempt to reopen that same drawer then calls e.g.
  // setScanDrawerOpen(true) while it's already `true`: React bails out of
  // an identical-value update, so no render happens, the drawer's
  // DrawerPanelPortal never re-fires its own open-changed effect, and
  // openDrawer() never gets called again — the drawer that looks "stuck"
  // is whichever one was last preempted rather than explicitly closed via
  // its own close button. Forcing every OTHER drawer's own boolean back to
  // false before opening a new one (the same explicit hand-off
  // handleViewTicket/handleBackToProfile already did for just the
  // Profile↔Ticket pair, generalized to every drawer here) means a drawer
  // is never left silently `true` in the background — reopening it later
  // always sees a genuine false→true transition.
  function closeAllDrawers() {
    setViewingGuestId(null)
    setTemplateEvent(null)
    setScanDrawerOpen(false)
    setAddGuestOpen(false)
    setEditEventOpen(false)
    setSendInvitesOpen(false)
    setActivityDrawerOpen(false)
  }

  function handleViewProfile(guestId: string) {
    closeAllDrawers()
    setViewingGuestId(guestId)
  }

  // Handed off from EditEventDrawer's own "Edit invitation template"
  // button — closes it first (see closeAllDrawers' own doc on why every
  // opener does that) and opens this drawer for the same event instead.
  function openInvitationTemplateDrawer(event: Event) {
    closeAllDrawers()
    setTemplateEvent(event)
  }

  function openScanDrawer() {
    closeAllDrawers()
    setScanDrawerMounted(true)
    setScanDrawerOpen(true)
  }

  function openAddGuestDrawer() {
    closeAllDrawers()
    setAddGuestOpen(true)
  }

  function openEditEventDrawer() {
    closeAllDrawers()
    setEditEventOpen(true)
  }

  function openSendInvitesDrawer() {
    closeAllDrawers()
    setSendInvitesOpen(true)
  }

  function openActivityDrawer() {
    closeAllDrawers()
    setActivityDrawerOpen(true)
  }

  function handleUnassignSeat(guestId: string) {
    const guest = guests.find((g) => g.id === guestId)
    unassignSeat(guestId).then(() => showToast(`${guest?.name ?? 'Guest'} unassigned`))
  }

  // Every tab renders inside the same scrollable <main> (see DashboardLayout
  // — there's no routing yet, so tabs don't get a fresh scroll position for
  // free the way separate pages would). This used to also force-scroll
  // #dashboard-main back to top on every switch — removed per explicit
  // request: an admin scrolled partway down one tab and switching to
  // another shouldn't yank the viewport back to the top on its own.
  // Guarded — leaving the Seating tab while its editor still has unsaved
  // layout changes doesn't just hide them, it needs to ask first (see
  // SeatEditorGuardContext); requestNavigation runs the actual tab switch
  // right away when there's nothing to guard against, same as before.
  function handleTabChange(key: string) {
    requestNavigation(() => setActiveTab(key as OverviewTab))
  }

  return (
    <>
      <PageStage>
        <div className="flex flex-col gap-6">
          {/* Hero is greeting + event name only — the old Live/date/
              Seating-map pill cluster on the right was removed per
              request: status already reads off the event everywhere else,
              and seating has its own tab. Persistent across every tab, not
              just Overview, the same way EventBanner/QuickActionsPanel
              right below it already are — page-level chrome, not
              Overview-tab content. */}
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">{getGreeting()}</h1>
            <p className="mt-1.5 text-sm text-muted">
              {currentEvent ? currentEvent.name : 'Select or create an event to get started.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 @5xl:grid-cols-[1fr_280px] @5xl:items-start">
            <EventBanner event={currentEvent} onEdit={openEditEventDrawer} />
            <QuickActionsPanel
              onOpenCheckIn={openScanDrawer}
              onOpenAddGuest={openAddGuestDrawer}
              onOpenSendInvites={openSendInvitesDrawer}
            />
          </div>

          <EventTabs activeKey={activeTab} onTabChange={handleTabChange} onScan={openScanDrawer} />

          {activeTab === 'overview' && (
            <>
              <StatTiles counts={counts} />

              {/* Countdown + check-in progress side by side — both are
                  "where do things stand right now" gauges, so pairing them
                  reads as one glance instead of two separate full-width
                  rows stacked underneath each other. items-stretch (the
                  grid default, so no explicit class needed) rather than
                  items-start — the two cards' own content never matches in
                  height by coincidence, so both components stretch their
                  own card to fill the row instead of sizing to content. */}
              <div className="grid grid-cols-1 gap-6 @5xl:grid-cols-2">
                <EventCountdownWidget event={currentEvent} />
                <CheckInProgressRing checkedIn={counts.checkedIn} total={counts.total} />
              </div>

              {/* Seat map's own mini-preview was dropped from Overview per
                  request (SeatMapCanvas — now a free-form, editable
                  canvas — is the real place to look at it, one tab over) —
                  Guest list pairs with Recent activity instead, keeping this
                  row a clean, even two-up like the one above it rather than
                  leaving a lopsided gap where the seat map used to sit. */}
              <div className="grid grid-cols-1 gap-6 @5xl:grid-cols-2 @5xl:items-start">
                <GuestListMiniWidget
                  guests={guests}
                  onViewAll={() => handleTabChange('guests')}
                  onViewProfile={handleViewProfile}
                />
                <RecentActivityFeed activity={activity} onViewAll={openActivityDrawer} />
              </div>

              <RecentCheckinsWidget guests={guests} onViewProfile={handleViewProfile} />
            </>
          )}

          {activeTab === 'guests' && (
            <GuestsView
              eventId={currentEvent?.id ?? null}
              guests={guests}
              seatById={seatById}
              groups={groups}
              onToast={showToast}
              onViewProfile={handleViewProfile}
              onAddGuest={openAddGuestDrawer}
            />
          )}

          {activeTab === 'seating' && (
            <SeatingView
              eventId={currentEvent?.id ?? null}
              guests={guests}
              seatMap={seatMap}
              seats={seats}
              groups={groups}
              layoutBlocks={layoutBlocks}
              onToast={showToast}
              onViewProfile={handleViewProfile}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              eventName={currentEvent?.name ?? 'Event'}
              guests={guests}
              seats={seats}
              groups={groups}
              onToast={showToast}
              onViewProfile={handleViewProfile}
            />
          )}
        </div>
      </PageStage>

      <GuestProfileDrawer
        guest={viewingGuest}
        seatLabel={viewingGuestSeatLabel}
        groupLabel={viewingGuestGroupLabel}
        onClose={() => setViewingGuestId(null)}
        onUnassignSeat={handleUnassignSeat}
        onToast={showToast}
      />

      {scanDrawerMounted && (
        <Suspense fallback={null}>
          <CheckInDrawer
            open={scanDrawerOpen}
            onClose={() => setScanDrawerOpen(false)}
            guests={guests}
            seats={seats}
            groups={groups}
            event={currentEvent}
            onToast={showToast}
          />
        </Suspense>
      )}

      <EditEventDrawer
        event={editEventOpen ? currentEvent : null}
        onClose={() => setEditEventOpen(false)}
        onSaved={(event) => showToast(`"${event.name}" updated`)}
        onOpenInvitationTemplate={openInvitationTemplateDrawer}
      />

      <InvitationTemplateDrawer
        event={templateEvent}
        onClose={() => setTemplateEvent(null)}
        onSaved={(event) => showToast(`"${event.name}" invitation template updated`)}
      />

      <AddGuestDrawer
        open={addGuestOpen}
        onClose={() => setAddGuestOpen(false)}
        eventId={currentEvent?.id ?? null}
        onCreated={(guest) => showToast(`${guest.name} added`)}
        onBulkCreated={(created, duplicates) =>
          showToast(
            `${created.length} guest${created.length === 1 ? '' : 's'} imported${
              duplicates > 0 ? ` · ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped` : ''
            }`,
            duplicates > 0 ? 'warning' : 'success'
          )
        }
      />

      <SendInvitationsDrawer
        open={sendInvitesOpen}
        onClose={() => setSendInvitesOpen(false)}
        guests={guests}
        event={currentEvent}
        onEditTemplate={() => {
          // Same shared-single-slot hand-off as openInvitationTemplateDrawer
          // — the template is written in that drawer, so this one closes
          // first rather than stacking behind it.
          if (currentEvent) openInvitationTemplateDrawer(currentEvent)
        }}
        onToast={showToast}
      />

      {/* Recent Activity's own "View all" — the full feed (getRecentActivity
          with no limit, unlike the mini-widget's own capped `activity`) as
          its own real table (RecentActivityTable, not RecentActivityFeed's
          card-of-rows) inside the shared drawer surface every other side
          panel here uses. No title of its own — DrawerPanelPortal's chrome
          already reads "Recent activity". */}
      <DrawerPanelPortal open={activityDrawerOpen} onClose={() => setActivityDrawerOpen(false)} title="Recent activity" icon={ClockIcon}>
        <RecentActivityTable activity={getRecentActivity(guests)} />
      </DrawerPanelPortal>

      <Toast toast={toast} />
    </>
  )
}

export default memo(OverviewContent)
