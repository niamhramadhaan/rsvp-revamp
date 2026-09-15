import { useRef, useState, type ComponentType, type SVGProps } from 'react'
import { CompassIcon, UsersIcon } from '../icons/NavIcons'
import { ChartIcon, SeatingChartIcon, QrCheckIcon } from '../icons/UiIcons'
import { useCanAccess, useCurrentEvent } from '../../data/hooks'
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator'
import { playSound } from '../../utils/sound'
import { EventSwitchSheet } from '../EventSwitcher'
import type { DashboardSection } from '../../data/types'

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

interface EventTab {
  key: string
  label: string
  /** Shorter label for the mobile bottom bar, where four equal-width
   * flex-1 slots leave far less room per tab than the desktop pill row. */
  mobileLabel?: string
  icon: IconComponent
  /** Gates this tab via useCanAccess (RolesDrawer's own permission matrix)
   * — omitted (Overview) means always visible. */
  section?: DashboardSection
}

// This event's sub-navigation — Overview and Guests & Seating are one
// event's dashboard (see plan.md: "Overview is one event's dashboard").
// "Guests" and "Seat Map" used to be two separate placeholder tabs, then one
// merged "Guests & Seating" tab (guest list + seat map side by side) — split
// back into two real tabs, but for a different reason than the original
// placeholders: Guests is now the full roster (card/table view, no seat
// map competing for space, see GuestsView), and Seating is the seat map
// alone, full width, with its own floating guest dock for drag-to-seat
// assignment (see SeatingView/GuestDock) — two different jobs (browse/manage
// guests vs. arrange a floor plan) that turned out to want two different
// layouts, not one cramped split-screen doing both at once. Reports
// (attendance report — ReportsView) is real too. Check-in used to be a
// fourth tab here (CheckInView) — removed: its own "recent check-ins" log
// was a duplicate of Overview's Recent Activity feed (which already logs
// every checked_in event), and its scan launcher button is now just
// QuickActionsPanel's "Open Check-in" opening CheckInDrawer directly as a
// modal — check-in doesn't need a whole tab of its own to get there anymore.
const TABS: EventTab[] = [
  { key: 'overview', label: 'Overview', icon: CompassIcon },
  { key: 'guests', label: 'Guests', icon: UsersIcon, section: 'guests' },
  { key: 'seating', label: 'Seating', icon: SeatingChartIcon, section: 'seating' },
  { key: 'reports', label: 'Reports', icon: ChartIcon, section: 'reports' },
]

export interface EventTabsProps {
  activeKey: string
  onTabChange: (key: string) => void
  /** Opens the check-in scan flow (CheckInDrawer, owned by OverviewContent)
   * — rendered as its own slot in the mobile dock only. Omitted (desktop
   * pill row) means no scan slot: desktop already reaches the same drawer
   * from Quick actions. */
  onScan?: () => void
}

// useSlidingIndicator now lives in src/hooks (see that file's own doc) —
// other tab-like toggles across the app want this exact same sliding-pill
// feel now, not just this one.

// Two renderings of the same four tabs/active state, gated by breakpoint —
// not two components, so there's exactly one source of truth for the tab
// list. Below `lg`, staff get a floating dock (inset from every edge with
// its own margin, fully rounded, elevated on a real shadow — the "one
// object hovering over the page" read of a native dock, not a bar that's
// simply part of the page chrome); at `lg` and up it's the existing glass
// pill row inline in the page, since a desktop pointer doesn't need a
// thumb-zone dock at all. `DashboardLayout`'s <main> reserves bottom
// padding (`pb-28`) so scrolled content never ends up hidden behind it —
// generous enough that it still clears the dock now that the dock is
// shorter than the old flush bar was.
export default function EventTabs({ activeKey, onTabChange, onScan }: EventTabsProps) {
  const desktopRef = useRef<HTMLDivElement>(null)
  const mobileRef = useRef<HTMLDivElement>(null)
  const desktopRect = useSlidingIndicator(desktopRef, activeKey)
  const mobileRect = useSlidingIndicator(mobileRef, activeKey)

  // Fixed number of hook calls (TABS is a static list) — can't call
  // useCanAccess inside the filter below, so each gated section is checked
  // up front instead.
  const canGuests = useCanAccess('guests')
  const canSeating = useCanAccess('seating')
  const canReports = useCanAccess('reports')
  const canCheckIn = useCanAccess('checkIn')
  const access: Record<DashboardSection, boolean> = {
    guests: canGuests,
    seating: canSeating,
    checkIn: canCheckIn,
    reports: canReports,
    roles: true,
  }
  const visibleTabs = TABS.filter((tab) => !tab.section || access[tab.section])
  // The dock's own scan slot.
  const showScan = canCheckIn && onScan !== undefined
  // Staff get the same section tabs as admin here (Overview/Guests/Seating/
  // Reports) — whatever visibleTabs already resolves via useCanAccess, same
  // as the desktop pill row. Scan is still the one thing pinned outside the
  // scrollable menu (see showScan below), not folded into this list.
  const mobileTabs = visibleTabs
  // The dock's own event slot — the current event's mark, opening the same
  // switch sheet the desktop header's name trigger opens. Lives inside the
  // scrollable menu (not a separate floating circle) so it can never
  // overlap page content the way that circle did.
  const [currentEvent] = useCurrentEvent()
  const [eventSheetOpen, setEventSheetOpen] = useState(false)

  function handleTabChange(key: string) {
    if (key !== activeKey) playSound('select')
    onTabChange(key)
  }

  return (
    <>
      <div ref={desktopRef} className="relative hidden flex-wrap gap-1.5 rounded-2xl border border-white/60 bg-white/85 p-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)] lg:flex">
        {/* The one floating pill — slides/resizes to whichever button is
            active instead of each button separately owning its own "am I
            active" background, so switching tabs reads as one object
            travelling between slots rather than two flat recolors. */}
        {desktopRect && (
          <div
            aria-hidden="true"
            // top-0 left-0: load-bearing, not decorative — this div is
            // `absolute` with no explicit top/left of its own, and it's
            // ALSO the first child of a `flex flex-wrap` container. With
            // top/left left at their `auto` default, the browser falls back
            // to this element's own "static position" (roughly where it'd
            // sit as an ordinary flex item) as the base the translate()
            // below then offsets from — which isn't reliably (0, 0), so the
            // whole pill rendered a few pixels off from the real button
            // underneath it. Pinning both to 0 makes translate(left, top)
            // the ONLY thing positioning this div, matching the buttons'
            // own measured offsetLeft/offsetTop exactly.
            className="absolute left-0 top-0 rounded-xl bg-nav-rail shadow-sm transition-[transform,width] duration-300 ease-out"
            style={{ width: desktopRect.width, height: desktopRect.height, transform: `translate(${desktopRect.left}px, ${desktopRect.top}px)` }}
          />
        )}
        {visibleTabs.map((tab) => {
          const isActive = tab.key === activeKey
          return (
            <button
              key={tab.key}
              data-tab-key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`relative z-10 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors active:scale-[0.97] ${
                isActive ? 'text-white' : 'text-ink-900/70 hover:bg-white/40 hover:text-ink-900'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Mobile dock — modern translucent dark glass: a diagonal ink wash
          (not one flat fill) under heavy blur, with a bright inner top
          highlight catching light along its upper edge — the same
          light-from-above treatment the floating rail capsules carry.
          Inside: a horizontally scrollable menu on the left (tabs keep
          fixed-width slots, so an admin's full set scrolls instead of
          crushing) and a filled Scan pill pinned right.
          `bottom` is set inline (not a `bottom-3` class) because the actual
          gap needs to be the larger of a fixed margin and the safe-area
          inset — a phone with a home indicator gets the indicator's own
          height as clearance instead of the dock sitting flush against it;
          a phone without one just gets the fixed 0.75rem margin. */}
      <nav
        aria-label="Event sections"
        className="fixed inset-x-3 z-30 flex items-center gap-2 rounded-[28px] border border-white/15 bg-gradient-to-b from-ink-900/90 to-ink-800/70 p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_16px_40px_-12px_rgba(16,30,51,0.5)] backdrop-blur-2xl lg:hidden"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div ref={mobileRef} className="no-scrollbar relative flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto">
          {mobileRect && (
            <div
              aria-hidden="true"
              // top-0 left-0 — same fix as the desktop pill above (see its
              // own doc): without an explicit base position, this absolute
              // div's implicit flex-item "static position" isn't reliably
              // (0, 0), which read as the pill sitting a little off from
              // the tab underneath it. Lives inside the scroll container
              // itself, so it scrolls along with the list rather than
              // floating detached from it.
              className="absolute left-0 top-0 rounded-2xl bg-nav-rail shadow-sm transition-[transform,width] duration-300 ease-out"
              style={{ width: mobileRect.width, height: mobileRect.height, transform: `translate(${mobileRect.left}px, ${mobileRect.top}px)` }}
            />
          )}
          {/* Event slot — first in the scroll row, logo only. */}
          <button
            type="button"
            onClick={() => setEventSheetOpen(true)}
            aria-label={currentEvent ? `Switch event (current: ${currentEvent.name})` : 'Switch event'}
            className="relative z-10 flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 transition active:scale-95 active:bg-white/10"
          >
            {currentEvent?.logoUrl ? (
              <img src={currentEvent.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-white/10 text-xs font-bold text-white">
                {currentEvent
                  ? currentEvent.name
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0].toUpperCase())
                      .join('')
                  : '?'}
              </span>
            )}
          </button>
          {mobileTabs.map((tab) => {
            const isActive = tab.key === activeKey
            return (
              <button
                key={tab.key}
                data-tab-key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                aria-current={isActive ? 'page' : undefined}
                // Fixed-width slots (not flex-1): the row scrolls instead
                // of squeezing, comfortably over the 44px touch minimum.
                // The active fill comes from the sliding pill behind (see
                // above), never from a class on the button itself — the
                // press flash (active:bg-white/10) is the tap's own
                // feedback, separate from selection.
                className={`relative z-10 flex min-h-[52px] w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-2 transition-colors active:scale-[0.96] active:bg-white/10 ${
                  isActive ? 'text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span className={`truncate text-[11px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {tab.mobileLabel ?? tab.label}
                </span>
              </button>
            )
          })}
        </div>
        {/* Scan — pinned right, outside the scroll row: a filled accent
            pill (icon + label) with a slow breathing glow so the dock's
            one primary action reads as alive. Deliberately NOT one of the
            sliding-pill tabs — it opens the scan drawer rather than
            switching to a section, so the pill correctly stays put on the
            current tab instead of following it. */}
        {showScan && (
          <button
            type="button"
            onClick={onScan}
            aria-label="Scan tickets"
            className="flex h-14 shrink-0 items-center gap-2 rounded-full bg-accent-700 px-5 text-white transition active:scale-[0.97] hover:brightness-110"
            style={{ animation: 'scan-glow 2.4s ease-in-out infinite' }}
          >
            <QrCheckIcon className="h-5 w-5" />
            <span className="text-sm font-semibold">Scan</span>
          </button>
        )}
      </nav>

      <EventSwitchSheet open={eventSheetOpen} onClose={() => setEventSheetOpen(false)} />
    </>
  )
}
