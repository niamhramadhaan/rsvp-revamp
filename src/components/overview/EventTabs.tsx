import { useRef, type ComponentType, type SVGProps } from 'react'
import { CompassIcon, UsersIcon } from '../icons/NavIcons'
import { ChartIcon, SeatingChartIcon } from '../icons/UiIcons'
import { useCanAccess } from '../../data/hooks'
import { useSlidingIndicator } from '../../hooks/useSlidingIndicator'
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
export default function EventTabs({ activeKey, onTabChange }: EventTabsProps) {
  const desktopRef = useRef<HTMLDivElement>(null)
  const mobileRef = useRef<HTMLElement>(null)
  const desktopRect = useSlidingIndicator(desktopRef, activeKey)
  const mobileRect = useSlidingIndicator(mobileRef, activeKey)

  // Fixed number of hook calls (TABS is a static list) — can't call
  // useCanAccess inside the filter below, so each gated section is checked
  // up front instead.
  const canGuests = useCanAccess('guests')
  const canSeating = useCanAccess('seating')
  const canReports = useCanAccess('reports')
  const access: Record<DashboardSection, boolean> = {
    guests: canGuests,
    seating: canSeating,
    checkIn: true,
    reports: canReports,
    roles: true,
  }
  const visibleTabs = TABS.filter((tab) => !tab.section || access[tab.section])

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
              onClick={() => onTabChange(tab.key)}
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

      {/* `bottom` is set inline (not a `bottom-3` class) because the actual
          gap needs to be the larger of a fixed margin and the safe-area
          inset — a phone with a home indicator gets the indicator's own
          height as clearance instead of the dock sitting flush against it;
          a phone without one just gets the fixed 0.75rem margin. */}
      <nav
        ref={mobileRef}
        aria-label="Event sections"
        className="fixed inset-x-3 z-30 flex items-stretch gap-1 rounded-[28px] border border-white/60 bg-white/90 p-1.5 shadow-[0_16px_40px_-12px_rgba(16,30,51,0.35)] backdrop-blur-xl lg:hidden"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {mobileRect && (
          <div
            aria-hidden="true"
            // top-0 left-0 — same fix as the desktop pill above (see its own
            // doc): without an explicit base position, this absolute div's
            // implicit flex-item "static position" isn't reliably (0, 0),
            // which read as the pill sitting a little off from the tab
            // underneath it.
            className="absolute left-0 top-0 rounded-[22px] bg-nav-rail shadow-sm transition-[transform,width] duration-300 ease-out"
            style={{ width: mobileRect.width, height: mobileRect.height, transform: `translate(${mobileRect.left}px, ${mobileRect.top}px)` }}
          />
        )}
        {visibleTabs.map((tab) => {
          const isActive = tab.key === activeKey
          return (
            <button
              key={tab.key}
              data-tab-key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              aria-current={isActive ? 'page' : undefined}
              // flex-1 + min-h-[52px]: equal-width targets that together
              // span the dock, comfortably over the 44px touch
              // minimum. The active tab's own fill now comes from the
              // sliding indicator behind it (see above) rather than a class
              // toggled on the button itself.
              className={`relative z-10 flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] px-1 py-2 transition-colors active:scale-[0.96] ${
                isActive ? 'text-white' : 'text-icon-gray hover:text-ink-700'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span className={`truncate text-[11px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {tab.mobileLabel ?? tab.label}
              </span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
