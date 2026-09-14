// LayoutBlock CRUD — the "component library" pieces (stage, table, custom
// label) that sit on the seat map's free-form canvas alongside Seat, but
// carry no guest-assignment meaning of their own (see LayoutBlock's own doc
// in types.ts). A table-rect is the one block kind that reaches into the
// 'seats' table too, since its chairs are real, ordinarily-assignable Seat
// records generated around it — everything else here only ever touches
// 'layoutBlocks'.

import { genId, readTable, writeTable } from './store'
import type { Guest, LayoutBlock, Seat, SeatGroup } from './types'

const BLOCKS_TABLE = 'layoutBlocks'
const SEATS_TABLE = 'seats'
const GUESTS_TABLE = 'guests'

// Must match SeatMapCanvas's own CELL_PX — a generated chair needs to be the
// same size as every other seat tile it sits next to. Not imported from
// there directly: that file is UI, this is data, and the two never share a
// module today: kept in sync by this comment instead of a new shared
// constants file for one number.
const SEAT_CELL_PX = 44
const SEAT_GAP_PX = 8

export async function listLayoutBlocks(seatMapId: string): Promise<LayoutBlock[]> {
  return readTable<LayoutBlock>(BLOCKS_TABLE).filter((b) => b.seatMapId === seatMapId)
}

export async function createStageBlock(seatMapId: string, x: number, y: number): Promise<LayoutBlock> {
  const block: LayoutBlock = { id: genId('block'), seatMapId, kind: 'stage', x, y, width: 240, height: 64, label: 'Stage' }
  writeTable(BLOCKS_TABLE, [...readTable<LayoutBlock>(BLOCKS_TABLE), block])
  return block
}

export async function createLabelBlock(seatMapId: string, x: number, y: number): Promise<LayoutBlock> {
  const block: LayoutBlock = { id: genId('block'), seatMapId, kind: 'label', x, y, width: 120, height: 40, label: 'Label' }
  writeTable(BLOCKS_TABLE, [...readTable<LayoutBlock>(BLOCKS_TABLE), block])
  return block
}

// The prefix/sequence convention SEED_SEATS already uses ("VIP-1", "REG-1",
// ...) — a group's first three letters, uppercased, then the next unused
// number for that group. Recomputed from the current seat count rather than
// tracked separately, so it needs no extra state; the one tradeoff is a
// label could repeat a previously-used number after that seat's been
// deleted, which never causes a collision (labels are display text, not an
// id) and matches this app's general "don't over-build a v1" bar. Exported
// for seating.ts's updateSeatGroup, which reuses this same convention to
// regenerate a seat's label when its group changes (a "VIP-3" switched to
// Regular needs to stop reading "VIP-3").
export function nextSeatLabel(existingSeats: Seat[], group: SeatGroup): string {
  const prefix = group.label.slice(0, 3).toUpperCase()
  const countInGroup = existingSeats.filter((s) => s.groupId === group.id && s.kind === 'seat').length
  return `${prefix}-${countInGroup + 1}`
}

// Which SeatGroup a freshly-placed library item (a standalone seat, or a
// table's own generated chairs) lands in by default — prefers whichever
// group is actually labeled "Regular" (case-insensitive), not just whichever
// one happens to sort first. The seed data's own groups array lists VIP
// before Regular, so "the first group" silently meant "every new seat off
// the dock defaults to VIP" — backwards from what an admin actually wants
// most of the time (VIP is the exception seat, not the common one). Falls
// back to the first group when there's genuinely nothing called "Regular"
// (a custom-configured event with its own category names, say), so this
// never throws for lack of an exact match.
function defaultSeatGroup(groups: SeatGroup[]): SeatGroup {
  return groups.find((g) => g.label.trim().toLowerCase() === 'regular') ?? groups[0]
}

// Evenly spaces `perEdge` chairs along a table's top and bottom long edges,
// centered on the table's own width — used by createTableBlock, and kept
// separate so the geometry is easy to eyeball independent of the seat
// records it ends up producing. Exported for seatMapTemplates.ts, which
// generates several tables' worth of chairs at once rather than one at a
// time through createTableBlock.
export function edgeSeatPositions(tableX: number, tableY: number, tableWidth: number, tableHeight: number, perEdge: number) {
  const rowWidth = perEdge * SEAT_CELL_PX + (perEdge - 1) * SEAT_GAP_PX
  const startX = tableX + (tableWidth - rowWidth) / 2
  const topY = tableY - SEAT_CELL_PX - SEAT_GAP_PX
  const bottomY = tableY + tableHeight + SEAT_GAP_PX
  const xs = Array.from({ length: perEdge }, (_, i) => startX + i * (SEAT_CELL_PX + SEAT_GAP_PX))
  return [...xs.map((sx) => ({ x: sx, y: topY })), ...xs.map((sx) => ({ x: sx, y: bottomY }))]
}

// A rectangular table plus its own chairs, generated once at creation and
// evenly split across the two long edges. seatCount is fixed for the life
// of the table — resizing the table later (SeatMapCanvas's own resize
// handles) changes its visual footprint only; it does not regenerate or
// reflow these seats, which stay independently draggable like any other
// seat from then on.
export async function createTableBlock(
  seatMapId: string,
  groups: SeatGroup[],
  existingSeats: Seat[],
  x: number,
  y: number,
  seatCount: 4 | 6
): Promise<LayoutBlock | null> {
  if (groups.length === 0) return null // nothing to assign a new chair's category to

  const width = seatCount === 4 ? 110 : 150
  const height = 48
  const block: LayoutBlock = { id: genId('block'), seatMapId, kind: 'table-rect', x, y, width, height, label: '' }
  // Defaults to Regular (see defaultSeatGroup) — the library item is a plain
  // one-tap "Table · 4" button, not a form, so there's no category picker
  // for it to read from yet. Nothing else in this app can change a seat's
  // groupId once created (dragging only ever moves x/y), so this is a real
  // limitation, not just a starting default — a fast follow would add a
  // group picker to the library item, or a way to recolor an existing seat.
  const group = defaultSeatGroup(groups)
  const positions = edgeSeatPositions(x, y, width, height, seatCount / 2)
  let seatsSoFar = existingSeats

  const newSeats: Seat[] = positions.map((pos, i) => {
    const seat: Seat = {
      id: genId('seat'),
      seatMapId,
      groupId: group.id,
      row: -1, // -1 marks a hand-placed seat, sorting after every seeded grid row in auto-assign/check-in ordering
      column: i,
      x: pos.x,
      y: pos.y,
      label: nextSeatLabel(seatsSoFar, group),
      kind: 'seat',
      status: 'empty',
      tableBlockId: block.id,
    }
    seatsSoFar = [...seatsSoFar, seat] // each subsequent label counts the ones just generated too
    return seat
  })

  writeTable(BLOCKS_TABLE, [...readTable<LayoutBlock>(BLOCKS_TABLE), block])
  writeTable(SEATS_TABLE, [...readTable<Seat>(SEATS_TABLE), ...newSeats])
  return block
}

// The "+ Seat" library item — a single freestanding chair, the one seat
// creation path that isn't tied to a table. Same label convention as every
// other generated seat.
export async function createStandaloneSeat(
  seatMapId: string,
  groups: SeatGroup[],
  existingSeats: Seat[],
  x: number,
  y: number
): Promise<Seat | null> {
  if (groups.length === 0) return null
  const group = defaultSeatGroup(groups)
  const seat: Seat = {
    id: genId('seat'),
    seatMapId,
    groupId: group.id,
    row: -1,
    column: 0,
    x,
    y,
    label: nextSeatLabel(existingSeats, group),
    kind: 'seat',
    status: 'empty',
  }
  writeTable(SEATS_TABLE, [...readTable<Seat>(SEATS_TABLE), seat])
  return seat
}

// Moves a block to a new position — and, for a table-rect, its own
// generated chairs along with it (by the same delta), so dragging the
// table doesn't strand its seats behind. A resize (see resizeLayoutBlock)
// deliberately does NOT get this treatment — see createTableBlock's doc.
export async function moveLayoutBlock(blockId: string, x: number, y: number): Promise<void> {
  const blocks = readTable<LayoutBlock>(BLOCKS_TABLE)
  const block = blocks.find((b) => b.id === blockId)
  if (!block) return
  const dx = x - block.x
  const dy = y - block.y

  writeTable(
    BLOCKS_TABLE,
    blocks.map((b) => (b.id === blockId ? { ...b, x, y } : b))
  )
  if (block.kind === 'table-rect' && (dx !== 0 || dy !== 0)) {
    writeTable(
      SEATS_TABLE,
      readTable<Seat>(SEATS_TABLE).map((s) => (s.tableBlockId === blockId ? { ...s, x: s.x + dx, y: s.y + dy } : s))
    )
  }
}

// Takes x/y too, not just width/height — a corner-anchored resize (any
// corner but bottom-right) moves the block's own top-left as it shrinks/
// grows, not just its size. Deliberately separate from moveLayoutBlock:
// resizing a table does NOT shift its own generated chairs the way dragging
// it does (see createTableBlock's own doc) — reflowing seats to match an
// arbitrary new footprint is real geometry work a v1 doesn't take on, so a
// resized table's chairs stay exactly where they were.
export async function resizeLayoutBlock(blockId: string, x: number, y: number, width: number, height: number): Promise<void> {
  const blocks = readTable<LayoutBlock>(BLOCKS_TABLE)
  if (!blocks.some((b) => b.id === blockId)) return
  writeTable(
    BLOCKS_TABLE,
    blocks.map((b) => (b.id === blockId ? { ...b, x: Math.max(0, x), y: Math.max(0, y), width: Math.max(40, width), height: Math.max(32, height) } : b))
  )
}

export async function renameLayoutBlock(blockId: string, label: string): Promise<void> {
  const blocks = readTable<LayoutBlock>(BLOCKS_TABLE)
  if (!blocks.some((b) => b.id === blockId)) return
  writeTable(
    BLOCKS_TABLE,
    blocks.map((b) => (b.id === blockId ? { ...b, label } : b))
  )
}

export interface DeleteBlockResult {
  ok: boolean
  /** Only set when ok is false — a message the caller can hand straight to
   * a toast. */
  reason?: string
}

// Refuses to delete a table that still has a checked-in-worthy guest seated
// at it (mirrors unassignSeat's own "ask first" spirit) rather than
// silently orphaning guest.seatId references. Non-table blocks (stage,
// label) have no linked seats, so this check is simply a no-op for them.
export async function deleteLayoutBlock(blockId: string): Promise<DeleteBlockResult> {
  const blocks = readTable<LayoutBlock>(BLOCKS_TABLE)
  const block = blocks.find((b) => b.id === blockId)
  if (!block) return { ok: false, reason: 'Already removed' }

  // Checked against the GUESTS table directly, not each seat's own status —
  // see deleteSeat's own doc (seating.ts) for why status can go stale and
  // permanently block a delete that should actually be allowed.
  const linkedSeats = readTable<Seat>(SEATS_TABLE).filter((s) => s.tableBlockId === blockId)
  const occupiedSeatIds = new Set(
    readTable<Guest>(GUESTS_TABLE)
      .map((g) => g.seatId)
      .filter((id): id is string => Boolean(id))
  )
  if (linkedSeats.some((s) => occupiedSeatIds.has(s.id))) {
    return { ok: false, reason: 'Unassign every guest at this table first' }
  }

  writeTable(BLOCKS_TABLE, blocks.filter((b) => b.id !== blockId))
  if (linkedSeats.length > 0) {
    writeTable(SEATS_TABLE, readTable<Seat>(SEATS_TABLE).filter((s) => s.tableBlockId !== blockId))
  }
  return { ok: true }
}

// Wipes every seat and block for this seat map to a blank canvas.
// Deliberately does NOT touch seatGroups (those are event-level category
// config, edited from EditEventDrawer, not part of "the floor plan") —
// clearing the canvas doesn't mean forgetting what categories this event
// has. NOT what the editor's own "Reset to default" button calls anymore —
// that now restores the pre-edit-session snapshot instead (see
// useSeatMapHistory's resetToBaseline, which goes through
// restoreSeatMapSnapshot below), so an admin doesn't lose the whole floor
// plan just for backing out an accidental drag. Kept as its own primitive
// for a genuine "start this floor plan over from nothing," should that ever
// get its own entry point again.
export async function resetSeatMap(seatMapId: string): Promise<void> {
  writeTable(SEATS_TABLE, readTable<Seat>(SEATS_TABLE).filter((s) => s.seatMapId !== seatMapId))
  writeTable(BLOCKS_TABLE, readTable<LayoutBlock>(BLOCKS_TABLE).filter((b) => b.seatMapId !== seatMapId))
}

// Overwrites every seat/block belonging to one seat map with an exact
// snapshot — undo/redo's one primitive (see useSeatMapHistory). A whole-
// snapshot restore, not a replay of individual add/move/delete commands: far
// simpler to get right for this app's size of data, at the cost of also
// reverting anything else that happened to this seat map's rows in between
// (a guest assignment made mid-edit-session, say) — undo/redo here is scoped
// to layout edits, not guest assignment, and that's the documented tradeoff.
export async function restoreSeatMapSnapshot(seatMapId: string, seats: Seat[], layoutBlocks: LayoutBlock[]): Promise<void> {
  writeTable(SEATS_TABLE, [...readTable<Seat>(SEATS_TABLE).filter((s) => s.seatMapId !== seatMapId), ...seats])
  writeTable(BLOCKS_TABLE, [...readTable<LayoutBlock>(BLOCKS_TABLE).filter((b) => b.seatMapId !== seatMapId), ...layoutBlocks])
}

// The floor-plan editor's own "Renumber seats" action — re-sequences every
// seat's own label back to a clean 1..N run per group, closing whatever
// gaps deleting seats along the way left behind (e.g. "REG-1, REG-2, REG-4"
// reads oddly once REG-3 is gone). Each group's seats keep their existing
// relative order — sorted by whatever number is already in their current
// label, not reshuffled by position on the canvas — so this only closes
// gaps rather than renumbering seats into some new arrangement; a seat
// whose label was hand-edited into something with no parseable number (rare
// — nothing in this app's own UI does that today) just falls back to
// row/column, the same stable tiebreaker autoAssignSeats already sorts
// empty seats by. A seat whose groupId no longer matches any of this
// event's current groups (orphaned some other way) is left untouched rather
// than guessed at.
export async function renumberSeatLabels(seatMapId: string, groups: SeatGroup[]): Promise<void> {
  const seats = readTable<Seat>(SEATS_TABLE)
  const relevant = seats.filter((s) => s.seatMapId === seatMapId && s.kind === 'seat')
  if (relevant.length === 0) return

  const nextLabel = new Map<string, string>()
  for (const group of groups) {
    const prefix = group.label.slice(0, 3).toUpperCase()
    const groupSeats = relevant
      .filter((s) => s.groupId === group.id)
      .slice()
      .sort((a, b) => {
        const na = parseInt(a.label.replace(/[^0-9]/g, ''), 10)
        const nb = parseInt(b.label.replace(/[^0-9]/g, ''), 10)
        if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb
        return a.row - b.row || a.column - b.column
      })
    groupSeats.forEach((seat, i) => nextLabel.set(seat.id, `${prefix}-${i + 1}`))
  }

  writeTable(
    SEATS_TABLE,
    seats.map((s) => (nextLabel.has(s.id) ? { ...s, label: nextLabel.get(s.id)! } : s))
  )
}

// Copies a block at a small fixed offset — for a table-rect, generates a
// fresh set of empty chairs the same way createTableBlock does (never
// carrying over the original's guest assignments, which wouldn't make sense
// on a seat that didn't exist a moment ago).
export async function duplicateLayoutBlock(
  blockId: string,
  groups: SeatGroup[],
  existingSeats: Seat[]
): Promise<LayoutBlock | null> {
  const block = readTable<LayoutBlock>(BLOCKS_TABLE).find((b) => b.id === blockId)
  if (!block) return null
  const OFFSET = 24
  const x = block.x + OFFSET
  const y = block.y + OFFSET

  if (block.kind === 'table-rect') {
    const seatCount = readTable<Seat>(SEATS_TABLE).filter((s) => s.tableBlockId === blockId).length
    return createTableBlock(block.seatMapId, groups, existingSeats, x, y, seatCount === 6 ? 6 : 4)
  }

  const copy: LayoutBlock = { ...block, id: genId('block'), x, y }
  writeTable(BLOCKS_TABLE, [...readTable<LayoutBlock>(BLOCKS_TABLE), copy])
  return copy
}

// A single seat's own "Duplicate" (the selected-seat action bar, same
// button duplicateLayoutBlock already sat behind for a block). Unlike a
// block's fixed 24px diagonal OFFSET above, a lone 44px chair nudged only
// 24px would land mostly on top of itself rather than reading as "here's a
// second one" — so this instead walks straight out from the original, one
// SEAT_CELL_PX+SEAT_GAP_PX step at a time (the same spacing a table's own
// generated chairs already sit at), until it finds an x nothing else — seat
// or block — already occupies at that y. That's the "ordered neatly" this
// is actually for: a row of seats gets its duplicate appended cleanly past
// the end of the row instead of stacked invisibly on whatever's already
// there.
//
// Always becomes its own standalone seat, even duplicating one of a table's
// generated chairs — the copy isn't part of that table's own even-spacing
// math, so carrying its tableBlockId over would misleadingly drag the copy
// along whenever the table itself moves. Same "never carries over the
// original's assignment" rule duplicateLayoutBlock's own table-rect chairs
// already follow (starts 'empty'), and gets a fresh sequential label
// (nextSeatLabel) rather than literally copying the original's — two seats
// both reading "REG-9" would be its own kind of confusing.
export async function duplicateSeat(seatId: string, groups: SeatGroup[]): Promise<Seat | null> {
  const seats = readTable<Seat>(SEATS_TABLE)
  const original = seats.find((s) => s.id === seatId)
  if (!original) return null
  const group = groups.find((g) => g.id === original.groupId) ?? groups[0]
  if (!group) return null

  const blocks = readTable<LayoutBlock>(BLOCKS_TABLE)
  const step = SEAT_CELL_PX + SEAT_GAP_PX
  const y = original.y
  const seatTaken = (px: number) => seats.some((s) => Math.abs(s.x - px) < SEAT_CELL_PX && Math.abs(s.y - y) < SEAT_CELL_PX)
  const blockTaken = (px: number) =>
    blocks.some((b) => px < b.x + b.width && px + SEAT_CELL_PX > b.x && y < b.y + b.height && y + SEAT_CELL_PX > b.y)

  let x = original.x + step
  // Bounded, not an infinite while — a pathological wall-to-wall row of
  // seats still terminates the search rather than hanging the tab.
  for (let tries = 0; tries < 500 && (seatTaken(x) || blockTaken(x)); tries += 1) {
    x += step
  }

  const seat: Seat = {
    id: genId('seat'),
    seatMapId: original.seatMapId,
    groupId: group.id,
    row: -1, // -1 marks a hand-placed seat, same convention createStandaloneSeat uses
    column: 0,
    x,
    y,
    label: nextSeatLabel(seats, group),
    kind: 'seat',
    status: 'empty',
  }
  writeTable(SEATS_TABLE, [...seats, seat])
  return seat
}
