import { memo, useCallback, useState, type ComponentType, type SVGProps } from 'react'
import { HouseIcon, TicketIcon, UsersIcon, PowerIcon, UserIcon } from './icons/NavIcons'
import { LockIcon } from './icons/UiIcons'
import LogoutModal from './LogoutModal'
import UserIdCardModal from './UserIdCardModal'
import Toast, { type ToastState, type ToastTone } from './Toast'
import Tooltip from './Tooltip'
import { useCanAccess, useProfile } from '../data/hooks'
import { signOut } from '../data/session'

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

/** The top-level destinations this rail switches between — see
 * DashboardLayout. Separate from EventTabs' Overview/Guests/Check-in/Reports
 * sub-nav, which only ever applies *inside* the 'overview' page (one
 * event's dashboard); Events/Settings are their own pages. 'settings' isn't
 * one of NAV_ITEMS below (it's the utility-group "Users & Roles" button, not
 * a main nav item) — see this file's own doc further down. Kept as the
 * literal value 'settings' (not renamed to match the visible label) since
 * it's threaded through useCanAccess/SettingsPage/DashboardLayout as an
 * internal key, not display text. */
export type DashboardPage = 'overview' | 'events' | 'settings'

interface NavItem {
  icon: IconComponent
  label: string
  page: DashboardPage
}

const NAV_ITEMS: NavItem[] = [
  { icon: HouseIcon, label: 'Overview', page: 'overview' },
  { icon: TicketIcon, label: 'Events', page: 'events' },
]

interface NavButtonProps {
  icon: IconComponent
  label: string
  active?: boolean
  /** The lg: desktop column's own icon-color scheme — dark icons on a
   * translucent glass capsule (see this file's own doc on the desktop
   * layout below), instead of the mobile bar's solid-blue/white-icon
   * pairing. Kept as one shared button rather than two near-duplicate
   * components since the only real difference is which few classes apply. */
  glass?: boolean
  className?: string
  onClick?: () => void
  /** Visible but unreachable — swaps in a lock glyph and disables the
   * click, rather than hiding the button outright (Users & Roles is a
   * persistent nav item, not a per-event tab, so it stays discoverable
   * even for a role that can't open it — see IconRail's own doc). */
  locked?: boolean
}

function NavButton({ icon: Icon, label, active, glass, className = '', onClick, locked }: NavButtonProps) {
  return (
    // hidden lg:block on the bubble (via Tooltip's own bubbleClassName) —
    // no tooltip below lg:, where this rail lays out horizontally along the
    // top instead of down the side, and there's no hover to trigger it on
    // touch anyway. hoverOnly — a click leaves the button focused (the
    // ordinary browser default), and this rail's tooltip is a hover hint
    // only; see Tooltip's own doc for why that's an explicit opt-out here
    // rather than the shared default.
    <Tooltip label={locked ? `${label} — Admin only` : label} placement="right" bubbleClassName="hidden lg:block" hoverOnly>
      <button
        type="button"
        aria-label={label}
        aria-disabled={locked}
        onClick={locked ? undefined : onClick}
        className={`flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-[0.97] ${
          locked ? 'cursor-not-allowed opacity-40' : ''
        } ${
          active
            ? glass
              ? // The glass capsule's own active state — a solid nav-rail-
                // blue pill, the same "active = one solid colored pill"
                // language EventTabs' own sliding indicator uses, rather
                // than the mobile bar's white-on-blue pairing (which would
                // vanish against this capsule's own near-white glass fill).
                'bg-nav-rail text-white shadow-sm'
              : 'bg-white text-ink-900 shadow-sm'
            : className ||
              (glass
                ? // Dark icon on translucent glass — the same "dark text
                  // on a light glass card" pairing every other glass
                  // surface in this app uses (GLASS_CARD's own ink-900
                  // text), rather than the mobile bar's constant white
                  // (which only clears contrast against a solid, fully
                  // opaque blue fill, not a near-white frosted one).
                  'text-ink-900/70 hover:bg-black/5'
                : // Icon color stays a constant, fully-opaque white rather
                  // than dimming for the inactive state — against the
                  // mobile bar's solid rail fill (mixed toward white for a
                  // gentler surface, see index.css), even solid white only
                  // clears ~3.5:1, with no headroom left to dim it further
                  // and still clear the 3:1 floor for a non-text icon.
                  // Hover is signaled by a background wash instead of a
                  // color change, which sidesteps that ceiling entirely.
                  'text-white hover:bg-white/15')
        }`}
      >
        {locked ? <LockIcon className="h-4 w-4" /> : <Icon className="h-5 w-5" />}
      </button>
    </Tooltip>
  )
}

export interface IconRailProps {
  activePage: DashboardPage
  onNavigate: (page: DashboardPage) => void
}

// Wrapped in memo — see TopHeader's own doc for the DashboardShell/
// DrawerPanelContext cascade this guards against. `onNavigate` is
// DashboardLayout's own `setPage` (a useState setter, intrinsically
// stable), so a plain shallow-props comparison is safe here.
function IconRail({ activePage, onNavigate }: IconRailProps) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const showToast = useCallback((message: string, tone: ToastTone = 'success') => setToast({ message, tone }), [])
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [profile] = useProfile()
  const [idCardOpen, setIdCardOpen] = useState(false)
  // "Users & Roles" (see SettingsPage) is just accounts + the permission
  // matrix now, an admin-only concern, so the whole menu locks rather than
  // one section inside it. `canOpenSettings`/`'settings'` names kept as-is —
  // only the visible label changed, not the DashboardPage/permission key.
  const canOpenSettings = useCanAccess('roles')

  return (
    <>
      {/* Mobile/tablet (<lg): a floating glass bar — the same white-glass
          capsule language the desktop rail and the bottom dock already use
          (not the old solid-blue edge-to-edge strip), with safe-area margin
          above it. Carries the profile avatar too now that TopHeader (its
          old home) is desktop-only — tapping it opens the same ID card. */}
      <aside className="mx-3 mt-[max(0.75rem,env(safe-area-inset-top))] flex shrink-0 items-center justify-between gap-2 rounded-[28px] border border-white/60 bg-white/90 px-3 py-2 shadow-[0_16px_40px_-12px_rgba(16,30,51,0.35)] backdrop-blur-xl lg:hidden">
        {/* The real Gamefinity brand mark (served straight from /public,
            same convention TicketCard's own footer logo already uses) —
            not LogoMark's hand-drawn abstract triangle, which stays put
            purely as a small tintable watermark on the ticket stub (it
            relies on currentColor/opacity there in a way a raster PNG
            can't do). */}
        <img src="/gamefinity icon.png" alt="Gamefinity" className="h-8 w-8 shrink-0 object-contain" />

        <nav className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.label}
              icon={item.icon}
              label={item.label}
              glass
              active={item.page === activePage}
              onClick={() => onNavigate(item.page)}
            />
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <NavButton
            icon={UsersIcon}
            label="Users & Roles"
            glass
            active={activePage === 'settings'}
            locked={!canOpenSettings}
            onClick={() => onNavigate('settings')}
          />
          {/* Photo only — moved here from TopHeader when that header went
              desktop-only: a phone still needs a way to open its ID card. */}
          <button
            type="button"
            onClick={() => setIdCardOpen(true)}
            aria-label="Profile"
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/5 text-icon-gray transition active:scale-[0.97]"
          >
            {profile.imageUrl ? (
              <img src={profile.imageUrl} alt={profile.name} className="h-full w-full object-cover" />
            ) : (
              <UserIcon className="h-5 w-5" />
            )}
          </button>
          <NavButton
            icon={PowerIcon}
            label="Log out"
            glass
            className="text-ink-900/70 hover:bg-status-declined hover:text-white"
            onClick={() => setLogoutOpen(true)}
          />
        </div>
      </aside>

      {/* Desktop (lg+): the nav icons and the utility group each get their
          own separate floating glass capsule (picked up from a reference
          stacked-sidebar layout) rather than one tall solid-blue card
          holding everything the way the mobile bar above still does.
          `rounded-full` on both: at this aspect ratio (narrow, tall) it
          renders as a stadium shape (flat sides, semicircle caps) — reads
          as "fully rounded" the same way the mobile bar's pill-shaped
          active state does, not a plain rounded-3xl rectangle.
          Glassmorphism, not the old solid bg-nav-rail fill: a translucent
          white + backdrop-blur + soft border/shadow, matching this app's
          own GLASS_CARD language (see cardChrome.ts) elsewhere, adapted
          here for a capsule that floats directly on the shell's own
          animated blue/cyan glow background rather than sitting on a solid
          card underneath it — the blur is what actually lets that glow
          read through instead of just tinting a flat fill. */}
      <div className="relative hidden shrink-0 lg:flex lg:w-[100px] lg:flex-col lg:items-center lg:gap-3 lg:pt-[max(1.5rem,env(safe-area-inset-top))] lg:pb-6">
        {/* The Gamefinity brand mark — sits on its own at the very top of
            this column, at roughly the same height as TopHeader's own
            content right beside it (both columns share the same shell-level
            top offset — see DashboardShell's own lg:p-3), rather than
            living inside the nav capsule below it the way earlier
            revisions had it. */}
        <img src="/gamefinity icon.png" alt="Gamefinity" className="h-9 w-9 shrink-0 object-contain" />

        {/* flex-1 + centered content — brings the nav capsule down to the
            vertical center of whatever space isn't claimed by the logo
            above and the utility capsule pinned below it, rather than
            pinning it to the very top the way the old single-card rail
            (and every revision before this one) always did. */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <nav className="flex w-fit flex-col items-center gap-3 rounded-full border border-white/50 bg-white/25 px-3.5 py-5 shadow-[0_20px_50px_-20px_rgba(16,30,51,0.35)] backdrop-blur-md">
            {NAV_ITEMS.map((item) => (
              <NavButton
                key={item.label}
                icon={item.icon}
                label={item.label}
                active={item.page === activePage}
                glass
                onClick={() => onNavigate(item.page)}
              />
            ))}
          </nav>
        </div>

        {/* Bottom-pinned via lg:mt-auto — same "one flexible gap, everything
            below it pinned to the column's own bottom edge" idea the old
            single-card rail's own utility group already used; the sibling
            above now claims that flexible space itself (flex-1) rather
            than a bare spacer doing it. */}
        <div className="flex w-fit flex-col gap-3 rounded-full border border-white/50 bg-white/25 px-3.5 py-4 shadow-[0_20px_50px_-20px_rgba(16,30,51,0.35)] backdrop-blur-md lg:mt-auto">
          <NavButton
            icon={UsersIcon}
            label="Users & Roles"
            glass
            active={activePage === 'settings'}
            locked={!canOpenSettings}
            onClick={() => onNavigate('settings')}
          />
          <NavButton
            icon={PowerIcon}
            label="Log out"
            glass
            // Same destructive-action token this app's own "irreversible
            // action" buttons already share (Button.tsx's destructive
            // variant) — a solid status-declined fill only on hover/focus,
            // dark icon at rest to match this capsule's other glass icons.
            className="text-ink-900/70 hover:bg-status-declined hover:text-white"
            onClick={() => setLogoutOpen(true)}
          />
        </div>
      </div>

      <Toast toast={toast} />

      <UserIdCardModal open={idCardOpen} onClose={() => setIdCardOpen(false)} />

      <LogoutModal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false)
          // Clearing the session key drops App back to the login gate via
          // its own useSessionUser subscription — no navigation needed.
          signOut()
          showToast('Logged out')
        }}
      />
    </>
  )
}

export default memo(IconRail)
