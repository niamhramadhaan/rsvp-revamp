import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { Guest, Seat, SeatGroup } from '../../data/types'
import { getGuestStage } from '../../data/selectors'
import { STAGE_TONE } from './cardChrome'
import GuestAvatar from './GuestAvatar'
import IconButton from '../IconButton'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, SearchIcon } from '../icons/UiIcons'
import { playSound } from '../../utils/sound'
import type { ToastTone } from '../Toast'

export interface GuestDockProps {
  guests: Guest[]
  seatById: Map<string, Seat>
  groups: SeatGroup[]
  selectedGuestId: string | null
  onSelectGuest: (id: string) => void
  onUnassignSeat: (guestId: string) => void
  /** A guest card dropped directly onto an empty seat tile — see
   * handleRowPointerUp's own doc for how the drop target is found. Does
   * nothing if the drop missed every seat, or landed on one that's already
   * taken (that seat's own occupant has to be unassigned first, same rule
   * assignSeat's own defensive check already enforces). */
  onAssignGuestToSeat: (guestId: string, seatId: string) => void
  onViewProfile: (guestId: string) => void
  onToast: (message: string, tone?: ToastTone) => void
}

const DRAG_THRESHOLD_PX = 4

// 'all' | 'unassigned' | a SeatGroup id — the pill bar below the search
// input, one more way to narrow this same list down (on top of the text
// search) without leaving the dock.
type GuestFilter = 'all' | 'unassigned' | string

// Direct style mutation (not a Tailwind class) so this never depends on the
// class actually being present in the compiled stylesheet — see
// applyDropHighlight's own doc.
const DROP_TARGET_OUTLINE = '3px solid var(--color-accent-700)'

function applyDropHighlight(el: HTMLElement) {
  // Inline styles, not classList.add: Tailwind's JIT compiler only ever
  // generates CSS for class names it can find as literal strings in the
  // source, and a class added purely at runtime here (on SeatTile's own
  // wrapper, a component this file doesn't own) would never have made it
  // into that scan — it would sit on the element with zero effect. outline
  // (not border/box-shadow) specifically because SeatTile's own wrapper
  // never sets that property itself, seat or bulk drag included, so there's
  // nothing here to fight with or need to restore afterward.
  el.style.outline = DROP_TARGET_OUTLINE
  el.style.outlineOffset = '2px'
}

function clearDropHighlight(el: HTMLElement) {
  el.style.outline = ''
  el.style.outlineOffset = ''
}

// The guest picker for seat assignment — floats over the seat map itself
// (see SeatMapCanvas, which renders this as one more absolutely-positioned
// overlay alongside its own component-library dock) rather than living in a
// side-by-side panel the way the old combined "Guests & Seating" tab split
// the page in two. Collapsible to a thin avatar rail so it doesn't have to
// permanently cover the left edge of the floor plan. A guest card is both a
// real pointer-drag (drop it directly on an empty seat — see
// handleRowPointerUp) and a plain tap fallback (selects the guest the same
// way the old row-list click did; then tap an empty seat on the canvas,
// unchanged from before) — the same "real drag places exactly where
// dropped, a plain tap falls back to the simpler flow" split SeatMapCanvas's
// own library dock already uses for its "+" items.
export default function GuestDock({
  guests,
  seatById,
  groups,
  selectedGuestId,
  onSelectGuest,
  onUnassignSeat,
  onAssignGuestToSeat,
  onViewProfile,
  onToast,
}: GuestDockProps) {
  // Collapsed by default — a full guest list floating over the floor plan
  // the moment the tab opens covered more of it (and more of what an admin
  // might have already dragged there) than an admin actually assigning
  // guests one at a time needs up front; the stacked-avatar chip is enough
  // of a hint that it's there, and expanding it is one tap away.
  const [collapsed, setCollapsed] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<GuestFilter>('all')
  // The search input's own keyboard-navigable "active" row — Arrow keys move
  // it, Enter selects it (same effect as tapping that row), same combobox
  // shape as this app's other searchable pickers. Layered on top of the
  // existing pointer-drag/tap list below, not a replacement for it: a mouse
  // user still drags or taps a row exactly as before.
  const [activeIndex, setActiveIndex] = useState(-1)
  const [draggingGuest, setDraggingGuest] = useState<Guest | null>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dragStart = useRef({ x: 0, y: 0 })
  const dragMoved = useRef(false)
  const dragGuestRef = useRef<Guest | null>(null)
  // The seat tile currently under the cursor mid-drag, if it's a valid drop
  // target — see applyDropHighlight's own doc for why this is a direct DOM
  // reference rather than React state (the tile belongs to SeatMapCanvas,
  // not this component, and re-rendering it every pointer-move frame just
  // to toggle one style would be real, felt cost for zero benefit here).
  const hoveredSeatElRef = useRef<HTMLElement | null>(null)

  // One flat A-Z list — plain alphabetical by name, seated or not. Seating
  // status is still filterable (the "Unassigned" pill below), just no
  // longer a silent sort priority of its own: a mixed list used to put every
  // unassigned guest ahead of every seated one before either group was
  // alphabetized, which meant the list appeared to restart at "A" partway
  // down — neat within each half, but not one straightforward A-Z order to
  // scan top to bottom. Search matches name or organization, same fields
  // GuestsView's own search already keys off.
  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = guests.filter((g) => {
      if (q && !g.name.toLowerCase().includes(q) && !g.organization.toLowerCase().includes(q)) return false
      if (filter === 'unassigned') return !g.seatId
      if (filter !== 'all') return Boolean(g.seatId) && seatById.get(g.seatId!)?.groupId === filter
      return true
    })
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  }, [guests, query, filter, seatById])

  // Whatever was active before a filter/search change almost certainly isn't
  // the same guest any more (the list itself just changed) — start over at
  // the top rather than pointing at a stale index into a different list.
  useEffect(() => {
    setActiveIndex(sorted.length > 0 ? 0 : -1)
  }, [sorted])

  function handleSearchKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (sorted.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(sorted.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const guest = sorted[activeIndex]
      if (guest) onSelectGuest(guest.id)
    } else if (e.key === 'Escape' && query) {
      setQuery('')
    }
  }

  function clearHoveredSeat() {
    if (hoveredSeatElRef.current) {
      clearDropHighlight(hoveredSeatElRef.current)
      hoveredSeatElRef.current = null
    }
  }

  function handleRowPointerDown(e: ReactPointerEvent<HTMLDivElement>, guest: Guest) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = { x: e.clientX, y: e.clientY }
    dragMoved.current = false
    dragGuestRef.current = guest
    setDraggingGuest(guest)
    if (ghostRef.current) {
      ghostRef.current.style.left = `${e.clientX}px`
      ghostRef.current.style.top = `${e.clientY}px`
    }
  }

  // Besides dragging the ghost preview along, this now also hit-tests
  // what's directly under the cursor every frame so the seat that would
  // actually receive this guest on release gets a visible highlight while
  // the drag is still in progress — otherwise the only feedback during the
  // drag was the dragged card's own ghost, nothing on the canvas itself
  // said "here" ahead of the drop.
  function handleRowPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragGuestRef.current || !ghostRef.current) return
    if (!dragMoved.current && Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y) > DRAG_THRESHOLD_PX) {
      dragMoved.current = true
      playSound('drag-start')
    }
    ghostRef.current.style.left = `${e.clientX}px`
    ghostRef.current.style.top = `${e.clientY}px`

    if (dragMoved.current) {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const seatEl = el instanceof Element ? el.closest<HTMLElement>('[data-seat-id]') : null
      const seat = seatEl ? seatById.get(seatEl.dataset.seatId ?? '') : undefined
      const nextTarget = seatEl && seat && seat.status === 'empty' ? seatEl : null
      if (hoveredSeatElRef.current !== nextTarget) {
        clearHoveredSeat()
        if (nextTarget) {
          applyDropHighlight(nextTarget)
          hoveredSeatElRef.current = nextTarget
        }
      }
    }
  }

  // A real drag (past threshold) looks up whatever seat tile is under the
  // release point via a plain DOM hit-test (SeatMapCanvas's own SeatTile
  // wrapper carries data-seat-id/data-seat-status — see its own doc) rather
  // than any canvas-coordinate math: works correctly at any zoom/scroll/pan
  // state with zero conversion, since this dock has no idea what the
  // canvas's own transform even is. A plain tap (no real movement) falls
  // back to the simpler select-then-tap-a-seat flow instead.
  function handleRowPointerUp(e: ReactPointerEvent<HTMLDivElement>, guest: Guest) {
    if (!dragGuestRef.current) return
    if (dragMoved.current) {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const seatEl = el instanceof Element ? el.closest<HTMLElement>('[data-seat-id]') : null
      const seatId = seatEl?.dataset.seatId
      if (seatId) {
        const seat = seatById.get(seatId)
        if (seat && seat.status === 'empty') {
          playSound('drop')
          onAssignGuestToSeat(guest.id, seatId)
        } else {
          playSound('invalid-drop')
          onToast('That seat is already taken', 'warning')
        }
      }
    } else {
      onSelectGuest(guest.id)
    }
    clearHoveredSeat()
    dragGuestRef.current = null
    setDraggingGuest(null)
  }

  // Collapsed used to still be a full-height column, just thinner — a row
  // of individual, non-overlapping avatars stretching top-4 to bottom-4.
  // That's barely "hidden": it still claimed the whole left edge. Collapsed
  // now shrinks to its own content (no bottom-4) and reads as a small
  // floating chip — a stack of a few overlapping avatars (the same
  // guests the expanded list would show first) plus a "+N" badge for
  // everyone else, the common "N people" summary pattern. Tapping the
  // stack (or the chevron) expands it back to the full picker.
  const STACK_PREVIEW = 4
  const overflowCount = Math.max(0, sorted.length - STACK_PREVIEW)

  return (
    <div
      // max-h (not bottom-4/inset stretching to the card's own bottom edge)
      // when expanded — this panel is a sibling of the canvas's own dot-
      // legend/fill-percent text (which sits BELOW the scroll container, in
      // normal flow, so the card's own bottom edge sits well past the
      // scroll container's), so stretching to that edge would visually
      // bury that legend text under this panel (z-30 beats un-indexed flow
      // content). A capped height keeps this panel within roughly the
      // canvas's own visible area instead.
      className={`absolute left-4 top-4 z-30 flex flex-col overflow-hidden rounded-2xl bg-cream/95 shadow-[0_20px_50px_-15px_rgba(16,30,51,0.4)] ring-1 ring-black/5 ${
        collapsed ? '' : 'max-h-[500px] w-64'
      }`}
    >
      {collapsed ? (
        <div className="flex items-center gap-2 p-2">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label={`Expand guest list — ${guests.length} guests`}
            className="flex items-center -space-x-2.5 rounded-full transition active:scale-[0.96]"
          >
            {sorted.slice(0, STACK_PREVIEW).map((g, i) => (
              // Reuses CheckInResultCard's own checkin-pop keyframe (see
              // index.css) rather than a new one — the same "just landed"
              // pop, just staggered per avatar so the stack visibly builds
              // itself rather than appearing all at once.
              <span
                key={g.id}
                style={{ animation: `checkin-pop 360ms cubic-bezier(0.34,1.56,0.64,1) ${i * 70}ms both` }}
                className="rounded-full ring-2 ring-cream"
              >
                <GuestAvatar name={g.name} imageUrl={g.imageUrl} avatarConfig={g.avatarConfig} sizeClassName="h-8 w-8" />
              </span>
            ))}
            {overflowCount > 0 && (
              <span
                style={{ animation: `checkin-pop 360ms cubic-bezier(0.34,1.56,0.64,1) ${STACK_PREVIEW * 70}ms both` }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-[10px] font-bold text-white ring-2 ring-cream"
              >
                +{overflowCount}
              </span>
            )}
            {sorted.length === 0 && <span className="px-1 text-xs text-muted">No guests</span>}
          </button>
          <IconButton
            icon={ChevronRightIcon}
            size="sm"
            onClick={() => setCollapsed(false)}
            aria-label="Expand guest dock"
            className="shrink-0"
          />
        </div>
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black/5 p-2.5">
            <div className="min-w-0 pl-1.5">
              <p className="truncate text-xs font-semibold text-ink-900">Guests</p>
              <p className="text-[11px] text-muted">{guests.length}</p>
            </div>
            <IconButton
              icon={ChevronLeftIcon}
              size="sm"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse guest dock"
              className="shrink-0"
            />
          </div>

          <div className="flex shrink-0 flex-col gap-2 p-2 pb-0">
            <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm">
              <SearchIcon className="h-3.5 w-3.5 shrink-0 text-icon-gray" />
              <input
                ref={searchInputRef}
                type="text"
                role="combobox"
                aria-expanded={!collapsed}
                aria-controls="guest-dock-listbox"
                aria-activedescendant={activeIndex >= 0 ? `guest-dock-option-${sorted[activeIndex]?.id}` : undefined}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search guests"
                className="w-full min-w-0 bg-transparent text-xs text-ink-900 outline-none placeholder:text-muted"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery('')
                    searchInputRef.current?.focus()
                  }}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-icon-gray transition hover:bg-black/10 hover:text-ink-900"
                >
                  <CloseIcon className="h-2.5 w-2.5" />
                </button>
              )}
            </div>

            {/* Status/category pills — a second, tap-once way to narrow this
                same list, on top of (not instead of) the search box above.
                Groups are read from live data rather than hardcoded VIP/
                Regular labels, same as AutoAssignDrawer's own group picker
                does — whatever this event's SeatGroups actually are is what
                shows up here. */}
            <div className="no-scrollbar -mx-0.5 flex gap-1 overflow-x-auto px-0.5 pb-2">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'unassigned', label: 'Unassigned' },
                  ...groups.map((g) => ({ id: g.id, label: g.label, color: g.color })),
                ] as Array<{ id: GuestFilter; label: string; color?: string }>
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setFilter((f) => (f === pill.id ? 'all' : pill.id))}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition ${
                    filter === pill.id ? 'bg-ink-900 text-white' : 'bg-white text-ink-900/70 hover:bg-black/5'
                  }`}
                >
                  {pill.color && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: pill.color }} />}
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          <ul id="guest-dock-listbox" role="listbox" className="no-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto p-2 pt-0">
            {sorted.map((g, i) => {
              const seat = g.seatId ? seatById.get(g.seatId) : undefined
              const isSelected = g.id === selectedGuestId
              const isActive = i === activeIndex
              return (
                <li key={g.id}>
                  <div
                    id={`guest-dock-option-${g.id}`}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onPointerDown={(e) => handleRowPointerDown(e, g)}
                    onPointerMove={handleRowPointerMove}
                    onPointerUp={(e) => handleRowPointerUp(e, g)}
                    onPointerCancel={() => {
                      clearHoveredSeat()
                      dragGuestRef.current = null
                      setDraggingGuest(null)
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelectGuest(g.id)
                      }
                    }}
                    className={`flex touch-none select-none items-center gap-2 rounded-xl px-2 py-1.5 text-left transition active:scale-[0.98] ${
                      isSelected
                        ? 'cursor-grab bg-accent-700/10 ring-1 ring-accent-700/40'
                        : isActive
                          ? 'cursor-grab bg-black/5 ring-1 ring-black/10'
                          : 'cursor-grab bg-white hover:bg-black/5'
                    } ${draggingGuest?.id === g.id ? 'opacity-40' : ''}`}
                  >
                    <GuestAvatar name={g.name} imageUrl={g.imageUrl} avatarConfig={g.avatarConfig} sizeClassName="h-8 w-8" ringClassName={STAGE_TONE[getGuestStage(g)].ring} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-ink-900">{g.name}</p>
                      {seat ? (
                        <span className="flex items-center gap-1 text-[10.5px] text-muted">
                          {seat.label}
                          <button
                            type="button"
                            aria-label={`Unassign ${g.name}`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              onUnassignSeat(g.id)
                            }}
                            className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-icon-gray transition hover:bg-black/10 hover:text-ink-900"
                          >
                            <CloseIcon className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-muted">Unassigned</span>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={`View ${g.name}'s profile`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewProfile(g.id)
                      }}
                      className="shrink-0 rounded-full px-1.5 py-1 text-[10px] font-semibold text-accent-700 transition hover:bg-accent-700/10"
                    >
                      View
                    </button>
                  </div>
                </li>
              )
            })}
            {sorted.length === 0 && <p className="p-2 text-xs text-muted">No guests match.</p>}
          </ul>
        </>
      )}

      {/* The dragged card's own floating preview — fixed to the viewport
          (not this dock's own layout), same "ghost follows the cursor"
          pattern SeatMapCanvas's library dock already uses for its "+"
          items. */}
      {draggingGuest && (
        <div
          ref={ghostRef}
          className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-xl bg-white py-1.5 pl-1.5 pr-3 shadow-xl ring-2 ring-accent-700"
        >
          <GuestAvatar name={draggingGuest.name} imageUrl={draggingGuest.imageUrl} avatarConfig={draggingGuest.avatarConfig} sizeClassName="h-7 w-7" />
          <span className="whitespace-nowrap text-xs font-semibold text-ink-900">{draggingGuest.name}</span>
        </div>
      )}
    </div>
  )
}
