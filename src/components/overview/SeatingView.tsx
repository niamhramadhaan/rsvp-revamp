import { useMemo, useState } from 'react'
import type { Guest, LayoutBlock, Seat, SeatGroup, SeatMap } from '../../data/types'
import { indexGuestsBySeat } from '../../data/selectors'
import { assignSeat, deleteSeat, moveSeat, unassignSeat, updateSeatGroup } from '../../data/seating'
import {
  createLabelBlock,
  createStageBlock,
  createStandaloneSeat,
  createTableBlock,
  deleteLayoutBlock,
  duplicateLayoutBlock,
  duplicateSeat,
  moveLayoutBlock,
  renameLayoutBlock,
  renumberSeatLabels,
  resizeLayoutBlock,
} from '../../data/layoutBlocks'
import { applyTemplate, type ApplyTemplateResult, type SeatMapTemplateId } from '../../data/seatMapTemplates'
import { useSeatMapHistory } from '../../hooks/useSeatMapHistory'
import SeatMapCanvas, { type LibraryItemId } from './SeatMapCanvas'
import AutoAssignDrawer from './AutoAssignDrawer'
import type { ToastTone } from '../Toast'

// A seat's own footprint, and the gap a fresh row of them is placed with —
// kept in sync with SeatMapCanvas's CELL_PX and seatMapTemplates.ts's
// SEAT_CELL_PX/SEAT_GAP_PX by comment, same convention every one of those
// already follows (never imported from a UI file directly: this is data,
// that's UI, and the two don't share a module). handleBulkAlign below is the
// only place *this* file needs the actual numbers, not just the seat's own
// x/y.
const SEAT_CELL_PX = 44
const SEAT_GAP_PX = 10

export interface SeatingViewProps {
  eventId: string | null
  guests: Guest[]
  seatMap: SeatMap | null
  seats: Seat[]
  groups: SeatGroup[]
  layoutBlocks: LayoutBlock[]
  onToast: (message: string, tone?: ToastTone) => void
  /** Opens the shared guest-profile drawer — owned by OverviewContent (see
   * its own comment) so the same drawer instance works from every surface
   * that needs it. */
  onViewProfile: (guestId: string) => void
}

// The seat map's own tab now — full width, no guest-list panel sharing the
// page with it (see EventTabs' own doc for why that split from "Guests &
// Seating"). SeatMapCanvas renders its own floating guest dock internally
// (GuestDock) for assigning guests to seats, so this component's job is
// narrower than the old combined view's was: own the floor-plan-editing
// history and every data-layer handler SeatMapCanvas calls up into, nothing
// about browsing/filtering the roster (that's GuestsView's job now).
export default function SeatingView({ eventId, guests, seatMap, seats, groups, layoutBlocks, onToast, onViewProfile }: SeatingViewProps) {
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null)
  // Whether the current selectedGuestId is actually armed to land on
  // whichever empty seat gets tapped next. Only GuestDock's own "pick a
  // guest, then tap a seat" flow (handleSelectGuest below) arms this —
  // clicking an already-OCCUPIED seat also sets selectedGuestId (so its own
  // seat highlights and "whose seat is this" reads correctly), but that's a
  // "look who's here" action, not "move someone." Without this split, seat
  // A -> seat B (both clicks, no guest ever picked from the dock) silently
  // relocated seat A's own occupant to seat B — a real, surprising move a
  // staff member never asked for, just from clicking around the floor plan.
  const [assignArmed, setAssignArmed] = useState(false)
  // "Auto assign"'s own side drawer (guest checkboxes + a target-group
  // picker, see AutoAssignDrawer) — replaces the old one-click "fill
  // everything" action, which had no way to say "just these people" or
  // "only into VIP seats."
  const [autoAssignOpen, setAutoAssignOpen] = useState(false)

  const history = useSeatMapHistory(seatMap?.id, seats, layoutBlocks)

  const guestBySeat = useMemo(() => indexGuestsBySeat(guests), [guests])

  function handleSelectGuest(id: string) {
    const next = selectedGuestId === id ? null : id
    setSelectedGuestId(next)
    setAssignArmed(next !== null)
  }

  // Shared by both ways a guest actually lands on a seat now: the older
  // select-a-guest-then-tap-an-empty-seat flow (handleSeatClick below) and
  // GuestDock's own direct drag-a-card-onto-a-seat.
  function handleAssignGuestToSeat(guestId: string, seatId: string) {
    const guest = guests.find((g) => g.id === guestId)
    const seat = seats.find((s) => s.id === seatId)
    assignSeat(guestId, seatId).then(() => {
      onToast(`${guest?.name ?? 'Guest'} assigned to ${seat?.label ?? 'seat'}`)
      if (selectedGuestId === guestId) {
        setSelectedGuestId(null)
        setAssignArmed(false)
      }
    })
  }

  function handleSeatClick(seat: Seat) {
    if (seat.kind === 'gap') return

    const occupant = guestBySeat.get(seat.id)
    if (occupant) {
      // Clicking any occupied seat always answers "whose seat is this" —
      // it wins over whatever was previously selected. Not armed to assign,
      // though: this is a "look who's here" click, not "move this guest" —
      // see assignArmed's own doc for why that distinction matters.
      setSelectedGuestId(occupant.id)
      setAssignArmed(false)
      return
    }

    if (!selectedGuestId || !assignArmed) {
      onToast('Select a guest first', 'warning')
      return
    }

    handleAssignGuestToSeat(selectedGuestId, seat.id)
  }

  function handleUnassign(guestId: string) {
    const guest = guests.find((g) => g.id === guestId)
    unassignSeat(guestId).then(() => onToast(`${guest?.name ?? 'Guest'} unassigned`))
  }

  function handleAutoAssign() {
    if (!eventId) {
      onToast('Select an event first', 'warning')
      return
    }
    setAutoAssignOpen(true)
  }

  // Every one of these calls history.recordBeforeChange() first — capturing
  // the state as it stood immediately before THIS mutation, which is what
  // makes Undo step back through them one at a time rather than only ever
  // being able to jump straight to the very first edit (see
  // useSeatMapHistory's own doc for why this is a whole-snapshot stack).

  // Seat map builder's drag layout edit (SeatMapCanvas's edit mode) —
  // repositions one seat on the free-form canvas. Distinct from
  // assignSeat/unassignSeat above: nothing about who's assigned to which
  // seat changes, only where that seat physically sits on the floor plan.
  function handleMoveSeat(seatId: string, x: number, y: number) {
    history.recordBeforeChange()
    moveSeat(seatId, x, y)
  }

  // Component library — places a new seat/stage/table/label near wherever
  // the canvas is currently scrolled to (SeatMapCanvas already worked out
  // x/y). Table/seat creation can fail if this seat map has no groups at
  // all yet (nothing to assign a new chair's category to) — surfaced as a
  // toast rather than a silent no-op; recordBeforeChange still runs first
  // regardless (a no-op snapshot when nothing ends up created is harmless).
  function handleAddFromLibrary(item: LibraryItemId, x: number, y: number) {
    if (!seatMap) return
    history.recordBeforeChange()
    switch (item) {
      case 'seat':
        createStandaloneSeat(seatMap.id, groups, seats, x, y).then((seat) => {
          if (!seat) onToast('Add a seat category first', 'warning')
        })
        return
      case 'stage':
        createStageBlock(seatMap.id, x, y)
        return
      case 'table-4':
      case 'table-6':
        createTableBlock(seatMap.id, groups, seats, x, y, item === 'table-4' ? 4 : 6).then((block) => {
          if (!block) onToast('Add a seat category first', 'warning')
        })
        return
      case 'label':
        createLabelBlock(seatMap.id, x, y)
        return
    }
  }

  function handleMoveBlock(blockId: string, x: number, y: number) {
    history.recordBeforeChange()
    moveLayoutBlock(blockId, x, y)
  }

  function handleResizeBlock(blockId: string, x: number, y: number, width: number, height: number) {
    history.recordBeforeChange()
    resizeLayoutBlock(blockId, x, y, width, height)
  }

  function handleRenameBlock(blockId: string, label: string) {
    history.recordBeforeChange()
    renameLayoutBlock(blockId, label)
  }

  function handleDeleteBlock(blockId: string) {
    history.recordBeforeChange()
    deleteLayoutBlock(blockId).then((result) => {
      if (!result.ok) onToast(result.reason ?? 'Could not delete', 'warning')
    })
  }

  function handleDuplicateBlock(blockId: string) {
    history.recordBeforeChange()
    duplicateLayoutBlock(blockId, groups, seats)
  }

  // The selected-seat action bar's own "Duplicate" — see duplicateSeat's
  // own doc for why this needs a different placement search than a block's
  // fixed offset does.
  function handleDuplicateSeat(seatId: string) {
    history.recordBeforeChange()
    duplicateSeat(seatId, groups)
  }

  function handleDeleteSeat(seatId: string) {
    history.recordBeforeChange()
    deleteSeat(seatId).then((result) => {
      if (!result.ok) onToast(result.reason ?? 'Could not delete', 'warning')
    })
  }

  function handleSwitchSeatGroup(seatId: string, groupId: string) {
    history.recordBeforeChange()
    updateSeatGroup(seatId, groupId, groups)
  }

  // Same per-item pattern as the single-select handlers above, just looped —
  // SeatMapCanvas's own marquee already resolved which ids are in play and
  // clears its selection itself once these resolve.
  function handleBulkDelete(seatIds: string[], blockIds: string[]) {
    history.recordBeforeChange()
    seatIds.forEach((id) => {
      deleteSeat(id).then((result) => {
        if (!result.ok) onToast(result.reason ?? 'Could not delete', 'warning')
      })
    })
    blockIds.forEach((id) => {
      deleteLayoutBlock(id).then((result) => {
        if (!result.ok) onToast(result.reason ?? 'Could not delete', 'warning')
      })
    })
  }

  function handleBulkDuplicate(seatIds: string[], blockIds: string[]) {
    history.recordBeforeChange()
    // Seats first: duplicateSeat's own neat-placement search reads a fresh
    // seat snapshot every call, so looping it here (not Promise.all/forEach
    // racing) naturally steps each new copy around whatever the previous
    // one in this same batch just placed, instead of stacking them.
    seatIds.forEach((id) => duplicateSeat(id, groups))
    blockIds.forEach((id) => duplicateLayoutBlock(id, groups, seats))
  }

  // "Align" on a marquee selection — snaps every selected seat/block onto
  // one shared row or column AND re-spaces it using this floor plan's own
  // standard seat margin (SEAT_GAP_PX, the same gap a freshly-placed
  // template row already uses), so a staff member doesn't have to nudge
  // each one into place by hand. `axis` picks which: 'horizontal' (the
  // original behavior) lines everything onto a shared y and packs
  // left-to-right; 'vertical' lines everything onto a shared x and packs
  // top-to-bottom — see the bulk action bar's own Align ↔/Align ↕ buttons.
  //
  // The shared coordinate is the SELECTION'S OWN average (of y for
  // horizontal, x for vertical), not e.g. the topmost/leftmost item's, so
  // one seat that's wildly out of line doesn't drag the whole row/column up
  // or down to meet it — every item moves a little rather than all-but-one
  // moving a lot.
  //
  // The other axis is repacked, not just left alone: current order along it
  // is preserved (whatever was leftmost/topmost stays that way), but each
  // item's own position becomes "wherever the previous item's own far edge
  // plus the standard gap lands" — the same edge-to-edge spacing rule a
  // table's own generated chairs or a template's own row already place
  // seats with. A block's own width/height counts toward that running total
  // (not just SEAT_CELL_PX), so a mixed seats+blocks selection still packs
  // cleanly instead of overlapping or leaving an oversized gap around
  // whichever item is bigger than a seat. The very first item's own
  // position along that axis is left exactly where it already was — there's
  // no "correct" absolute start to snap the whole row/column to, only a
  // correct spacing between its members.
  function handleBulkAlign(seatIds: string[], blockIds: string[], axis: 'horizontal' | 'vertical') {
    const items = [
      ...seats
        .filter((s) => seatIds.includes(s.id))
        .map((s) => ({ id: s.id, x: s.x, y: s.y, width: SEAT_CELL_PX, height: SEAT_CELL_PX, isSeat: true as const })),
      ...layoutBlocks
        .filter((b) => blockIds.includes(b.id))
        .map((b) => ({ id: b.id, x: b.x, y: b.y, width: b.width, height: b.height, isSeat: false as const })),
    ]
    if (items.length < 2) return
    history.recordBeforeChange()
    if (axis === 'horizontal') {
      const avgY = Math.round(items.reduce((sum, item) => sum + item.y, 0) / items.length)
      let cursorX = Math.min(...items.map((item) => item.x))
      for (const item of [...items].sort((a, b) => a.x - b.x)) {
        if (item.isSeat) moveSeat(item.id, cursorX, avgY)
        else moveLayoutBlock(item.id, cursorX, avgY)
        cursorX += item.width + SEAT_GAP_PX
      }
    } else {
      const avgX = Math.round(items.reduce((sum, item) => sum + item.x, 0) / items.length)
      let cursorY = Math.min(...items.map((item) => item.y))
      for (const item of [...items].sort((a, b) => a.y - b.y)) {
        if (item.isSeat) moveSeat(item.id, avgX, cursorY)
        else moveLayoutBlock(item.id, avgX, cursorY)
        cursorY += item.height + SEAT_GAP_PX
      }
    }
  }

  // "Switch" on a marquee selection — each selected seat cycles to its OWN
  // next SeatGroup independently (same rule the single-select Switch action
  // already uses via updateSeatGroup's own label regeneration), not one
  // target group forced onto every seat regardless of what it already was.
  // Blocks in the same selection are simply skipped; they have no group.
  function handleBulkSwitchGroup(seatIds: string[]) {
    if (groups.length < 2) return
    history.recordBeforeChange()
    seatIds.forEach((id) => {
      const seat = seats.find((s) => s.id === id)
      if (!seat) return
      const currentIndex = groups.findIndex((g) => g.id === seat.groupId)
      const next = groups[(currentIndex + 1) % groups.length]
      updateSeatGroup(id, next.id, groups)
    })
  }

  // Dragging any one seat/block that's part of the current bulk selection
  // moves the whole group by the same delta (see SeatMapCanvas's own
  // onBulkMove doc for how it computes dx/dy from whichever tile was
  // actually dragged) — one recordBeforeChange for the whole gesture, same
  // as every other layout mutation here, so Undo steps back through it as
  // one move, not N.
  function handleBulkMove(seatIds: string[], blockIds: string[], dx: number, dy: number) {
    history.recordBeforeChange()
    // Blocks first, then seats — moveSeat (seating.ts) now checks a chair's
    // own distance from its table to decide whether to detach it (see that
    // function's own doc), reading the table's CURRENT position fresh from
    // the store. If a table and its own chairs are bulk-selected and
    // dragged together (same dx/dy for both), the table needs to already be
    // at its new spot by the time each chair's distance is checked, or the
    // chair would be measured against the table's stale, pre-move position
    // and look like it moved away from it even though their relative
    // distance never actually changed.
    blockIds.forEach((id) => {
      const b = layoutBlocks.find((b) => b.id === id)
      if (b) moveLayoutBlock(id, Math.max(0, b.x + dx), Math.max(0, b.y + dy))
    })
    seatIds.forEach((id) => {
      const s = seats.find((s) => s.id === id)
      if (s) moveSeat(id, Math.max(0, s.x + dx), Math.max(0, s.y + dy))
    })
  }

  // SeatMapCanvas's own confirm dialog has already asked by the time this
  // runs (both the explicit "Reset to default" button and discarding
  // changes on the way out of edit mode land here) — see
  // useSeatMapHistory's own resetToBaseline doc for what this actually
  // restores (how the floor plan looked when this editing session opened,
  // not a blank canvas).
  function handleResetToDefault() {
    if (!seatMap) return
    history.resetToBaseline()
    onToast('Floor plan restored')
  }

  // Toolbar's own "Renumber seats" — closes whatever label gaps deleting
  // seats along the way left behind, without touching who's assigned where
  // or where anything actually sits on the canvas (see renumberSeatLabels'
  // own doc). Undoable like every other layout edit here, so a renumber
  // that lands wrong (a seat got hand-labeled in a way that read oddly once
  // resorted, say) is one Ctrl/Cmd+Z away from back out.
  function handleRenumberSeats() {
    if (!seatMap) return
    history.recordBeforeChange()
    renumberSeatLabels(seatMap.id, groups).then(() => onToast('Seat numbers renumbered'))
  }

  // SeatMapCanvas's own template modal shows the failure reason itself (see
  // its own doc for why this returns a result rather than void) — no toast
  // needed here either way, the same "the visible change is its own
  // confirmation" spirit handleAddFromLibrary's own success path already
  // has.
  function handleApplyTemplate(templateId: SeatMapTemplateId): Promise<ApplyTemplateResult> {
    if (!eventId) return Promise.resolve({ ok: false, reason: 'Select an event first' })
    history.recordBeforeChange()
    return applyTemplate(eventId, templateId)
  }

  return (
    <>
      <SeatMapCanvas
        seatMap={seatMap}
        seats={seats}
        groups={groups}
        layoutBlocks={layoutBlocks}
        guestBySeat={guestBySeat}
        guests={guests}
        selectedGuestId={selectedGuestId}
        onSelectGuest={handleSelectGuest}
        onUnassignSeat={handleUnassign}
        onAssignGuestToSeat={handleAssignGuestToSeat}
        onViewProfile={onViewProfile}
        onAutoAssign={handleAutoAssign}
        onToast={onToast}
        onSeatClick={handleSeatClick}
        onMoveSeat={handleMoveSeat}
        onAddFromLibrary={handleAddFromLibrary}
        onMoveBlock={handleMoveBlock}
        onResizeBlock={handleResizeBlock}
        onRenameBlock={handleRenameBlock}
        onDeleteBlock={handleDeleteBlock}
        onDuplicateBlock={handleDuplicateBlock}
        onDuplicateSeat={handleDuplicateSeat}
        onDeleteSeat={handleDeleteSeat}
        onSwitchSeatGroup={handleSwitchSeatGroup}
        onBulkDelete={handleBulkDelete}
        onBulkDuplicate={handleBulkDuplicate}
        onBulkMove={handleBulkMove}
        onAlignSeats={handleBulkAlign}
        onBulkSwitchGroup={handleBulkSwitchGroup}
        onResetToDefault={handleResetToDefault}
        onRenumberSeats={handleRenumberSeats}
        onApplyTemplate={handleApplyTemplate}
        onUndo={history.undo}
        onRedo={history.redo}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
      />

      <AutoAssignDrawer
        open={autoAssignOpen}
        onClose={() => setAutoAssignOpen(false)}
        eventId={eventId}
        guests={guests}
        seats={seats}
        groups={groups}
        onToast={onToast}
      />
    </>
  )
}
