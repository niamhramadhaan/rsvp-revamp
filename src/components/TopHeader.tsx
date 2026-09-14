import { memo, useEffect, useState } from 'react'
import { CalendarIcon, FullscreenEnterIcon, FullscreenExitIcon } from './icons/UiIcons'
import { UserIcon } from './icons/NavIcons'
import UserIdCardModal from './UserIdCardModal'
import DrawerPanelPortal from './DrawerPanelPortal'
import CalendarCard from './CalendarCard'
import EventSwitcher from './EventSwitcher'
import IconButton from './IconButton'
import { useProfile } from '../data/hooks'

// Wrapped in memo: DashboardShell (its parent) re-renders on every
// DrawerPanelContext `chrome` change — i.e. every time ANY open drawer
// re-registers its footer/title — and without this, that cascaded down into
// TopHeader too, recreating its own inline `onClose`/etc. closures on every
// one of those renders. Since DrawerPanelPortal's own registration effect
// reacts to exactly those props changing, that fed right back into another
// `chrome` update — a genuine infinite render loop (confirmed via
// dashboard-load-then-idle profiling; the same reproduced with the Calendar
// drawer alone, so it wasn't specific to any one feature). No props any
// more (used to take `onOpenSettings` for UserIdCardModal's own Settings
// button, since removed — see that file's own doc) — memo here still only
// re-renders for its own state/context.
function TopHeader() {
  const [profile] = useProfile()
  const [idCardOpen, setIdCardOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }

  return (
    // "Floating rail" companion piece — at lg:, this becomes its own
    // rounded, shadow-lifted card (matching IconRail) instead of a flat bar
    // flush against the top edge, sitting in the gap DashboardLayout's own
    // lg:gap-3 creates. It needs an explicit bg-cream now: previously it
    // just inherited the shell's own white canvas since header and page sat
    // flush together with nothing between them, but the shell's base color
    // moved to a page tint (see DashboardLayout) precisely so that gap
    // would show through — cream (not white) is the later "warm card on
    // cool page" pass, see --color-cream in index.css. Below lg:, unchanged
    // — still the flat, edge-to-edge bar with a hairline bottom border it
    // always was.
    //
    // Composition (picked over two other options in a design review): a
    // plain icon row, no grouped pills or dividers between icons — the
    // simplest of the three. It started as "search-forward" (built around a
    // wide guest-search field), but the search itself — GlobalGuestSearch,
    // a cross-event lookup — was dropped per request; GuestSeatingList's own
    // per-event search already covers the common case, and this app has no
    // other cross-event guest lookup surface, so removing it from the
    // header was a clean cut rather than needing to be re-homed elsewhere.
    <header className="relative flex h-[72px] shrink-0 items-center justify-between gap-3 border-b border-black/5 bg-cream px-5 sm:px-8 lg:h-[89px] lg:rounded-3xl lg:border-b-0 lg:px-10 lg:shadow-[0_20px_50px_-20px_rgba(16,30,51,0.35)]">
      {/* `gap-3` guarantees breathing room between the event name and the
          icon/avatar cluster even at their narrowest — without it,
          `justify-between` only keeps them from overlapping, so a long
          truncated title ends up hugging the icons with zero space between,
          which is what actually read as "cramped" on mobile (not the icons'
          own size, which were already touch-target-correct). */}
      <EventSwitcher />

      {/* shrink-0 is load-bearing: without it, this cluster is just as
          shrinkable as EventSwitcher's side by default (`justify-between`
          alone doesn't protect either child from shrinking, only from
          overlapping when there's already enough room). Under real width
          pressure the cluster's own box could shrink narrower than its
          fixed-size children (44px icon buttons, 32px avatar) need — and
          since flex-shrink only resizes the *box*, not the fixed-size
          children inside it, those children then spill past the shrunk
          box's left edge, visually overlapping the event name they're
          supposed to sit clear of. shrink-0 forces 100% of any shrinking
          onto EventSwitcher's side instead, which already has its own
          min-w-0/truncate chain built to absorb exactly that. */}
      <div className="flex shrink-0 items-center gap-3 sm:gap-6">
        {/* These three used to be bare icons with no hit-area padding at
            all — fine with a mouse, well under the 44px touch-target
            minimum for a fingertip. Each now goes through the shared
            IconButton (size="md" — 44px, this app's own stated touch-target
            minimum, held constant rather than growing at sm:/lg: as before —
            that per-button responsive growth was itself one of the app's
            five inconsistent icon-button sizes). Calendar/Fullscreen are
            still desktop-only (`hidden lg:flex`, the same breakpoint the
            rest of this app's mobile/desktop split uses): Fullscreen API has
            no real value on a phone browser, and a calendar glance is the
            kind of thing worth trading for header space once the rail/tab
            bar already take up more of a small screen. Profile stays
            available everywhere. */}
        <IconButton
          icon={CalendarIcon}
          size="md"
          aria-label="Calendar"
          onClick={() => setCalendarOpen(true)}
          className="hidden lg:flex"
        />

        <IconButton
          icon={isFullscreen ? FullscreenExitIcon : FullscreenEnterIcon}
          size="md"
          aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
          onClick={toggleFullscreen}
          className="hidden lg:flex"
        />

        {/* Photo only now — no name, no chevron, and no dropdown menu.
            Tapping it opens UserIdCardModal (an "ID card," per request)
            instead: a bigger, more deliberate surface than a quick menu,
            matching what was actually asked for rather than just trimming
            the old menu down to fewer words. */}
        <button
          type="button"
          onClick={() => setIdCardOpen(true)}
          aria-label="Profile"
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/5 text-icon-gray transition active:scale-[0.97]"
        >
          {/* Same "photo when set, plain fallback otherwise" split every
              other avatar in this app already has (GuestAvatar) — Settings'
              own ImageField lets this photo be removed entirely, which the
              old hardcoded <img> here had no answer for. */}
          {profile.imageUrl ? (
            <img src={profile.imageUrl} alt={profile.name} className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      <UserIdCardModal open={idCardOpen} onClose={() => setIdCardOpen(false)} />

      <DrawerPanelPortal open={calendarOpen} onClose={() => setCalendarOpen(false)} title="Calendar" icon={CalendarIcon}>
        <CalendarCard />
      </DrawerPanelPortal>
    </header>
  )
}

export default memo(TopHeader)
