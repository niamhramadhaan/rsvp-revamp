import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, CheckmarkIcon, CloseIcon, PlusIcon } from './icons/UiIcons'
import { useCurrentEvent, useEvents } from '../data/hooks'
import { useSeatEditorGuard } from './SeatEditorGuardContext'
import { useEnterTransition } from '../hooks/useEnterTransition'
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss'
import CreateEventDrawer from './overview/CreateEventDrawer'
import Toast, { type ToastState, type ToastTone } from './Toast'
import IconButton from './IconButton'
import { AuroraText } from './ui/aurora-text'

// Same "two-letter monogram chip" recipe SettingsPage's own UserCard fallback
// avatar already uses — picked up here instead of inventing a second one, so
// the dropdown/sheet rows read as this app's own list-row language rather
// than a generic plain-text menu.
function eventInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

// Per-event mark — the uploaded logo when one exists, otherwise the monogram
// chip above. One component so the desktop dropdown and the mobile sheet
// can't drift apart (same size recipe, same fallback).
function EventMark({ name, logoUrl, active, size }: { name: string; logoUrl?: string; active: boolean; size: 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'h-10 w-10 text-sm' : 'h-9 w-9 text-xs'
  if (logoUrl) {
    return <img src={logoUrl} alt="" className={`${dims} shrink-0 rounded-xl object-cover`} />
  }
  return (
    <span
      className={`flex ${dims} shrink-0 items-center justify-center rounded-xl font-bold ${
        active ? 'bg-accent-700 text-white' : 'bg-black/5 text-ink-900/60'
      }`}
    >
      {eventInitials(name)}
    </span>
  )
}

// Same local-formatDate convention every other file with a date already
// repeats for itself (EventsPage/EventBanner/OverviewContent's own
// formatDate) rather than a shared util.
function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Lives in TopHeader — every event-scoped page/widget reads the same
// "current event" this switches, so switching or creating an event here is
// the one place cross-event actions belong (per the "Overview is one
// event's dashboard" philosophy — see plan.md).
//
// Two renderings of the same event list/current-selection state, gated by
// breakpoint (same split as EventTabs' mobile dock vs desktop pill row): a
// small anchored dropdown card works fine for a pointer on a wide screen,
// but on a phone that same card has nowhere good to anchor — it ends up
// floating disconnected from the button that opened it, touching the
// screen edge, with no scrim to tie it back to what opened it. Below `sm`
// this becomes a real bottom sheet instead — the standard native-app
// answer to "menu on mobile" — not a shrunk-down copy of the desktop card.
export default function EventSwitcher() {
  const { requestNavigation } = useSeatEditorGuard()
  const events = useEvents()
  const [currentEvent, selectEvent] = useCurrentEvent()
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const showToast = useCallback((message: string, tone: ToastTone = 'success') => setToast({ message, tone }), [])

  const entered = useEnterTransition(open)
  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const { sheetRef, resetDrag, handlers: dragHandlers } = useSwipeToDismiss({
    onDismiss: () => setOpen(false),
  })
  useEffect(() => {
    if (open) resetDrag()
  }, [open, resetDrag])

  // The desktop dropdown's own width — measured off the trigger button
  // itself rather than a fixed `w-72`, so the menu reads as a direct
  // extension of the control that opened it (same width, not just the same
  // left edge) instead of an independently-sized card that happens to be
  // anchored there. Re-measured on resize while open so a viewport resize
  // (or the trigger's own text/padding changing width, e.g. a longer event
  // name becoming current) can't leave it stale.
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [triggerWidth, setTriggerWidth] = useState<number | null>(null)
  useEffect(() => {
    if (!open) return
    function measure() {
      if (triggerRef.current) setTriggerWidth(triggerRef.current.offsetWidth)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  // Guarded — switching events while the current one's seat map editor
  // still has unsaved layout changes needs to ask first, same as any other
  // way out of the Seating tab (see SeatEditorGuardContext).
  function handleSelect(id: string) {
    requestNavigation(() => selectEvent(id))
    setOpen(false)
  }

  function handleCreate() {
    setOpen(false)
    setCreateOpen(true)
  }

  return (
    <div className="relative min-w-0">
      {/* No frame any more — used to be a persistent bordered/tinted "box"
          around the trigger (a workspace-switcher reference's "rectangular
          org bar" identity); per request, this is now bare name+chevron
          sized to actually fill the header instead of a small pill floating
          inside it. The dropdown/bottom-sheet mechanics below are untouched
          — this only changes what the closed control itself looks like at
          rest. Hover/open state is a text-color shift (no background) since
          there's no box left to tint. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`group flex min-w-0 items-center gap-1.5 rounded-xl py-1 text-left transition active:scale-[0.98] ${
          open ? 'text-accent-700' : 'text-ink-900 hover:text-accent-700'
        }`}
      >
        {/* No "Event" eyebrow label above the name any more — the top
            header's own composition redesign (Option B, picked over two
            others) went for the plainest of the three, and a switcher that
            IS the name (not a name plus a caption above it) is part of
            that. The dropdown/sheet this opens still says "Switch event"
            for anyone who wants that context spelled out. */}
        {currentEvent?.logoUrl && (
          <img src={currentEvent.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-xl object-cover" />
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold leading-tight sm:text-xl lg:text-2xl">
            {currentEvent ? <AuroraText>{currentEvent.name}</AuroraText> : 'Select an event'}
          </p>
        </div>
        <ChevronDownIcon
          className={`h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-hover:text-accent-700 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Desktop/tablet dropdown — pointer-driven, so an invisible
          click-catcher is enough; a scrim would just be visual noise for a
          mouse user who can already see the rest of the page isn't blocked.
          `max-w-[calc(100vw-4rem)]` guards against this opening near the
          boundary of the `sm:` breakpoint itself.
          rounded-3xl (not -2xl) + the header's own shadow recipe (not a
          generic shadow-xl), no ring, and an 8px gap (not 10px) — matching
          the header card's own radius/shadow language and sitting closer to
          it is what "seamless with the top navbar" means here: not a
          separate, generic dropdown that happens to be nearby, but a
          surface that reads as an extension of the header itself. */}
      {open && <div className="fixed inset-0 z-40 hidden sm:block" onClick={() => setOpen(false)} />}

      <div
        inert={!open}
        // Falls back to w-72 only for the one frame before the trigger's
        // own width is ever measured (triggerWidth starts null) — the
        // inline style below takes over the instant `open` flips true.
        style={triggerWidth ? { width: `${triggerWidth}px` } : undefined}
        className={`absolute left-0 top-[calc(100%+8px)] z-50 hidden max-w-[calc(100vw-4rem)] origin-top-left overflow-hidden rounded-3xl bg-cream p-2 shadow-[0_20px_50px_-20px_rgba(16,30,51,0.35)] transition duration-150 ease-out sm:block ${
          triggerWidth ? '' : 'w-72'
        } ${entered ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'}`}
      >
        <div className="flex flex-col gap-1">
          {sorted.map((e) => {
            const isCurrent = e.id === currentEvent?.id
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => handleSelect(e.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                  isCurrent ? 'bg-accent-700/10' : 'hover:bg-black/5'
                }`}
              >
                <EventMark name={e.name} logoUrl={e.logoUrl} active={isCurrent} size="md" />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${isCurrent ? 'font-semibold text-accent-700' : 'font-medium text-ink-900'}`}>{e.name}</p>
                  <p className="truncate text-xs text-muted">{formatEventDate(e.date)}</p>
                </div>
                {isCurrent && <CheckmarkIcon className="h-4 w-4 shrink-0 text-accent-700" />}
              </button>
            )
          })}
          {sorted.length === 0 && <p className="px-2.5 py-2 text-sm text-muted">No events yet.</p>}
        </div>

        <div className="my-1 h-px bg-black/5" />
        <button
          type="button"
          onClick={handleCreate}
          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-black/5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-700/10 text-accent-700">
            <PlusIcon className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-accent-700">New event</span>
        </button>
      </div>

      {/* Mobile bottom sheet — a real scrim (dimming the page ties the sheet
          back to what opened it, instead of it just appearing to float on
          top), a drag-handle affordance, and full-width rows sized for a
          thumb rather than a cursor. */}
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-ink-900/40 transition-opacity duration-300 ease-out sm:hidden ${
          entered ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div
        ref={sheetRef}
        inert={!open}
        role="dialog"
        aria-label="Switch event"
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] flex-col rounded-t-3xl bg-cream shadow-[0_-20px_60px_-15px_rgba(16,30,51,0.35)] transition-transform duration-300 ease-out sm:hidden ${
          entered ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        {/* Drag handle — see useSwipeToDismiss (same hook DrawerPanel.tsx
            uses for every other drawer's own bottom sheet). touch-none stops
            the browser's own scroll/refresh gestures from fighting the
            drag; the padding grows the actual hit-area past the visible bar
            without visually enlarging it. */}
        <div {...dragHandlers} className="flex shrink-0 touch-none justify-center py-2.5">
          <div className="h-1.5 w-10 rounded-full bg-black/10" />
        </div>

        <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-3">
          <p className="text-sm font-semibold text-ink-900">Switch event</p>
          <IconButton icon={CloseIcon} size="sm" aria-label="Close" onClick={() => setOpen(false)} />
        </div>

        <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pt-1">
          {sorted.map((e) => {
            const isCurrent = e.id === currentEvent?.id
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => handleSelect(e.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition active:scale-[0.98] ${
                  isCurrent ? 'bg-accent-700/10' : 'hover:bg-black/5'
                }`}
              >
                <EventMark name={e.name} logoUrl={e.logoUrl} active={isCurrent} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[15px] ${isCurrent ? 'font-semibold text-accent-700' : 'font-medium text-ink-900'}`}>{e.name}</p>
                  <p className="truncate text-xs text-muted">{formatEventDate(e.date)}</p>
                </div>
                {isCurrent && <CheckmarkIcon className="h-4 w-4 shrink-0 text-accent-700" />}
              </button>
            )
          })}
          {sorted.length === 0 && <p className="px-3 py-3 text-sm text-muted">No events yet.</p>}
        </div>

        <div className="mx-4 h-px shrink-0 bg-black/5" />

        <div className="shrink-0 px-3 py-2">
          <button
            type="button"
            onClick={handleCreate}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition active:scale-[0.98] hover:bg-black/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-700/10 text-accent-700">
              <PlusIcon className="h-4 w-4" />
            </span>
            <span className="text-[15px] font-semibold text-accent-700">New event</span>
          </button>
        </div>
      </div>

      <CreateEventDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(event) => {
          selectEvent(event.id)
          showToast(`"${event.name}" created`)
        }}
      />

      <Toast toast={toast} />
    </div>
  )
}
