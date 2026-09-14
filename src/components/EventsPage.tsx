import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PageStage from './PageStage'
import type { Event, EventStatus } from '../data/types'
import { useCurrentEvent, useEvents, useAllGuests } from '../data/hooks'
import { setEventStatus } from '../data/events'
import CreateEventDrawer from './overview/CreateEventDrawer'
import EditEventDrawer from './overview/EditEventDrawer'
import InvitationTemplateDrawer from './overview/InvitationTemplateDrawer'
import Toast, { type ToastState, type ToastTone } from './Toast'
import Button from './Button'
import FloatingMenu from './FloatingMenu'
import { CalendarIcon, DotsVerticalIcon, MapPinIcon, PlusIcon } from './icons/UiIcons'
import { HouseIcon, UserIcon as GuestIcon } from './icons/NavIcons'
import { focalPointToCss } from '../utils/imagePosition'
import { useSlidingIndicator } from '../hooks/useSlidingIndicator'

export interface EventsPageProps {
  /** Called after an event is picked (or just created) — jumps back to the
   * Overview page, now showing that event (see DashboardLayout). */
  onOpenEvent: () => void
}

type StatusFilter = 'live' | 'archived' | 'all'

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'live', label: 'Live' },
  { key: 'archived', label: 'Archived' },
  { key: 'all', label: 'All' },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// The "Events" rail destination — was a permanent "coming soon" toast (see
// plan.md's Phase 2). Browse/create/archive every event, and jump into one's
// Overview dashboard. No routing yet (matches the rest of this app's
// tab/page pattern) — DashboardLayout just swaps which page renders.
// Wrapped in memo — see TopHeader's own doc for the DashboardShell/
// DrawerPanelContext cascade this guards against. Only pays off once
// DashboardShell also hands this a stable `onOpenEvent` (useCallback, not a
// fresh inline arrow) — see its own doc.
function EventsPage({ onOpenEvent }: EventsPageProps) {
  const events = useEvents()
  const allGuests = useAllGuests()
  const [, selectEvent] = useCurrentEvent()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('live')
  const filterRailRef = useRef<HTMLDivElement>(null)
  const filterIndicator = useSlidingIndicator(filterRailRef, statusFilter)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  // Handed off from EditEventDrawer's own "Edit invitation template" button
  // — same shared-single-slot hand-off OverviewContent's own instance uses.
  const [templateEvent, setTemplateEvent] = useState<Event | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const showToast = useCallback((message: string, tone: ToastTone = 'success') => setToast({ message, tone }), [])

  // Per-event guest counts — derived from the same guest list every other
  // screen reads, never a separately-maintained counter (matches
  // selectors.ts's convention elsewhere in this app).
  const guestCountByEvent = useMemo(() => {
    const map = new Map<string, number>()
    for (const g of allGuests) map.set(g.eventId, (map.get(g.eventId) ?? 0) + 1)
    return map
  }, [allGuests])

  const filtered = useMemo(() => {
    const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    return statusFilter === 'all' ? sorted : sorted.filter((e) => e.status === statusFilter)
  }, [events, statusFilter])

  function openInvitationTemplateDrawer(event: Event) {
    setEditingEvent(null)
    setTemplateEvent(event)
  }

  function handleOpen(event: Event) {
    selectEvent(event.id)
    onOpenEvent()
  }

  function handleToggleArchive(event: Event) {
    const next: EventStatus = event.status === 'archived' ? 'live' : 'archived'
    setEventStatus(event.id, next).then(() => {
      showToast(next === 'archived' ? `"${event.name}" archived` : `"${event.name}" restored`)
    })
  }

  return (
    <>
      <PageStage>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-ink-900">Events</h2>
              <p className="text-sm text-muted">
                {events.length} event{events.length === 1 ? '' : 's'} total
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 shadow-sm shadow-accent-700/30"
            >
              <PlusIcon className="h-4 w-4" /> New event
            </Button>
          </div>

          {/* Sliding pill, same recipe EventTabs' own Overview/Guests/Seating/
              Reports switch uses (useSlidingIndicator) — one floating
              background travelling between slots, not each button
              separately recoloring itself. */}
          <div ref={filterRailRef} className="relative flex w-fit gap-1.5 rounded-2xl border border-black/5 bg-cream p-1.5">
            {filterIndicator && (
              <div
                aria-hidden="true"
                className="absolute left-0 top-0 rounded-xl bg-ink-900 transition-[transform,width] duration-300 ease-out"
                style={{
                  width: filterIndicator.width,
                  height: filterIndicator.height,
                  transform: `translate(${filterIndicator.left}px, ${filterIndicator.top}px)`,
                }}
              />
            )}
            {FILTERS.map((f) => (
              <button
                key={f.key}
                data-tab-key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`relative z-10 rounded-xl px-4 py-2 text-sm font-medium transition-colors active:scale-[0.97] ${
                  statusFilter === f.key ? 'text-white' : 'text-ink-900/70 hover:bg-black/5'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-black/5 bg-cream p-10 text-center">
              <p className="text-sm text-muted">
                {statusFilter === 'all' ? 'No events yet — create the first one.' : `No ${statusFilter} events.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  guestCount={guestCountByEvent.get(event.id) ?? 0}
                  onOpen={handleOpen}
                  onEdit={setEditingEvent}
                  onToggleArchive={handleToggleArchive}
                />
              ))}
            </div>
          )}
        </div>
      </PageStage>

      {/* Drawers/toast sit outside PageStage as siblings — same convention
          OverviewContent's own equivalents already use, since these are
          overlays, not page content the glass-stage card should visually
          contain. */}
      <CreateEventDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(event) => {
          selectEvent(event.id)
          onOpenEvent()
        }}
      />

      <EditEventDrawer
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
        onSaved={(event) => showToast(`"${event.name}" updated`)}
        onOpenInvitationTemplate={openInvitationTemplateDrawer}
      />

      <InvitationTemplateDrawer
        event={templateEvent}
        onClose={() => setTemplateEvent(null)}
        onSaved={(event) => showToast(`"${event.name}" invitation template updated`)}
      />

      <Toast toast={toast} />
    </>
  )
}

interface EventCardProps {
  event: Event
  guestCount: number
  onOpen: (event: Event) => void
  onEdit: (event: Event) => void
  onToggleArchive: (event: Event) => void
}

// Stacked-cards card — three skewed, pastel duplicate layers fanned behind
// a plain, light hero card, picked from a reference "cards fanned behind a
// hero" depth effect. Replaces the earlier folder-tab treatment entirely:
// no tab flap, no thick dark frame, no dark stat panel — the hero card
// itself is a completely ordinary light card (photo + name/date/venue +
// guest count), and the stack is the whole visual idea now, not a detail
// bolted onto a different card concept. The three ghost layers are purely
// decorative (aria-hidden, pointer-events-none) and fan out a little
// further on hover, the same "subtle motion" the reference describes.
//
// The hero card is one click target for "show me this event's details" —
// opens EditEventDrawer directly (the closest thing this app has to a real
// event-detail view), rather than jumping away to that event's Overview
// dashboard the way it used to. Actually switching to an event's own
// dashboard is a deliberate, separate action now — "Open dashboard" in the
// kebab menu — alongside Archive, both behind one menu (stopPropagation on
// every click inside it) so there's exactly one place on the card that
// means "something other than viewing its details."
function EventCard({ event, guestCount, onOpen, onEdit, onToggleArchive }: EventCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const isArchived = event.status === 'archived'

  useEffect(() => {
    if (!menuOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  return (
    <div className="group relative">
      {/* Three fanned layers, furthest-back first — each rotates/offsets a
          little further out on hover than the last, so the whole stack
          reads as fanning open rather than every layer moving in lockstep. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl border border-black/5 bg-accent-cyan/10 transition-transform duration-300 ease-out [transform:rotate(-9deg)_translate(5px,14px)] group-hover:[transform:rotate(-14deg)_translate(9px,20px)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl border border-black/5 bg-lavender-2 transition-transform duration-300 ease-out [transform:rotate(7deg)_translate(-4px,10px)] group-hover:[transform:rotate(11deg)_translate(-7px,15px)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl border border-black/5 bg-cream transition-transform duration-300 ease-out [transform:rotate(-3deg)_translate(2px,5px)] group-hover:[transform:rotate(-5deg)_translate(4px,8px)]"
      />

      {/* The hero card — a plain light card, same GLASS_CARD-adjacent
          language the rest of this app already uses (cream, a hairline
          border, a soft shadow), nothing folder-shaped about it. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onEdit(event)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onEdit(event)
          }
        }}
        className="relative z-10 flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-black/5 bg-cream text-left shadow-sm transition active:scale-[0.99] group-hover:-translate-y-1 group-hover:shadow-md"
      >
        <div className={`relative h-32 overflow-hidden sm:h-36 ${isArchived ? 'grayscale' : ''}`}>
          {event.imageUrl ? (
            <img src={event.imageUrl} alt="" style={{ objectPosition: focalPointToCss(event.imageFocalPoint) }} className="h-full w-full object-cover" />
          ) : (
            <div aria-hidden="true" className="h-full w-full bg-gradient-to-br from-accent-700 to-accent-cyan" />
          )}

          {/* Status pill — floats on the photo now that there's no tab to
              carry it. */}
          <span
            className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm ${
              isArchived ? 'bg-black/30' : 'bg-status-confirmed/80'
            }`}
          >
            {isArchived ? 'Archived' : 'Live'}
          </span>

          {/* Kebab menu — the one exception to "the whole card opens the
              event," stopPropagation on every click inside it. Used to
              expand as a plain `absolute` child right here, but this whole
              photo strip is itself `overflow-hidden` (its rounded top
              corners, plus the hero card's own outer `overflow-hidden` —
              see both above), which sliced the menu off almost entirely.
              FloatingMenu (see its own doc) portals it out to the page root
              instead, positioned off the trigger's measured rect, so
              neither ancestor can clip it. */}
          <div className="absolute right-3 top-3">
            <button
              ref={menuTriggerRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((v) => !v)
              }}
              aria-label={`Actions for "${event.name}"`}
              aria-expanded={menuOpen}
              className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition active:scale-[0.9] ${
                menuOpen ? 'bg-white text-ink-900' : 'bg-black/30 text-white hover:bg-black/50'
              }`}
            >
              <DotsVerticalIcon className="h-4 w-4" />
            </button>

            <FloatingMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              anchorRef={menuTriggerRef}
              className="w-40 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-black/5"
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onOpen(event)
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm font-medium text-ink-900 transition hover:bg-black/5"
              >
                <HouseIcon className="h-3.5 w-3.5" />
                Open dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onToggleArchive(event)
                }}
                className="block w-full px-3.5 py-2 text-left text-sm font-medium text-ink-900 transition hover:bg-black/5"
              >
                {isArchived ? 'Restore' : 'Archive'}
              </button>
            </FloatingMenu>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start gap-2.5">
            {event.logoUrl && <img src={event.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />}
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 font-display text-base font-semibold text-ink-900">{event.name}</h3>
            <div className="mt-1.5 flex flex-col gap-1 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 shrink-0" /> {formatDate(event.date)}
              </span>
              {event.venue && (
                <span className="flex items-center gap-1.5">
                  <MapPinIcon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{event.venue}</span>
                </span>
              )}
            </div>
            </div>
          </div>

          <div className="mt-auto flex items-center gap-2 border-t border-black/5 pt-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-700/10 text-accent-700">
              <GuestIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-none text-ink-900">{guestCount}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">Guest{guestCount === 1 ? '' : 's'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(EventsPage)

