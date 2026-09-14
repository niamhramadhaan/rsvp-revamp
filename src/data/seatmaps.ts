import { genId, readTable, writeTable } from './store'
import type { Guest, Seat, SeatGroup, SeatMap } from './types'

export async function getSeatMapByEvent(eventId: string): Promise<SeatMap | null> {
  return readTable<SeatMap>('seatmaps').find((sm) => sm.eventId === eventId) ?? null
}

// Creates the seat map row itself — no rows/columns/groups/seats of its own
// (those come from either the free-form canvas's own "+" library, one at a
// time, or a template — see seatMapTemplates.ts). Most events never got a
// seat map at all until now: only the one seed event ships with one; every
// event created through CreateEventDrawer had no seat map, and the Guests &
// Seating tab just showed "No seat map yet" with no way to start one.
// Idempotent — returns the existing one if the event somehow already has a
// row here, rather than creating a second.
export async function createSeatMap(eventId: string): Promise<SeatMap> {
  const existing = await getSeatMapByEvent(eventId)
  if (existing) return existing
  const seatMap: SeatMap = { id: genId('seatmap'), eventId, rows: 0, columns: 0, labelScheme: 'group-sequence' }
  writeTable('seatmaps', [...readTable<SeatMap>('seatmaps'), seatMap])
  return seatMap
}

// A seat's own `status` field is really just a cached mirror of "does any
// guest's own seatId point here" — it can go stale relative to the guests
// table itself, most often via the seat-map editor's own undo/redo/Reset
// (restoreSeatMapSnapshot in layoutBlocks.ts): that restores a WHOLE seats
// snapshot, `status` included, from whatever it looked like at the moment
// recordBeforeChange captured it — a plain layout edit (dragging some other
// seat, say), not a guest assignment. If a guest was later unassigned from
// a seat through the ordinary assign/unassign flow (which isn't part of
// this undo stack at all) AFTER that snapshot was taken, hitting Undo/Reset
// can reintroduce the seat's own pre-unassign 'assigned' status even though
// no guest anywhere still points to it. That's worse than a cosmetic
// mismatch: assignSeat's own defensive guard (seating.ts) refuses to put
// anyone else into a seat already reading 'assigned', and deleteSeat
// refuses to remove one — both keyed off this same field — so a seat like
// that gets permanently stuck: visibly "occupied" on the floor plan, absent
// from every guest's own profile, and untouchable by any of the normal UI
// actions.
//
// Reconciled right here, at the one place every seat read already funnels
// through (see useSeatMap in data/hooks.ts), rather than only patched at
// whichever mutation happens to cause it — this catches that class of
// desync regardless of its source, including ones this comment doesn't
// know about yet. The correction is also persisted (not just a display-time
// override), deferred to a microtask so it doesn't fire the 'seats' table's
// own writeTable subscribers re-entrantly in the middle of THIS read.
function reconcileSeatStatuses(seats: Seat[]): Seat[] {
  const occupiedSeatIds = new Set(
    readTable<Guest>('guests')
      .map((g) => g.seatId)
      .filter((id): id is string => Boolean(id))
  )
  let changed = false
  const reconciled = seats.map((s) => {
    const shouldBeAssigned = occupiedSeatIds.has(s.id)
    if (shouldBeAssigned === (s.status === 'assigned')) return s
    changed = true
    return { ...s, status: (shouldBeAssigned ? 'assigned' : 'empty') as Seat['status'] }
  })
  if (changed) {
    queueMicrotask(() => {
      const byId = new Map(reconciled.map((s) => [s.id, s]))
      writeTable(
        'seats',
        readTable<Seat>('seats').map((s) => byId.get(s.id) ?? s)
      )
    })
  }
  return reconciled
}

export async function listSeats(seatMapId: string): Promise<Seat[]> {
  const seats = readTable<Seat>('seats').filter((s) => s.seatMapId === seatMapId)
  return reconcileSeatStatuses(seats)
}

export async function listSeatGroups(seatMapId: string): Promise<SeatGroup[]> {
  return readTable<SeatGroup>('seatGroups').filter((g) => g.seatMapId === seatMapId)
}

// Templates (seatMapTemplates.ts) are the one caller that creates a group
// itself, rather than reading a quota edit against one that already exists
// — a template applied to a brand-new seat map has no groups yet for its
// generated seats to belong to.
export async function createSeatGroup(seatMapId: string, label: string, color: string, quota: number): Promise<SeatGroup> {
  const group: SeatGroup = { id: genId('group'), seatMapId, label, color, quota }
  writeTable('seatGroups', [...readTable<SeatGroup>('seatGroups'), group])
  return group
}

