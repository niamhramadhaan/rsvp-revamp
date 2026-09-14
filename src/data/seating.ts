// Guest <-> seat assignment writes, plus seat <-> seat layout writes
// (swapSeatPositions). The only module that mutates the 'guests'/'seats'
// tables — everything else in data/guests.ts and data/seatmaps.ts is
// read-only. useGuests/useSeatMap already subscribe to these tables (see
// data/hooks.ts), so every write here auto-refreshes both hooks with zero
// changes needed there. getRecentActivity (selectors.ts) already reads
// guest.seatAssignedAt, so setting/clearing it makes assignment show up in
// (or disappear from) the Overview activity feed for free too.

import { readTable, writeTable } from './store'
import { getSeatMapByEvent } from './seatmaps'
import { nextSeatLabel } from './layoutBlocks'
import type { Guest, LayoutBlock, Seat, SeatGroup } from './types'

const GUESTS_TABLE = 'guests'
const SEATS_TABLE = 'seats'
const BLOCKS_TABLE = 'layoutBlocks'

// Must match SeatMapCanvas's own CELL_PX — used below only to find a
// dragged chair's own center point, not to render anything. Not imported
// from there directly: that file is UI, this is data, and the two never
// share a module today (same "kept in sync by comment" convention
// layoutBlocks.ts/seatMapTemplates.ts already use for this exact number).
const SEAT_CELL_PX = 44

// How far a table's own generated chairs normally sit from its edge (see
// layoutBlocks.ts's edgeSeatPositions — the gap plus half a cell works out
// to roughly 30px in practice). This is set well past that so an ordinary
// drag-to-tidy-up nudge never detaches a chair by accident — only a real
// "drag this chair away from the table" gesture does.
const TABLE_DETACH_DISTANCE_PX = 150

// Distance from a point to the nearest edge of a rect — 0 if the point is
// inside/on the rect.
function distanceToRect(px: number, py: number, rect: { x: number; y: number; width: number; height: number }): number {
  const dx = Math.max(rect.x - px, 0, px - (rect.x + rect.width))
  const dy = Math.max(rect.y - py, 0, py - (rect.y + rect.height))
  return Math.hypot(dx, dy)
}

// Assigns `guestId` to `seatId`, freeing whatever seat that guest previously
// held (if any). Two writeTable calls total, never per-guest in a loop — each
// writeTable is a synchronous notify-all-subscribers fan-out (store.ts), so
// every mounted useGuests/useSeatMap consumer would re-fetch per iteration
// otherwise (matters for autoAssignSeats below).
export async function assignSeat(guestId: string, seatId: string): Promise<void> {
  const guests = readTable<Guest>(GUESTS_TABLE)
  const seats = readTable<Seat>(SEATS_TABLE)
  const guest = guests.find((g) => g.id === guestId)
  const seat = seats.find((s) => s.id === seatId)
  if (!guest || !seat || seat.kind !== 'seat') return
  // Defensive only — the UI never offers an already-assigned seat as an
  // assignment target, so this should be unreachable in practice.
  if (seat.status === 'assigned' && guest.seatId !== seatId) return

  const now = new Date().toISOString()
  const previousSeatId = guest.seatId

  writeTable(
    GUESTS_TABLE,
    guests.map((g) => (g.id === guestId ? { ...g, seatId, seatAssignedAt: now } : g))
  )
  writeTable(
    SEATS_TABLE,
    seats.map((s) => {
      if (s.id === seatId) return { ...s, status: 'assigned' as const }
      if (previousSeatId && s.id === previousSeatId) return { ...s, status: 'empty' as const }
      return s
    })
  )
}

export async function unassignSeat(guestId: string): Promise<void> {
  const guests = readTable<Guest>(GUESTS_TABLE)
  const guest = guests.find((g) => g.id === guestId)
  if (!guest?.seatId) return
  const seatId = guest.seatId

  writeTable(
    SEATS_TABLE,
    readTable<Seat>(SEATS_TABLE).map((s) => (s.id === seatId ? { ...s, status: 'empty' as const } : s))
  )
  writeTable(
    GUESTS_TABLE,
    guests.map((g) => (g.id === guestId ? { ...g, seatId: null, seatAssignedAt: null } : g))
  )
}

/** One guest→seat pairing Auto-assign actually made — AutoAssignDrawer plays
 * these back one at a time (a toast plus its own animated reveal list) after
 * the real write below has already happened; this is purely what the
 * presentation layer replays, not a pending/uncommitted plan. */
export interface AutoAssignment {
  guestId: string
  guestName: string
  seatId: string
  seatLabel: string
}

export interface AutoAssignOptions {
  /** Only these guests are eligible — AutoAssignDrawer's own checkbox list,
   * which lists (and lets the admin pick from) every unseated guest
   * regardless of RSVP status, not just confirmed ones — the admin's own
   * checkmark is the consent to seat them, not their RSVP status. Omitted
   * (no other caller does this today) falls back to every unseated guest
   * for this event. */
  guestIds?: string[]
  /** Only seats belonging to this SeatGroup are eligible — AutoAssignDrawer's
   * own group picker ("assign to a group's seats specifically" rather than
   * whichever empty seat comes first regardless of category). Omitted or
   * null means every empty seat, same as before. */
  groupId?: string | null
}

// Fills empty seats (row-major order) with unseated guests (list order) for
// one event — see AutoAssignOptions.guestIds's own doc for why this no
// longer restricts itself to confirmed RSVPs on its own: AutoAssignDrawer's
// checkbox list is the actual gate now, covering pending/declined guests
// too if the admin explicitly picks them. No "keep parties together"
// logic: a guest's own group is now WHATEVER seat they land in here decides
// (see selectors.ts's getGuestGroupLabel) rather than something pre-existing
// to match against, so there's nothing to keep together — first empty seat,
// in order, same as it's always been. Returns every pairing actually made,
// for AutoAssignDrawer's own animated reveal — not just a count.
export async function autoAssignSeats(eventId: string, options?: AutoAssignOptions): Promise<AutoAssignment[]> {
  const seatMap = await getSeatMapByEvent(eventId)
  if (!seatMap) return []

  let emptySeats = readTable<Seat>(SEATS_TABLE).filter((s) => s.seatMapId === seatMap.id && s.kind === 'seat' && s.status === 'empty')
  if (options?.groupId) emptySeats = emptySeats.filter((s) => s.groupId === options.groupId)
  emptySeats.sort((a, b) => a.row - b.row || a.column - b.column)
  if (emptySeats.length === 0) return []

  const guests = readTable<Guest>(GUESTS_TABLE)
  let eligible = guests.filter((g) => g.eventId === eventId && !g.seatId)
  if (options?.guestIds) {
    const idSet = new Set(options.guestIds)
    eligible = eligible.filter((g) => idSet.has(g.id))
  }
  if (eligible.length === 0) return []

  const pairs = eligible.slice(0, emptySeats.length).map((guest, i) => ({ guest, seat: emptySeats[i] }))
  const now = new Date().toISOString()
  const seatIdByGuest = new Map(pairs.map((p) => [p.guest.id, p.seat.id]))
  const guestIdBySeat = new Map(pairs.map((p) => [p.seat.id, p.guest.id]))

  writeTable(
    GUESTS_TABLE,
    guests.map((g) => (seatIdByGuest.has(g.id) ? { ...g, seatId: seatIdByGuest.get(g.id)!, seatAssignedAt: now } : g))
  )
  writeTable(
    SEATS_TABLE,
    readTable<Seat>(SEATS_TABLE).map((s) => (guestIdBySeat.has(s.id) ? { ...s, status: 'assigned' as const } : s))
  )

  return pairs.map((p) => ({ guestId: p.guest.id, guestName: p.guest.name, seatId: p.seat.id, seatLabel: p.seat.label }))
}

// Moves a seat to an arbitrary pixel position on the seat map's free-form
// canvas — the seat map builder's drag-and-drop layout action (see
// SeatMapCanvas's edit mode). id/label/group/status/kind/row/column all stay
// with the seat they already belonged to, so dragging a seat to a new spot
// on the floor plan never changes its label, group, or who's assigned to it.
// Unlike a grid, nothing here prevents two seats landing on the same spot —
// free placement, no slot to collide over.
//
// The one exception: tableBlockId. A table's own generated chairs (see
// layoutBlocks.ts's createTableBlock) start out linked to it specifically so
// dragging the TABLE carries them along and deleteLayoutBlock's own guard
// treats them as "this table's business" — but that link is meant to
// reflect "this chair still belongs at this table," not "this seat was
// generated once, forever." Dragging a chair far enough away from its own
// table (past TABLE_DETACH_DISTANCE_PX) clears that link — it becomes a
// plain standalone seat, no longer counted among the table's own chairs for
// either purpose: the table can then be deleted without that far-flung
// chair blocking it (deleteLayoutBlock only looks at CURRENTLY-linked
// seats), and the chair itself is simply left where it was dragged to
// rather than being deleted or snapped back.
export async function moveSeat(seatId: string, x: number, y: number): Promise<void> {
  const seats = readTable<Seat>(SEATS_TABLE)
  const seat = seats.find((s) => s.id === seatId)
  if (!seat) return

  let tableBlockId = seat.tableBlockId
  if (tableBlockId) {
    const table = readTable<LayoutBlock>(BLOCKS_TABLE).find((b) => b.id === tableBlockId)
    const seatCenterX = x + SEAT_CELL_PX / 2
    const seatCenterY = y + SEAT_CELL_PX / 2
    if (!table || distanceToRect(seatCenterX, seatCenterY, table) > TABLE_DETACH_DISTANCE_PX) {
      tableBlockId = undefined
    }
  }

  writeTable(
    SEATS_TABLE,
    seats.map((s) => (s.id === seatId ? { ...s, x, y, tableBlockId } : s))
  )
}

// Recategorizes one seat — the seat map's own "Switch" action (see
// SeatMapCanvas's selected-seat action bar), cycling a seat between whatever
// SeatGroups this event has (VIP/Regular, typically). An already-assigned
// seat keeps its occupant, whose own displayed group simply follows along
// (see selectors.ts's getGuestGroupLabel) — recoloring a seat is not the
// same action as unseating its guest. The label is regenerated too, using
// the exact same prefix/sequence convention every other seat's label
// already follows (nextSeatLabel, layoutBlocks.ts) — a seat that used to
// read "VIP-3" needs to stop reading that once it's switched to Regular, or
// its own label would keep claiming a category it's no longer in.
export async function updateSeatGroup(seatId: string, groupId: string, groups: SeatGroup[]): Promise<void> {
  const seats = readTable<Seat>(SEATS_TABLE)
  const seat = seats.find((s) => s.id === seatId)
  if (!seat) return
  const group = groups.find((g) => g.id === groupId)
  const label = group ? nextSeatLabel(seats, group) : seat.label

  writeTable(
    SEATS_TABLE,
    seats.map((s) => (s.id === seatId ? { ...s, groupId, label } : s))
  )
}

export interface DeleteSeatResult {
  ok: boolean
  reason?: string
}

// Removes one seat outright — the floor-plan editor's own delete action for
// a selected seat (standalone, or one of a table's generated chairs; a
// table's own deleteLayoutBlock handles removing ALL of a table's chairs at
// once instead of one at a time). Refuses when someone is actually seated
// here — checked directly against the GUESTS table, not seat.status:
// status is only a cached mirror of "does a guest's own seatId point here"
// (see seatmaps.ts's listSeats/reconcileSeatStatuses for the read-time
// half of this same fix), and can go stale via the seat-map editor's own
// undo/redo/Reset restoring an older snapshot of the seat that doesn't
// reflect a since-unassigned guest. A seat stuck reading 'assigned' with no
// real occupant used to be permanently undeletable this same way (blocked
// by a guard that was checking the wrong source of truth); this refuses
// ONLY when someone is actually seated here, which is the one thing this
// guard is actually meant to prevent.
export async function deleteSeat(seatId: string): Promise<DeleteSeatResult> {
  const seats = readTable<Seat>(SEATS_TABLE)
  const seat = seats.find((s) => s.id === seatId)
  if (!seat) return { ok: false, reason: 'Already removed' }
  const hasOccupant = readTable<Guest>(GUESTS_TABLE).some((g) => g.seatId === seatId)
  if (hasOccupant) return { ok: false, reason: 'Unassign the guest here first' }

  writeTable(SEATS_TABLE, seats.filter((s) => s.id !== seatId))
  return { ok: true }
}
