import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react'
import { getSeatFillPercent } from '../../data/selectors'
import type { Guest, LayoutBlock, Seat, SeatGroup, SeatMap } from '../../data/types'
import { getGuestStage } from '../../data/selectors'
import { GLASS_CARD, GLASS_SHADOW, STAGE_TONE } from './cardChrome'
import GuestAvatar from './GuestAvatar'
import {
  AutoAssignIcon,
  ChairIcon,
  InfoIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  RedoIcon,
  ReorderIcon,
  ResetIcon,
  SeatSquareIcon,
  StageIcon,
  TableFourIcon,
  TableSixIcon,
  TagIcon,
  TemplateIcon,
  UndoIcon,
} from '../icons/UiIcons'
import { useDragToMove } from '../../hooks/useDragToMove'
import { useDockMagnify } from '../../hooks/useDockMagnify'
import { useEnterTransition } from '../../hooks/useEnterTransition'
import Modal from '../Modal'
import ConfirmModal from '../ConfirmModal'
import Button from '../Button'
import IconButton from '../IconButton'
import Tooltip from '../Tooltip'
import GuestDock from './GuestDock'
import { useSeatEditorGuard } from '../SeatEditorGuardContext'
import type { ToastTone } from '../Toast'
import {
  SEAT_MAP_TEMPLATES,
  TEMPLATE_ORIGIN_X,
  TEMPLATE_ORIGIN_Y,
  type ApplyTemplateResult,
  type SeatMapTemplateId,
} from '../../data/seatMapTemplates'

/** The five things the "+" library can place — a table's seat count is part
 * of the id (rather than a separate argument) since it's a discrete catalog
 * choice, not a free number: "Table · 4" and "Table · 6" are two different
 * items to pick, the same way a build-mode furniture catalog offers a few
 * fixed sizes rather than one resizable-from-nothing generic table. */
export type LibraryItemId = 'seat' | 'stage' | 'table-4' | 'table-6' | 'label'

type EditSelection = { kind: 'seat' | 'block'; id: string }
type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se'
/** The pointer handler set every bulk-selected tile shares — see
 * SeatMapCanvas's own handleBulkDragPointerDown/Move/Up for what they do. */
interface BulkDragHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void
}
interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

export interface SeatMapCanvasProps {
  seatMap: SeatMap | null
  seats: Seat[]
  groups: SeatGroup[]
  layoutBlocks: LayoutBlock[]
  guestBySeat: Map<string, Guest>
  /** The full roster, not just who's already seated — GuestDock's own list
   * (see below) needs the unassigned guests too, which guestBySeat's
   * seat-keyed map has no entry for at all. */
  guests: Guest[]
  selectedGuestId: string | null
  onSelectGuest: (guestId: string) => void
  onUnassignSeat: (guestId: string) => void
  /** GuestDock's own drag-a-guest-onto-a-seat — see that component's doc. */
  onAssignGuestToSeat: (guestId: string, seatId: string) => void
  onViewProfile: (guestId: string) => void
  onAutoAssign: () => void
  onToast: (message: string, tone?: ToastTone) => void
  onSeatClick: (seat: Seat) => void
  /** Drag layout edit (the "Edit layout" toggle below) — moves one seat to
   * an arbitrary (x, y) on the canvas. Only wired up while editMode is on,
   * so the ordinary click-to-assign flow above is never at risk of an
   * accidental drag. */
  onMoveSeat: (seatId: string, x: number, y: number) => void
  /** Places a new library item near wherever the canvas is currently
   * scrolled to (see getPlacementPosition) — x/y are already computed here,
   * not passed up for the caller to guess at. */
  onAddFromLibrary: (item: LibraryItemId, x: number, y: number) => void
  onMoveBlock: (blockId: string, x: number, y: number) => void
  onResizeBlock: (blockId: string, x: number, y: number, width: number, height: number) => void
  onRenameBlock: (blockId: string, label: string) => void
  onDeleteBlock: (blockId: string) => void
  onDuplicateBlock: (blockId: string) => void
  /** The selected seat's own "Duplicate" (same action bar as
   * onDuplicateBlock, just the seat-selected branch) — copies it into a
   * fresh, empty standalone seat placed neatly beside the original rather
   * than a real block's small diagonal offset (see duplicateSeat's own doc
   * for why a lone 44px chair needs a different placement strategy). */
  onDuplicateSeat: (seatId: string) => void
  onDeleteSeat: (seatId: string) => void
  /** The selected seat's "Switch" action — recategorizes it to a different
   * SeatGroup (see the action bar below, next to Delete). Seat-only: a
   * block has no group of its own to switch. */
  onSwitchSeatGroup: (seatId: string, groupId: string) => void
  /** Marquee-select's own bulk actions (see the canvas background's own
   * pointer handlers for how a selection rectangle is drawn) — deletes
   * every seat/block whose id is in the given sets. */
  onBulkDelete: (seatIds: string[], blockIds: string[]) => void
  /** Same marquee selection, but duplicate — now covers seats too (used to
   * be blocks-only: duplicateSeat's own neat-placement search reads a fresh
   * seat snapshot on every call, so looping it one seat at a time — the
   * same way this already loops duplicateLayoutBlock — naturally steps
   * each new copy around every seat already placed by an earlier one in
   * the same batch, instead of stacking them). A bulk selection now
   * duplicates whatever mix of seats/blocks it actually caught, the same
   * as the single-select action bar already does for either kind on its
   * own. */
  onBulkDuplicate: (seatIds: string[], blockIds: string[]) => void
  /** Dragging any ONE seat/block that's part of the current bulk selection
   * moves the whole group by the same delta — see each tile's own onMove
   * below for how a single drag gets redirected here instead of its usual
   * single-item onMoveSeat/onMoveBlock. Only the tile actually grabbed
   * visually follows the cursor mid-drag (its own useDragToMove, unchanged);
   * every other selected tile snaps to its new spot once this commits,
   * rather than all of them needing to visually drag in lockstep. */
  onBulkMove: (seatIds: string[], blockIds: string[], dx: number, dy: number) => void
  /** Same marquee selection, but straighten it into one row or column and
   * re-space it with this floor plan's own standard seat margin — every
   * selected item lands on a shared y or x (the selection's own average, so
   * one wild outlier doesn't drag the whole line up or down to meet it) and
   * is packed in order with the same gap new rows are already placed with.
   * `axis` picks row ('horizontal') vs. column ('vertical'). The direct
   * answer to "I don't want to nudge these five seats into a straight,
   * evenly spaced line by hand" — see the bulk action bar's own Align ↔/
   * Align ↕ buttons. */
  onAlignSeats: (seatIds: string[], blockIds: string[], axis: 'horizontal' | 'vertical') => void
  /** Same marquee selection's own "Switch" — cycles EACH selected seat to
   * its own next SeatGroup independently (same rule the single-select
   * Switch action already uses), not one target group forced onto all of
   * them; a mixed VIP+Regular selection flips every seat to whichever
   * category it wasn't already in. Blocks in the same selection are simply
   * ignored — they have no group to switch. */
  onBulkSwitchGroup: (seatIds: string[]) => void
  onResetToDefault: () => void
  /** Re-sequences every seat's own label back to a clean 1..N run per
   * group (see layoutBlocks.ts's renumberSeatLabels) — the toolbar's own
   * "Renumber" action, for closing gaps a deleted seat leaves behind. */
  onRenumberSeats: () => void
  /** Applies a floor-plan template — see the canvas's own Templates modal
   * below (a card carousel with a schematic preview per option, replacing
   * the picker that used to live in event details). Returns a result
   * (rather than void) so the modal itself can show why it failed — e.g.
   * "unassign every guest first" — without needing its own onToast prop
   * just for this one flow. */
  onApplyTemplate: (templateId: SeatMapTemplateId) => Promise<ApplyTemplateResult>
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

// Continuous zoom (not a fixed step array) — needed for ctrl/cmd+wheel
// zoom-to-cursor, which lands on whatever value the wheel gesture computes,
// not necessarily one of a handful of preset stops. The +/- buttons still
// move in fixed ZOOM_STEP increments, just no longer snapped to one of a
// short list.
const MIN_ZOOM = 0.3
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.1
// How much of the remaining distance to the wheel-zoom's own target gets
// closed each animation frame (see applyPendingZoom) — high enough that a
// single discrete mouse-wheel notch (one event, one target, no more coming)
// still settles in well under a fifth of a second, not so high that it's
// indistinguishable from the old instant snap.
const ZOOM_CHASE_RATE = 0.5
const CELL_PX = 44
// How much room the free-form canvas keeps past the furthest-out seat/block,
// on every edge — large enough that panning around never hits a hard wall
// in any direction a real floor plan would actually reach, closer to
// Figma's own "effectively infinite" canvas than a tightly-fit scroll area.
// This is still a finite div (not a truly unbounded coordinate system), but
// at this size the difference isn't something anyone would ever scroll far
// enough to notice — an empty area this large costs nothing to render (it's
// just layout, not painted content) since nothing but the dot-grid
// background lives out there.
const CANVAS_PADDING = 3000
const MIN_CANVAS_SIZE = 2400
const MIN_BLOCK_WIDTH = 60
const MIN_BLOCK_HEIGHT = 40
// Every seat/block's stored x is data-space (0 at the true left edge of the
// floor plan — the seed event's own seats sit right there). Rendering adds
// this fixed lead pad to every ON-SCREEN x so there's real, pannable empty
// canvas to the left of x=0 too — before this, a seat at x≈0 had nowhere
// left to scroll TO, so it sat permanently under GuestDock's own floating
// panel (which occupies that same screen region) with no way to see it
// uncovered. Only x gets this treatment (the request was specifically about
// left-side room); y is untouched. Every coordinate conversion in this file
// stays in pure data space (unaware LEAD_PAD exists at all) EXCEPT the
// handful of places that write an actual CSS `left` for on-screen position —
// those add it back at the last possible moment, right before it becomes a
// style value. Screen→data conversions (getPlacementPosition,
// screenToCanvasPosition, screenToLocalXY) subtract it for the same reason,
// so a freshly-placed item's SAVED x is never polluted by where it happens
// to render.
const LEAD_PAD = 620

const LIBRARY_ITEMS: { id: LibraryItemId; name: string; icon: typeof ChairIcon }[] = [
  { id: 'seat', name: 'Seat', icon: SeatSquareIcon },
  { id: 'stage', name: 'Stage', icon: StageIcon },
  { id: 'table-4', name: 'Table · 4', icon: TableFourIcon },
  { id: 'table-6', name: 'Table · 6', icon: TableSixIcon },
  { id: 'label', name: 'Label', icon: TagIcon },
]

// A genuinely free-form floor plan (see plan.md) — every seat sits at its
// own (x, y) pixel position rather than a fixed row/column grid cell, so an
// admin can drag it anywhere at all, not just swap it with another seat's
// slot. row/column still exist on Seat (label numbering, stable sort order
// elsewhere) but no longer drive where anything renders.
//
// LayoutBlock (stage/table-rect/label) generalizes the same canvas beyond
// seats — see types.ts's own doc on LayoutBlock, and layoutBlocks.ts for the
// CRUD this component's handlers ultimately call (via SeatingView, same as
// onMoveSeat already did). A table-rect's own chairs are just ordinary Seat
// records (see LayoutBlock.kind's doc) — they render through the exact same
// seatableSeats loop below as every other seat, not a special path.
export default function SeatMapCanvas({
  seatMap,
  seats,
  groups,
  layoutBlocks,
  guestBySeat,
  guests,
  selectedGuestId,
  onSelectGuest,
  onUnassignSeat,
  onAssignGuestToSeat,
  onViewProfile,
  onAutoAssign,
  onToast,
  onSeatClick,
  onMoveSeat,
  onAddFromLibrary,
  onMoveBlock,
  onResizeBlock,
  onRenameBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onDuplicateSeat,
  onDeleteSeat,
  onSwitchSeatGroup,
  onBulkDelete,
  onBulkDuplicate,
  onBulkMove,
  onAlignSeats,
  onBulkSwitchGroup,
  onResetToDefault,
  onRenumberSeats,
  onApplyTemplate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: SeatMapCanvasProps) {
  const [zoom, setZoom] = useState(1)
  const [editMode, setEditMode] = useState(false)
  const [editSelection, setEditSelection] = useState<EditSelection | null>(null)
  // True while any tile's own drag or resize gesture is in progress — the
  // floating Delete/Duplicate bar hides for that one moment rather than
  // visibly lagging behind a block/seat that's now being moved by direct
  // DOM manipulation (see useDragToMove's own doc for why that's not
  // driven by React state the bar could otherwise track live).
  const [interactionActive, setInteractionActive] = useState(false)
  const [renamingBlockId, setRenamingBlockId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  // Guards leaving edit mode via "Done" — only asked when canUndo says this
  // session actually diverged from the floor plan's own baseline (see
  // useSeatMapHistory's baselineRef/resetToBaseline doc); a Done click with
  // nothing to lose just exits straight away, same as it always has. "Save"
  // here doesn't write anything new (every move/resize/add/delete already
  // wrote through the moment it happened, same as this editor's undo/redo
  // already relies on) — it just confirms keeping what's there. "Discard"
  // is the exact same restore Reset to default performs, only reached from
  // the exit door instead of its own toolbar button.
  const [doneConfirmOpen, setDoneConfirmOpen] = useState(false)
  // Set only when THIS confirm dialog was raised by an attempted navigation
  // away (see the guard effect below), not by the in-canvas "Done" button —
  // handleSaveAndExit/handleDiscardAndExit both call whatever's in here once
  // they're done, letting the nav actually happen; a plain "Done" click never
  // populates this, so those same two handlers no-op the call there, same as
  // always.
  const pendingNavigationRef = useRef<(() => void) | null>(null)
  // The "Editing tips" popover — click-triggered (not hover), so it works
  // the same on a staff member's phone as it does with a mouse; same
  // click-away-backdrop/enter-transition skeleton GuestFilterPopover
  // already uses elsewhere in this app.
  const [tipsOpen, setTipsOpen] = useState(false)
  const tipsEntered = useEnterTransition(tipsOpen)
  // The template picker — now an inner modal on the canvas itself (a card
  // carousel with a schematic preview per option) rather than a section in
  // event details, since it's about the floor plan, not the event's own
  // name/date/venue. selectedTemplateId is which card is currently picked
  // (not yet applied); templateError is the last apply attempt's own
  // failure reason (e.g. guests already seated), cleared whenever a
  // different card is picked or the modal reopens.
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<SeatMapTemplateId | null>(null)
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  // Figma-style navigation: holding space turns a plain left-drag into a
  // pan (same as middle-mouse-drag, which works without holding anything)
  // instead of moving whatever seat/block is under the cursor — see
  // spacePressed's own effect below for why it's scoped to hovering the
  // canvas, and each tile's own `panActive` prop for how their drag gets
  // disabled for the moment so the two gestures don't fight over the same
  // pointerdown.
  const [spacePressed, setSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  // True for the duration of an active ctrl/cmd+wheel zoom gesture (cleared
  // a short idle-moment after the last wheel tick) — see handleWheel's own
  // doc for why this needs to suppress the canvas's transform transition the
  // same way isPanning already does.
  const [isWheelZooming, setIsWheelZooming] = useState(false)
  const wheelZoomIdleTimer = useRef<number | null>(null)
  // The zoom-to-cursor math a wheel gesture is currently converging toward,
  // batched to at most one applied update per animation frame — see
  // handleWheel's own doc for why a naive setZoom() on every wheel event was
  // the other half of "laggy zoom."
  const pendingZoom = useRef<{ nextZoom: number; localX: number; localY: number; pointerX: number; pointerY: number } | null>(null)
  const zoomFrame = useRef<number | null>(null)
  // The "latest ref" pattern — kept in sync with `zoom` on every render (a
  // plain assignment during render, not inside an effect: safe because it
  // never affects THIS render's own output, only what a later event handler
  // reads) so handleWheel's own effect can depend on nothing and never has
  // to re-run. It used to depend on `[zoom]`, which meant a fast continuous
  // wheel gesture tore the native listener down and rebuilt it on every
  // single committed frame — up to 60 times a second — which is what
  // "jiggling" turned out to be: not the zoom math itself, but the listener
  // churn racing against the browser's own gesture handling.
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const [hoveringCanvas, setHoveringCanvas] = useState(false)
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })
  // True once a pan gesture has moved past a small threshold — checked (and
  // reset) by the canvas background's own onClick so releasing a real pan
  // over empty space doesn't also clear the current selection, the same
  // "was this actually a drag" distinction useDragToMove's wasDragged makes.
  const panMoved = useRef(false)
  // The dock item currently being picked up (see handleDockPointerDown) —
  // null whenever nothing's being dragged from the library.
  const [placingItem, setPlacingItem] = useState<LibraryItemId | null>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  // The library dock's own macOS-dock hover-magnify effect — see the
  // hook's own doc for why this is hand-rolled (direct DOM mutation) rather
  // than pulled in via framer-motion, which this app never depends on.
  const dockMagnify = useDockMagnify()
  const dockDragStart = useRef({ x: 0, y: 0 })
  const dockDragMoved = useRef(false)
  // A left-drag starting on the empty canvas background draws a selection
  // rectangle (marquee) instead of panning — every seat/block it overlaps
  // when released becomes the bulk selection, replacing whatever single
  // item was selected before. marqueeStart is a ref (not state) since it's
  // only ever read inside the pointermove/pointerup handlers, never
  // rendered; marqueeRect IS state, since its live value drives the blue
  // rectangle's own on-screen size every frame.
  const marqueeStart = useRef<{ x: number; y: number } | null>(null)
  // True once a marquee drag actually grew past threshold — same "was this
  // actually a drag" role panMoved plays for panning: the synthetic click
  // that follows pointerup on the same element would otherwise immediately
  // hit the background's own onClick (below) and clear the bulk selection
  // that pointerup just set, since click has no way to tell "I'm the tail
  // end of a real drag" from "I'm a plain deselect click" on its own.
  const marqueeDragged = useRef(false)
  const [marqueeRect, setMarqueeRect] = useState<Rect | null>(null)
  const [bulkSelection, setBulkSelection] = useState<{ seatIds: Set<string>; blockIds: Set<string> } | null>(null)
  // Dragging any ONE bulk-selected seat/block moves the whole group — live,
  // not just on release (see handleBulkDragPointerMove's own doc). Centered
  // here rather than each tile running its own useDragToMove, since every
  // selected tile has to move by the exact same delta in lockstep; a single
  // shared gesture is simpler to keep in sync than N independent ones.
  // bulkDragEls is populated once at pointerdown (whichever elements are
  // selected AT THAT MOMENT — a bulk selection can't change mid-drag since
  // nothing else is clickable while a pointer is captured) and mutated
  // directly via style.transform on every move, the same direct-DOM
  // approach useDragToMove itself uses and for the same reason (no React
  // re-render per frame).
  const bulkDragStart = useRef<{ x: number; y: number } | null>(null)
  const bulkDragMoved = useRef(false)
  const bulkDragEls = useRef<HTMLElement[]>([])
  const canvasContentRef = useRef<HTMLDivElement>(null)
  // The scrollable viewport a seat's tooltip needs to stay inside — not the
  // same thing as the canvas itself, which is usually much bigger than
  // what's actually visible at once. Passed down to each seat so it can
  // measure itself against this on hover/focus (see SeatTile below); also
  // what getPlacementPosition/screenToCanvasPosition read to place a new
  // library item.
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Space only starts a pan while the pointer is actually over this canvas
  // (hoveringCanvas) — a bare, unscoped keydown listener would also fire
  // while the admin is typing space into some other field on the page (the
  // rename input, a guest search box elsewhere in the drawer) and steal it.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || e.repeat || !hoveringCanvas) return
      e.preventDefault()
      setSpacePressed(true)
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') setSpacePressed(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [hoveringCanvas])

  // Edit-mode keyboard shortcuts — Figma-style, and the same
  // hoveringCanvas scoping the space-to-pan effect above uses, so typing
  // into the rename input or some other field elsewhere on the page never
  // gets hijacked. Also the real fix for "some component can't be
  // deleted": a seat/block that ends up rendered underneath GuestDock or
  // the library dock (both float on top, z-30) can't be *clicked* directly
  // — but a marquee drag started from clear canvas still selects it
  // correctly (rectsIntersect works on stored coordinates, not visible hit-
  // testing), and now Delete/arrow-key-nudge work on whatever's selected
  // without needing to click anything at all, so a stuck item is always
  // reachable this way even if its own action bar would render under a
  // dock too.
  useEffect(() => {
    if (!editMode || !hoveringCanvas) return

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          if (canRedo) onRedo()
        } else if (canUndo) {
          onUndo()
        }
        return
      }

      const hasSelection = Boolean(editSelection) || Boolean(bulkSelection)
      if (!hasSelection) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (bulkSelection) handleBulkDelete()
        else handleDeleteSelected()
        return
      }

      if (e.key === 'Escape') {
        setEditSelection(null)
        setBulkSelection(null)
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        if (bulkSelection) handleBulkDuplicate()
        else handleDuplicateSelected()
        return
      }

      const step = e.shiftKey ? 10 : 1
      let dx = 0
      let dy = 0
      if (e.key === 'ArrowLeft') dx = -step
      else if (e.key === 'ArrowRight') dx = step
      else if (e.key === 'ArrowUp') dy = -step
      else if (e.key === 'ArrowDown') dy = step
      if (dx === 0 && dy === 0) return

      e.preventDefault()
      if (bulkSelection) {
        onBulkMove([...bulkSelection.seatIds], [...bulkSelection.blockIds], dx, dy)
      } else if (editSelection?.kind === 'seat') {
        const seat = seats.find((s) => s.id === editSelection.id)
        if (seat) onMoveSeat(seat.id, Math.max(0, seat.x + dx), Math.max(0, seat.y + dy))
      } else if (editSelection?.kind === 'block') {
        const block = layoutBlocks.find((b) => b.id === editSelection.id)
        if (block) onMoveBlock(block.id, Math.max(0, block.x + dx), Math.max(0, block.y + dy))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editMode, hoveringCanvas, editSelection, bulkSelection, seats, layoutBlocks, canUndo, canRedo, onUndo, onRedo, onMoveSeat, onMoveBlock, onBulkMove])

  // Registers this editor with the app-wide navigation guard (see
  // SeatEditorGuardContext) for exactly as long as there's something an
  // admin would lose by navigating away unprompted — edit mode on, with at
  // least one undo-able change since it was opened. IconRail/EventTabs/
  // EventSwitcher all funnel their own "switch away" through the same
  // guard, so any of them landing here reopens this exact Save/Discard
  // dialog (doneConfirmOpen) rather than each needing its own copy of it;
  // Cancel just closes the dialog and leaves pendingNavigationRef unset, so
  // the attempted navigation silently never happens — staying put IS the
  // "cancel" outcome here, not a separate branch to write.
  const { registerGuard } = useSeatEditorGuard()
  useEffect(() => {
    if (!editMode || !canUndo) {
      registerGuard(null)
      return
    }
    registerGuard((proceed) => {
      pendingNavigationRef.current = proceed
      setDoneConfirmOpen(true)
    })
    return () => registerGuard(null)
  }, [editMode, canUndo, registerGuard])

  // The one case the in-app guard above can't reach: the browser tab itself
  // closing (or refreshing/navigating off-site) mid-edit. `beforeunload`
  // still gets to warn — browsers only ever show their own generic "leave
  // site?" copy today, never a custom message, but it at least gives a
  // chance to cancel and stay. `pagehide` is the actual "don't save": it
  // only fires once the navigation is truly going through (the admin
  // dismissed that same prompt with "Leave," or a browser that skips the
  // prompt entirely closed anyway), and resetToBaseline's own write
  // (restoreSeatMapSnapshot -> localStorage.setItem) is synchronous, so it
  // reliably finishes within the short teardown window either event type
  // allows — unlike an async call, which would not. Reading onResetToDefault
  // through a ref (rather than as a direct effect dependency) avoids tearing
  // these listeners down and rebuilding them on every render just because
  // SeatingView hands down a fresh function reference each time; only
  // editMode/canUndo actually changing should do that.
  const onResetToDefaultRef = useRef(onResetToDefault)
  onResetToDefaultRef.current = onResetToDefault
  useEffect(() => {
    if (!editMode || !canUndo) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    function handlePageHide() {
      onResetToDefaultRef.current()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [editMode, canUndo])

  // Ctrl/Cmd+wheel = zoom to cursor (Figma/trackpad-pinch convention) — a
  // native, non-passive listener, not React's own onWheel: browsers attach
  // wheel listeners as passive by default for scroll performance, which
  // silently ignores preventDefault() from inside a React onWheel handler,
  // so a plain wheel (no modifier) needs to keep scrolling the container
  // natively while a modified one is intercepted here instead. Attached
  // once (empty dependency array) and reads `zoomRef.current` for the
  // current value — see that ref's own doc for why this used to depend on
  // `[zoom]` and re-attach the listener on every frame, and why that was
  // itself the bug, not just an inefficiency.
  //
  // "Laggy zoom" was two compounding things, both fixed here: (1) every
  // single wheel tick called setZoom() synchronously — a trackpad/precision
  // mouse can fire these far faster than 60/sec, so the canvas (and every
  // seat/block tile under it) was re-rendering far more often than the
  // screen could even show, doing real work that never got seen; (2) the
  // canvas's own transform had a 150ms CSS transition active throughout
  // (only ever turned off for panning), so each new zoom value restarted a
  // fresh 150ms easing chase before the previous one finished, compounding
  // into a rubber-band lag rather than 1:1 tracking. Fixed by batching to at
  // most one committed zoom per animation frame (pendingZoom/zoomFrame) and
  // suppressing the transition for the gesture's duration (isWheelZooming).
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    // Chases pending.nextZoom rather than snapping straight to it in one
    // frame. A continuous trackpad/precision-mouse scroll keeps moving this
    // same target every tick anyway (handleWheel overwrites pendingZoom
    // on each one), so that case reads the same as before — 1:1 tracking.
    // What this actually fixes is a single discrete mouse-wheel notch: one
    // event, one target, nothing else coming, which used to be applied
    // whole in the very next animation frame — an instant pop rather than a
    // zoom. Now it eases there over a handful of frames instead (see
    // ZOOM_CHASE_RATE). scrollLeft/scrollTop are recomputed from the SAME
    // stepped (not yet fully arrived) zoom value on every one of those
    // frames too, not just the last one, so the point under the cursor
    // stays glued there throughout the ease — not just correct once it
    // settles. zoomRef is updated here directly (not left to next render)
    // since the very next requestAnimationFrame reads it as "current" a
    // moment later — waiting on React's own render timing would risk this
    // chase reading a one-frame-stale value and converging slower than it
    // looks like it should.
    function applyPendingZoom() {
      const pending = pendingZoom.current
      if (!pending) {
        zoomFrame.current = null
        return
      }
      const diff = pending.nextZoom - zoomRef.current
      const settled = Math.abs(diff) < 0.001
      const stepped = settled ? pending.nextZoom : zoomRef.current + diff * ZOOM_CHASE_RATE
      zoomRef.current = stepped
      setZoom(stepped)
      el!.scrollLeft = pending.localX * stepped - pending.pointerX
      el!.scrollTop = pending.localY * stepped - pending.pointerY
      if (settled) {
        pendingZoom.current = null
        zoomFrame.current = null
      } else {
        zoomFrame.current = requestAnimationFrame(applyPendingZoom)
      }
    }

    function handleWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()

      setIsWheelZooming(true)
      if (wheelZoomIdleTimer.current != null) window.clearTimeout(wheelZoomIdleTimer.current)
      wheelZoomIdleTimer.current = window.setTimeout(() => setIsWheelZooming(false), 200)

      const rect = el!.getBoundingClientRect()
      const pointerX = e.clientX - rect.left
      const pointerY = e.clientY - rect.top
      // Reads whatever zoom this gesture is already converging toward (a
      // pending, not-yet-flushed target) rather than the last committed
      // React state — several wheel ticks routinely land within the same
      // animation frame, and dividing each one against the same stale zoom
      // would make a fast flick undershoot what the gesture actually asked
      // for. Used ONLY for the target magnitude below (nextZoom = currentZoom
      // * factor) — NOT for the anchor math, see localX/localY's own doc.
      const pending = pendingZoom.current
      const currentZoom = pending?.nextZoom ?? zoomRef.current
      // The canvas-local (unscaled) point currently under the cursor —
      // computed BEFORE the zoom changes, so the scroll adjustment below can
      // keep that same point under the cursor afterward instead of the zoom
      // appearing to happen around the canvas's own top-left corner. Grounded
      // in the REAL, currently-rendered state (zoomRef.current, el.scrollLeft/
      // scrollTop) rather than `pending`'s own target — unlike currentZoom
      // above, this used to assume pending.nextZoom was already the on-screen
      // state, which was true back when applyPendingZoom applied a pending
      // zoom fully in the very next single frame. It no longer is: that
      // function now CHASES its target over several frames (see its own
      // doc), so during a continuous gesture most new wheel events land
      // while the previous target still hasn't fully arrived on screen —
      // assuming it had made the computed anchor increasingly wrong the
      // longer the gesture continued, which is what read as the view
      // shaking/jittering rather than zooming cleanly. zoomRef.current and
      // el.scrollLeft/scrollTop are both kept accurate every single frame by
      // applyPendingZoom (written synchronously, not through React state),
      // so reading them here is at most one frame (~16ms) stale — not the
      // whole multi-frame chase.
      const localX = (el!.scrollLeft + pointerX) / zoomRef.current
      const localY = (el!.scrollTop + pointerY) / zoomRef.current
      const factor = Math.exp(-e.deltaY * 0.0015)
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * factor))
      pendingZoom.current = { nextZoom, localX, localY, pointerX, pointerY }
      if (zoomFrame.current == null) zoomFrame.current = requestAnimationFrame(applyPendingZoom)
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
      if (zoomFrame.current != null) cancelAnimationFrame(zoomFrame.current)
      if (wheelZoomIdleTimer.current != null) window.clearTimeout(wheelZoomIdleTimer.current)
    }
  }, [])

  // The +/- buttons' own step zoom — same "keep whatever's under a fixed
  // point on-screen still under it after the zoom" math handleWheel uses for
  // the cursor above, just anchored to the current viewport's own center
  // instead (a button click has no cursor-over-canvas position of its own to
  // zoom toward). Without this, a button click only ever changed `zoom` —
  // since the canvas's own transform scales from its top-left
  // (transformOrigin: 'top left', see the style below) and scrollLeft/
  // scrollTop were left untouched, everything on screen grew/shrank away
  // from that top-left corner, which read as the view sliding toward the
  // corner rather than zooming in place.
  function handleZoomButton(direction: 1 | -1) {
    const el = scrollContainerRef.current
    if (!el) return
    const currentZoom = zoomRef.current
    const nextZoom =
      direction > 0
        ? Math.min(MAX_ZOOM, Math.round((currentZoom + ZOOM_STEP) * 100) / 100)
        : Math.max(MIN_ZOOM, Math.round((currentZoom - ZOOM_STEP) * 100) / 100)
    if (nextZoom === currentZoom) return
    const pointerX = el.clientWidth / 2
    const pointerY = el.clientHeight / 2
    const localX = (el.scrollLeft + pointerX) / currentZoom
    const localY = (el.scrollTop + pointerY) / currentZoom
    // Written synchronously (not left for the next render) — same reason
    // applyPendingZoom does this for the wheel-zoom chase: a second click
    // landing faster than React's own render/commit cycle would otherwise
    // read this ref still holding the PRE-first-click zoom while
    // el.scrollLeft/scrollTop already reflect that first click's real
    // update, computing the second click's anchor against a mismatched
    // pair — visibly jumping/jittering on a fast double-click.
    zoomRef.current = nextZoom
    setZoom(nextZoom)
    el.scrollLeft = localX * nextZoom - pointerX
    el.scrollTop = localY * nextZoom - pointerY
  }

  // Centers the camera on whatever's already on this floor plan the moment
  // it first mounts — a seed/hand-built layout sitting near data-space
  // (0, 0) would otherwise open pinned to the canvas's top-left corner
  // (mostly empty pannable space, plus GuestDock's own panel right on top
  // of it) instead of showing the actual seating front and center, the same
  // problem a freshly-applied template already gets a camera pan for (see
  // panCameraToTemplateOrigin). Horizontally centered, but vertically
  // pinned near the TOP rather than centered — a floor plan's own natural
  // reading order starts at the stage (the topmost thing on it), so "middle
  // top" is the more useful default framing than "dead center," which would
  // often crop the stage above the fold on a shorter viewport. Mount-only
  // ([]): this component fully remounts every time the Seating tab is
  // entered (OverviewContent only renders it while that tab is active), so
  // there's no "existing scroll position to preserve" to fight — every
  // other piece of local state here (zoom, edit mode, selection) already
  // resets the same way on every visit.
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const xs = [...seats.map((s) => s.x), ...layoutBlocks.map((b) => b.x)]
    const ys = [...seats.map((s) => s.y), ...layoutBlocks.map((b) => b.y)]
    if (xs.length === 0) return
    const centerX = ((Math.min(...xs) + Math.max(...xs)) / 2 + LEAD_PAD) * zoom
    const topY = Math.min(...ys) * zoom
    el.scrollLeft = Math.max(0, centerX - el.clientWidth / 2)
    // A little slack above the topmost thing (its own stage/seat row) so it
    // doesn't sit flush against the very top edge of the viewport.
    el.scrollTop = Math.max(0, topY - 40)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!seatMap) {
    return (
      <div className="min-w-0">
        <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Seat map</h3>
        <div className={`rounded-2xl p-5 ${GLASS_CARD}`}>
          <p className="text-sm text-muted">No seat map yet for this event.</p>
        </div>
      </div>
    )
  }

  const seatableSeats = seats.filter((s) => s.kind !== 'gap')
  const usedGroups = groups.filter((g) => seats.some((s) => s.groupId === g.id && s.status === 'assigned'))
  const fillPct = getSeatFillPercent(seats)
  // GuestDock's own drop-target lookup (is the seat under the cursor empty
  // or already taken?) — not memoized: this component already re-renders on
  // every seats change (a new array from the store either way), so a plain
  // recompute costs nothing extra a useMemo would have saved.
  const seatById = new Map(seats.map((s) => [s.id, s]))

  // The canvas grows to fit whatever's actually on it, plus a fixed pad —
  // this is the whole mechanism behind "free canvas": nothing but this pad
  // limits where something can be dragged, and the pad itself travels with
  // the content, so spreading seats/blocks further out just keeps making
  // more room. +LEAD_PAD keeps the right-side padding feeling exactly as
  // roomy as it always did — content itself now renders LEAD_PAD further
  // right (see that constant's own doc), so the div's total width needs to
  // grow by the same amount just to keep pace, not eat into the existing
  // trailing space.
  const canvasWidth =
    Math.max(MIN_CANVAS_SIZE, ...seatableSeats.map((s) => s.x + CELL_PX), ...layoutBlocks.map((b) => b.x + b.width), 0) +
    CANVAS_PADDING +
    LEAD_PAD
  const canvasHeight =
    Math.max(MIN_CANVAS_SIZE, ...seatableSeats.map((s) => s.y + CELL_PX), ...layoutBlocks.map((b) => b.y + b.height), 0) +
    CANVAS_PADDING

  // Where a freshly-added library item lands — the center of whatever's
  // currently visible in the scroll container, not a fixed corner the admin
  // would have to go hunting for on a large floor plan.
  function getPlacementPosition(): { x: number; y: number } {
    const el = scrollContainerRef.current
    if (!el) return { x: 200, y: 200 }
    const cx = (el.scrollLeft + el.clientWidth / 2) / zoom
    const cy = (el.scrollTop + el.clientHeight / 2) / zoom
    // -LEAD_PAD: cx is a screen/render-space measurement (derived from the
    // scroll position of content that's actually shifted right by LEAD_PAD —
    // see that constant's own doc); this converts it back to the data space
    // a saved seat/block's own x actually lives in.
    return { x: Math.max(0, Math.round(cx - LEAD_PAD - 60)), y: Math.max(0, Math.round(cy - 30)) }
  }

  function handleAddFromLibrary(item: LibraryItemId) {
    const { x, y } = getPlacementPosition()
    onAddFromLibrary(item, x, y)
  }

  // A screen point (e.g. wherever a dock item got dropped) converted to the
  // canvas's own unscaled coordinate space — null when the point isn't over
  // the canvas at all (dropped outside it), so the caller can just cancel
  // rather than place something off in a corner nobody asked for.
  function screenToCanvasPosition(clientX: number, clientY: number): { x: number; y: number } | null {
    const el = scrollContainerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null
    // -LEAD_PAD on x: see that constant's own doc — converts back to data
    // space from the render-space point the cursor is actually over.
    const x = (clientX - rect.left + el.scrollLeft) / zoom - LEAD_PAD
    const y = (clientY - rect.top + el.scrollTop) / zoom
    // Centers a roughly-icon-sized item under the cursor rather than
    // pinning its top-left corner there — a rough offset, not an attempt at
    // each library item's own exact default size.
    return { x: Math.max(0, Math.round(x - 22)), y: Math.max(0, Math.round(y - 22)) }
  }

  // Picking up a dock item — see the dock's own render below for why this
  // is pointer-capture-based rather than native HTML5 drag-and-drop (same
  // reasoning useDragToMove already documents for seats/blocks: a native
  // drag ghost is browser-rendered and out of this app's styling control,
  // and doesn't visually move the way direct manipulation does).
  function handleDockPointerDown(e: ReactPointerEvent<HTMLButtonElement>, item: LibraryItemId) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dockDragMoved.current = false
    dockDragStart.current = { x: e.clientX, y: e.clientY }
    setPlacingItem(item)
    if (ghostRef.current) {
      ghostRef.current.style.left = `${e.clientX}px`
      ghostRef.current.style.top = `${e.clientY}px`
    }
  }

  function handleDockPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!placingItem || !ghostRef.current) return
    if (!dockDragMoved.current && Math.hypot(e.clientX - dockDragStart.current.x, e.clientY - dockDragStart.current.y) > 4) {
      dockDragMoved.current = true
    }
    ghostRef.current.style.left = `${e.clientX}px`
    ghostRef.current.style.top = `${e.clientY}px`
  }

  // A real drag-drop places it exactly where released (if that's over the
  // canvas at all); a plain tap with no real movement falls back to the
  // original "center of whatever's in view" placement, so a quick tap still
  // works the way it always did rather than now requiring a drag.
  function handleDockPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!placingItem) return
    if (dockDragMoved.current) {
      const pos = screenToCanvasPosition(e.clientX, e.clientY)
      if (pos) onAddFromLibrary(placingItem, pos.x, pos.y)
    } else {
      handleAddFromLibrary(placingItem)
    }
    setPlacingItem(null)
  }

  // Space+left-drag or a plain middle-mouse-drag pans the canvas — each
  // tile's own drag is disabled for the moment (see their `panActive` prop)
  // so a space-held left-drag over a seat pans instead of moving that seat;
  // middle-mouse never reaches a tile's own drag in the first place
  // (useDragToMove only answers to button 0), so no such conflict there.
  // A screen point converted to the canvas's own unscaled coordinate space
  // — no centering offset (unlike screenToCanvasPosition, which is for
  // "where should a new item's top-left corner land"); the marquee needs
  // the raw point itself.
  function screenToLocalXY(clientX: number, clientY: number): { x: number; y: number } | null {
    const el = scrollContainerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    // -LEAD_PAD on x: this returns DATA space (matching seat.x/block.x
    // directly, e.g. for the marquee's own rectsIntersect calls) — see
    // LEAD_PAD's own doc for why every conversion in this file stays in
    // that space and only the final render step adds it back.
    return { x: (clientX - rect.left + el.scrollLeft) / zoom - LEAD_PAD, y: (clientY - rect.top + el.scrollTop) / zoom }
  }

  function handleCanvasPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const isMiddle = e.button === 1
    const isSpaceLeftDrag = e.button === 0 && spacePressed
    if (isMiddle || isSpaceLeftDrag) {
      const el = scrollContainerRef.current
      if (!el) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      panMoved.current = false
      panStart.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop }
      setIsPanning(true)
      return
    }

    // A plain left-drag starting on the empty canvas itself (not bubbled up
    // from a seat/block, which each already stopPropagation their own
    // pointerdown) draws a marquee — only while editing, matching every
    // other layout-mutating interaction here.
    if (e.button === 0 && editMode && e.target === e.currentTarget) {
      const point = screenToLocalXY(e.clientX, e.clientY)
      if (!point) return
      e.currentTarget.setPointerCapture(e.pointerId)
      marqueeStart.current = point
      setMarqueeRect({ x: point.x, y: point.y, width: 0, height: 0 })
    }
  }

  function handleCanvasPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (isPanning) {
      const el = scrollContainerRef.current
      if (!el) return
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      if (Math.hypot(dx, dy) > 4) panMoved.current = true
      el.scrollLeft = panStart.current.scrollLeft - dx
      el.scrollTop = panStart.current.scrollTop - dy
      return
    }

    if (marqueeStart.current) {
      const point = screenToLocalXY(e.clientX, e.clientY)
      if (!point) return
      const width = Math.abs(point.x - marqueeStart.current.x)
      const height = Math.abs(point.y - marqueeStart.current.y)
      if (width > 4 || height > 4) marqueeDragged.current = true
      setMarqueeRect({
        x: Math.min(marqueeStart.current.x, point.x),
        y: Math.min(marqueeStart.current.y, point.y),
        width,
        height,
      })
    }
  }

  function handleCanvasPointerUp() {
    if (isPanning) {
      setIsPanning(false)
      return
    }

    if (marqueeStart.current) {
      marqueeStart.current = null
      // A marquee that never really grew (a plain click that happened to
      // land on the canvas) shouldn't count as "select nothing" — it just
      // wasn't a marquee at all, so the click-to-deselect handler below is
      // left to do its own job instead.
      if (marqueeRect && (marqueeRect.width > 4 || marqueeRect.height > 4)) {
        const seatIds = new Set(
          seatableSeats.filter((s) => rectsIntersect(marqueeRect, { x: s.x, y: s.y, width: CELL_PX, height: CELL_PX })).map((s) => s.id)
        )
        const blockIds = new Set(layoutBlocks.filter((b) => rectsIntersect(marqueeRect, b)).map((b) => b.id))
        if (seatIds.size + blockIds.size > 0) {
          setBulkSelection({ seatIds, blockIds })
          setEditSelection(null)
        }
      }
      setMarqueeRect(null)
    }
  }

  function startRename(block: LayoutBlock) {
    setRenamingBlockId(block.id)
    setRenameDraft(block.label)
  }

  function commitRename() {
    if (renamingBlockId) onRenameBlock(renamingBlockId, renameDraft.trim() || 'Label')
    setRenamingBlockId(null)
  }

  function handleDeleteSelected() {
    if (!editSelection) return
    if (editSelection.kind === 'seat') onDeleteSeat(editSelection.id)
    else onDeleteBlock(editSelection.id)
    setEditSelection(null)
  }

  function handleDuplicateSelected() {
    if (!editSelection) return
    if (editSelection.kind === 'block') onDuplicateBlock(editSelection.id)
    else onDuplicateSeat(editSelection.id)
    setEditSelection(null)
  }

  // Cycles the selected seat to the next SeatGroup in this event's own list
  // (wrapping past the last one back to the first) — a plain cycle rather
  // than a picker menu, since there are typically just two groups (Regular/
  // VIP) to toggle between; selection stays put afterward (unlike Delete/
  // Duplicate above) so switching again, or seeing the seat's new color
  // land, doesn't require reselecting it.
  function handleSwitchSelected() {
    if (editSelection?.kind !== 'seat' || groups.length < 2) return
    const seat = seats.find((s) => s.id === editSelection.id)
    if (!seat) return
    const currentIndex = groups.findIndex((g) => g.id === seat.groupId)
    const next = groups[(currentIndex + 1) % groups.length]
    onSwitchSeatGroup(seat.id, next.id)
  }

  function handleBulkDelete() {
    if (!bulkSelection) return
    onBulkDelete([...bulkSelection.seatIds], [...bulkSelection.blockIds])
    setBulkSelection(null)
  }

  function handleBulkDuplicate() {
    if (!bulkSelection) return
    onBulkDuplicate([...bulkSelection.seatIds], [...bulkSelection.blockIds])
    setBulkSelection(null)
  }

  // Straightens a marquee selection into one row or column — a "move," not
  // an add/remove, so (unlike Delete/Duplicate above) this leaves the
  // selection in place afterward, same as an ordinary bulk drag would.
  function handleAlignSelected(axis: 'horizontal' | 'vertical') {
    if (!bulkSelection) return
    onAlignSeats([...bulkSelection.seatIds], [...bulkSelection.blockIds], axis)
  }

  function handleBulkSwitch() {
    if (!bulkSelection) return
    onBulkSwitchGroup([...bulkSelection.seatIds])
  }

  // A table-rect's own chairs, as live DOM elements — LayoutBlockTile hands
  // this to useDragToMove (as getSyncedElements) so dragging the table
  // visually carries its chairs along in real time instead of them lagging
  // behind, frozen, until the drag commits and the data layer's own
  // moveLayoutBlock (layoutBlocks.ts) snaps them into place all at once —
  // which is what previously read as the chairs "jumping out to far away."
  // Looked up by data-seat-id the same way GuestDock's own drop detection
  // and the bulk-drag handlers below do, rather than each SeatTile handing
  // a ref up for a relationship (table -> its chairs) only this one block
  // kind has.
  function getTableChairElements(blockId: string): HTMLElement[] {
    const root = canvasContentRef.current
    if (!root) return []
    return seats
      .filter((s) => s.tableBlockId === blockId)
      .map((s) => root.querySelector<HTMLElement>(`[data-seat-id="${s.id}"]`))
      .filter((el): el is HTMLElement => el !== null)
  }

  // Starts a group drag — fired from whichever bulk-selected tile's own
  // pointerdown the admin actually grabbed (see SeatTile/LayoutBlockTile's
  // own isBulkSelected branch, which routes to this instead of their normal
  // single-item useDragToMove). Looks up every OTHER selected element by its
  // own data-seat-id/data-block-id (see each tile's own doc for why those
  // attributes exist) so this doesn't need each tile to hand over a ref of
  // its own.
  function handleBulkDragPointerDown(e: ReactPointerEvent<HTMLElement>) {
    if (e.button !== 0 || !bulkSelection) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    bulkDragStart.current = { x: e.clientX, y: e.clientY }
    bulkDragMoved.current = false
    const root = canvasContentRef.current
    const els: HTMLElement[] = []
    if (root) {
      bulkSelection.seatIds.forEach((id) => {
        const el = root.querySelector<HTMLElement>(`[data-seat-id="${id}"]`)
        if (el) els.push(el)
      })
      bulkSelection.blockIds.forEach((id) => {
        const el = root.querySelector<HTMLElement>(`[data-block-id="${id}"]`)
        if (el) els.push(el)
      })
    }
    bulkDragEls.current = els
  }

  // Every selected element gets the SAME translate() every frame — this is
  // what makes the group visually move together in real time (the earlier
  // version only moved the one tile actually grabbed, with the rest
  // snapping into place on release, which is what read as "buggy" rather
  // than a real group drag).
  function handleBulkDragPointerMove(e: ReactPointerEvent<HTMLElement>) {
    if (!bulkDragStart.current) return
    const dx = (e.clientX - bulkDragStart.current.x) / zoom
    const dy = (e.clientY - bulkDragStart.current.y) / zoom
    if (!bulkDragMoved.current && Math.hypot(e.clientX - bulkDragStart.current.x, e.clientY - bulkDragStart.current.y) > 4) {
      bulkDragMoved.current = true
    }
    const transform = bulkDragMoved.current ? `translate(${dx}px, ${dy}px)` : ''
    bulkDragEls.current.forEach((el) => {
      el.style.transform = transform
    })
  }

  function handleBulkDragPointerUp(e: ReactPointerEvent<HTMLElement>) {
    if (!bulkDragStart.current || !bulkSelection) return
    const dx = (e.clientX - bulkDragStart.current.x) / zoom
    const dy = (e.clientY - bulkDragStart.current.y) / zoom
    bulkDragEls.current.forEach((el) => {
      el.style.transform = ''
    })
    bulkDragEls.current = []
    bulkDragStart.current = null
    if (bulkDragMoved.current) {
      onBulkMove([...bulkSelection.seatIds], [...bulkSelection.blockIds], Math.round(dx), Math.round(dy))
    }
    // NOT reset here — left for whichever tile's own onClick fires right
    // after (see bulkWasDragged/resetBulkWasDragged below) to check first,
    // the same "the consumer resets it, not the gesture itself" contract
    // useDragToMove's own wasDragged/resetWasDragged already uses; resetting
    // it here would make it un-checkable by the time that click arrives.
  }

  function bulkWasDragged(): boolean {
    return bulkDragMoved.current
  }

  function resetBulkWasDragged() {
    bulkDragMoved.current = false
  }

  const bulkDragHandlers: BulkDragHandlers = {
    onPointerDown: handleBulkDragPointerDown,
    onPointerMove: handleBulkDragPointerMove,
    onPointerUp: handleBulkDragPointerUp,
    onPointerCancel: handleBulkDragPointerUp,
  }

  function handleConfirmReset() {
    setResetConfirmOpen(false)
    setEditSelection(null)
    onResetToDefault()
  }

  // The "Edit layout"/"Done" toggle — turning edit mode ON never needs to
  // ask anything (see below); turning it OFF only stops to ask when there's
  // actually something this session to save or discard (canUndo).
  function handleToggleEditMode() {
    if (!editMode) {
      setEditMode(true)
      return
    }
    if (canUndo) {
      setDoneConfirmOpen(true)
      return
    }
    setEditMode(false)
    setEditSelection(null)
  }

  // Runs whatever navigation was actually waiting on this dialog (see
  // pendingNavigationRef's own doc) — a no-op when this dialog was opened by
  // the plain in-canvas "Done" button instead, which never sets it.
  function runPendingNavigation() {
    const proceed = pendingNavigationRef.current
    pendingNavigationRef.current = null
    proceed?.()
  }

  function handleSaveAndExit() {
    setDoneConfirmOpen(false)
    setEditMode(false)
    setEditSelection(null)
    runPendingNavigation()
  }

  function handleDiscardAndExit() {
    setDoneConfirmOpen(false)
    setEditMode(false)
    setEditSelection(null)
    onResetToDefault()
    runPendingNavigation()
  }

  function openTemplateModal() {
    setSelectedTemplateId(null)
    setTemplateError(null)
    setTemplateModalOpen(true)
  }

  // Every template lands at the same known spot (TEMPLATE_ORIGIN_X/Y — see
  // its own doc in seatMapTemplates.ts) regardless of wherever the canvas
  // happened to be scrolled to before applying, so the camera pans there
  // right after — otherwise a template applied while scrolled somewhere
  // else would silently land off-screen. +320/+280 is a rough "middle of a
  // typical template's own footprint" fudge (they range roughly 550-650px
  // wide, 360-580 tall) rather than an exact center for whichever one was
  // just applied — close enough that the fresh layout is clearly in view.
  function panCameraToTemplateOrigin() {
    const el = scrollContainerRef.current
    if (!el) return
    // +LEAD_PAD: TEMPLATE_ORIGIN_X is data space; el.scrollLeft is render
    // space (see LEAD_PAD's own doc) — this converts before scrolling.
    const targetX = (TEMPLATE_ORIGIN_X + LEAD_PAD + 320) * zoom
    const targetY = (TEMPLATE_ORIGIN_Y + 280) * zoom
    el.scrollTo({
      left: Math.max(0, targetX - el.clientWidth / 2),
      top: Math.max(0, targetY - el.clientHeight / 2),
      behavior: 'smooth',
    })
  }

  async function handleApplyTemplateClick() {
    if (!selectedTemplateId) return
    setApplyingTemplate(true)
    setTemplateError(null)
    const result = await onApplyTemplate(selectedTemplateId)
    setApplyingTemplate(false)
    if (result.ok) {
      setTemplateModalOpen(false)
      setSelectedTemplateId(null)
      setEditSelection(null)
      panCameraToTemplateOrigin()
    } else {
      setTemplateError(result.reason ?? 'Could not apply template')
    }
  }

  // The floating "Delete"/"Duplicate" bar's own anchor rect — the selected
  // seat's fixed CELL_PX box, or the selected block's committed box (not a
  // live mid-drag/resize one — see interactionActive's own doc above).
  function getSelectionRect(): { x: number; y: number; width: number; height: number } | null {
    if (!editSelection) return null
    if (editSelection.kind === 'seat') {
      const s = seats.find((s) => s.id === editSelection.id)
      return s ? { x: s.x, y: s.y, width: CELL_PX, height: CELL_PX } : null
    }
    const b = layoutBlocks.find((b) => b.id === editSelection.id)
    return b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null
  }

  const selectionRect = getSelectionRect()

  // What "Switch" (see handleSwitchSelected) would switch the selected seat
  // TO — computed here rather than inside the button itself so its own label
  // can say exactly which group it lands on, not just "Switch". null when
  // there's nothing to switch to (a block selected, or fewer than 2 groups).
  const switchTargetGroup = (() => {
    if (editSelection?.kind !== 'seat' || groups.length < 2) return null
    const seat = seats.find((s) => s.id === editSelection.id)
    if (!seat) return null
    const currentIndex = groups.findIndex((g) => g.id === seat.groupId)
    return groups[(currentIndex + 1) % groups.length]
  })()

  return (
    // min-w-0: without it, a flex/block ancestor's default min-width:auto
    // would refuse to shrink narrower than the canvas below's explicit pixel
    // width, forcing the whole page to stay that wide — this way the seat
    // map still reflows correctly when the drawer pushes <main> in; the
    // canvas's own `overflow-auto` wrapper is what actually handles "floor
    // plan wider than available space" once this can shrink to let it.
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-ink-900">Seat map</h3>

        {/* One visible block, not four separate barely-there chips — those
            each used to carry their own translucent border-white/40
            bg-white/30 surface, which read as almost flat against this
            page's own pale wash. Now it's a single frosted-glass pill —
            border + backdrop-blur instead of a solid fill and drop shadow,
            the flatter/more minimal "glass, not elevation" read a solid
            shadow-lifted bar doesn't give — with plain dividers between its
            logical groups (Edit layout / Undo+Redo / Templates+Reset)
            instead of four separate surfaces. rounded-full (not -2xl)
            carries through to every button inside it too, so the whole bar
            reads as one continuous pill of pill-shaped controls rather than
            square-cornered buttons sitting in a rounder tray. Zoom used to
            live here too — split into its own small floating stack on the
            canvas itself (see the one near GuestDock below), so this bar
            reads as "editing actions" and zoom reads as "camera control,"
            rather than one row mixing both. */}
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-white/60 bg-white/40 p-1.5 backdrop-blur-xl">
          {/* Edit layout — toggles drag/resize/select AND the dock's own
              add-a-piece affordance. Kept separate from the always-
              available click-to-assign interaction above: rearranging the
              floor plan and assigning a guest to a seat are different jobs,
              and conflating them (e.g. dragging while a guest is selected)
              would be ambiguous about which one a drag/click means. */}
          <button
            type="button"
            onClick={handleToggleEditMode}
            aria-pressed={editMode}
            className={`flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-[0.97] ${
              editMode ? 'bg-accent-700 text-white' : 'text-ink-900 hover:bg-black/5'
            }`}
          >
            <PencilIcon className="h-3.5 w-3.5" />
            {editMode ? 'Done' : 'Edit layout'}
          </button>

          {/* Assigning a guest to a seat isn't a layout edit, so this used
              to stay available regardless of edit mode — but edit mode's
              own selection/drag/resize affordances already crowd this same
              toolbar, and "auto assign a bunch of guests" while mid-layout-
              edit isn't a combination that comes up. Hidden while editing
              rather than just disabled, matching every other view-mode-only
              action in this toolbar. */}
          {!editMode && (
            <>
              <div className="mx-0.5 h-6 w-px shrink-0 bg-black/10" />
              <button
                type="button"
                onClick={onAutoAssign}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-900 transition hover:bg-black/5 active:scale-[0.97]"
              >
                <AutoAssignIcon className="h-3.5 w-3.5" />
                Auto assign
              </button>
            </>
          )}

          {editMode && (
            <>
              <div className="mx-0.5 h-6 w-px shrink-0 bg-black/10" />
              <IconButton icon={UndoIcon} onClick={onUndo} disabled={!canUndo} aria-label="Undo" />
              <IconButton icon={RedoIcon} onClick={onRedo} disabled={!canRedo} aria-label="Redo" />

              <div className="mx-0.5 h-6 w-px shrink-0 bg-black/10" />
              <button
                type="button"
                onClick={openTemplateModal}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-900 transition hover:bg-black/5 active:scale-[0.97]"
              >
                <TemplateIcon className="h-3.5 w-3.5" />
                Templates
              </button>
              {/* Closes label gaps a deleted seat leaves behind (e.g.
                  "REG-1, REG-2, REG-4") — disabled when there's no seat at
                  all to renumber, same "nothing to do" guard Reset uses,
                  just keyed off seatableSeats rather than canUndo (a floor
                  plan can have gaps to close on its very first edit
                  session, unlike Reset which only matters once something's
                  actually changed). */}
              <button
                type="button"
                onClick={onRenumberSeats}
                disabled={seatableSeats.length === 0}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-900 transition hover:bg-black/5 active:scale-[0.97] disabled:opacity-30"
              >
                <ReorderIcon className="h-3.5 w-3.5" />
                Renumber seats
              </button>
              <button
                type="button"
                onClick={() => setResetConfirmOpen(true)}
                disabled={!canUndo}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-900 transition hover:bg-black/5 active:scale-[0.97] disabled:opacity-30"
              >
                <ResetIcon className="h-3.5 w-3.5" />
                Reset to default
              </button>
            </>
          )}
        </div>
      </div>

      {/* A crisper border than the shared GLASS_CARD recipe elsewhere
          (border-black/10, not the barely-there border-cream/40 every
          other card still uses) plus a chamfered bottom-left corner — a
          schematic/blueprint-panel touch matching a reference the user
          pointed to. Bottom-left specifically because it's the one corner
          nothing floats over: GuestDock owns top-left, the zoom stack
          top-right, the library dock bottom-right (edit mode only) — so
          the cut can never clip a real control. */}
      <div
        className={`relative overflow-hidden rounded-2xl border border-black/10 bg-cream/20 p-3 sm:p-5 ${GLASS_SHADOW}`}
        style={{
          // Removes the 20px corner triangle outright. A plain `border`
          // only ever follows the box's ORIGINAL edges — it has no idea a
          // corner just got clipped away — so it still correctly draws the
          // other 3-and-a-bit edges but leaves this one bare; the little
          // rotated bar below (rendered as this div's own last child, see
          // its own doc) is what actually paints the missing stroke along
          // the new diagonal.
          clipPath: 'polygon(0 0, 100% 0, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
        }}
      >
        {/* This IS a floor plan, so a faint blueprint dot-grid is the direct,
            on-theme background — not decoration for decoration's sake. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(color-mix(in srgb, var(--color-ink-900) 8%, transparent) 1px, transparent 1.6px)',
            backgroundSize: '12px 12px',
          }}
        />

        {/* The notch's own missing border stroke — a 1px bar, exactly
            20px*√2 long, rotated 45° about its own center. Positioned
            (before rotation) so that center lands at the cut's own
            midpoint, (10px right, 10px up) from this card's bottom-left
            corner — the standard construction that puts a rotated bar's
            two ends exactly on the two points a clip-path notch of this
            same size actually cuts between, (0, 20px) and (20px, 0), with
            no separate trig at render time and no dependency on this
            card's own (responsive) width/height. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{ left: '-4.14px', bottom: '9.5px', width: '28.28px', height: '1px', backgroundColor: 'rgba(0,0,0,0.1)', transform: 'rotate(45deg)' }}
        />

        {/* Scoped positioning context for the scroll viewport plus every
            dock that floats over it (GuestDock, the zoom stack, the
            library dock, the drag ghost) — sized to exactly the scroll
            viewport's own footprint, since none of those overlays add any
            real layout height of their own (all `absolute`). The footer
            strip below is a sibling of THIS wrapper, not a child of it, so
            these docks' `bottom-*` offsets resolve against the viewport's
            own bottom edge — i.e. actually above the footer strip —
            instead of against the outer card's much taller box, which
            used to include the footer strip's own height and left the
            library dock reading as flush against (sometimes behind) it. */}
        <div className="relative">
        <div
          ref={scrollContainerRef}
          // isPanning checked before spacePressed — a middle-mouse-drag pan
          // sets isPanning without ever setting spacePressed, and needs the
          // same grabbing cursor while it's happening.
          className={`no-scrollbar relative overflow-auto ${isPanning ? 'cursor-grabbing' : spacePressed ? 'cursor-grab' : ''}`}
          style={{ maxHeight: 560 }}
          onMouseEnter={() => setHoveringCanvas(true)}
          onMouseLeave={() => setHoveringCanvas(false)}
        >
          <div
            onClick={(e) => {
              // A real pan (past the threshold) shouldn't also clear the
              // current selection just because it happened to release over
              // empty space — same "was this actually a drag" distinction
              // useDragToMove's wasDragged makes for seats/blocks.
              if (panMoved.current) {
                panMoved.current = false
                return
              }
              // Same guard, for a marquee drag — see marqueeDragged's own
              // doc above for why this click needs to be a no-op instead of
              // clearing the bulk selection pointerup just set a moment ago.
              if (marqueeDragged.current) {
                marqueeDragged.current = false
                return
              }
              // Only clears selection when the click landed on the empty
              // canvas itself, not on a seat/block that bubbled up here —
              // e.target vs e.currentTarget is what tells those two apart.
              if (e.target === e.currentTarget) {
                setEditSelection(null)
                setBulkSelection(null)
              }
            }}
            ref={canvasContentRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            // select-none: a marquee or bulk-move drag starting anywhere
            // near a seat/block's own text label would otherwise trigger the
            // browser's native text-selection gesture instead (or alongside
            // it) — pointer capture doesn't suppress that on its own, since
            // text selection starts from the underlying mousedown, not from
            // whether some element later calls setPointerCapture.
            className="relative select-none"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              // Suppressed during an active wheel-zoom gesture too, same as
              // panning — see isWheelZooming's own doc for why a transition
              // fighting a rapid run of zoom updates is what "laggy zoom"
              // actually was.
              transition: isPanning || isWheelZooming ? 'none' : 'transform 150ms ease-out',
            }}
          >
            {layoutBlocks.map((block) => (
              <LayoutBlockTile
                key={block.id}
                block={block}
                zoom={zoom}
                editMode={editMode}
                panActive={spacePressed}
                isSelected={(editSelection?.kind === 'block' && editSelection.id === block.id) || Boolean(bulkSelection?.blockIds.has(block.id))}
                isBulkSelected={Boolean(bulkSelection?.blockIds.has(block.id))}
                bulkDragHandlers={bulkDragHandlers}
                bulkWasDragged={bulkWasDragged}
                resetBulkWasDragged={resetBulkWasDragged}
                isRenaming={renamingBlockId === block.id}
                renameDraft={renameDraft}
                onRenameDraftChange={setRenameDraft}
                onCommitRename={commitRename}
                onSelect={() => {
                  setEditSelection({ kind: 'block', id: block.id })
                  setBulkSelection(null)
                }}
                onStartRename={() => startRename(block)}
                getTableChairElements={block.kind === 'table-rect' ? () => getTableChairElements(block.id) : undefined}
                // A drag that commits on a block belonging to the current
                // bulk selection moves the whole group by the same delta
                // instead of just this one block — see onBulkMove's own doc.
                // In practice a bulk-selected block's own drag never reaches
                // this any more (see isBulkSelected's own doc — it routes to
                // handleBulkDragPointerDown/Up instead), but this stays as
                // the defensive fallback for the single-select path.
                onMove={(x, y) => {
                  if (bulkSelection?.blockIds.has(block.id)) {
                    onBulkMove([...bulkSelection.seatIds], [...bulkSelection.blockIds], x - block.x, y - block.y)
                  } else {
                    onMoveBlock(block.id, x, y)
                  }
                }}
                onResize={(x, y, width, height) => onResizeBlock(block.id, x, y, width, height)}
                onInteractionActiveChange={setInteractionActive}
              />
            ))}

            {seatableSeats.map((seat) => {
              const group = groups.find((g) => g.id === seat.groupId)
              const occupant = guestBySeat.get(seat.id)
              // An empty seat used to be flat rail-gray regardless of which
              // group it belonged to — truthful to "empty vs assigned" as a
              // status, but it also meant Switch (recategorizing an empty
              // seat) had no visible effect at all until someone was seated
              // there. A light tint of the seat's own group color keeps
              // "empty" reading as clearly lighter/paler than "assigned"
              // (still exactly those two states — no third one invented)
              // while making a group change visible on the seat itself,
              // occupied or not.
              const color =
                seat.status === 'assigned'
                  ? (group?.color ?? 'var(--color-accent-cyan)')
                  : group
                    ? `color-mix(in srgb, ${group.color} 22%, var(--color-rail))`
                    : 'var(--color-rail)'
              const isSelected = occupant?.id === selectedGuestId
              const isEditSelected =
                (editSelection?.kind === 'seat' && editSelection.id === seat.id) || Boolean(bulkSelection?.seatIds.has(seat.id))

              return (
                <SeatTile
                  key={seat.id}
                  seat={seat}
                  group={group}
                  occupant={occupant}
                  color={color}
                  isSelected={isSelected}
                  isEditSelected={isEditSelected}
                  isBulkSelected={Boolean(bulkSelection?.seatIds.has(seat.id))}
                  bulkDragHandlers={bulkDragHandlers}
                  bulkWasDragged={bulkWasDragged}
                  resetBulkWasDragged={resetBulkWasDragged}
                  editMode={editMode}
                  panActive={spacePressed}
                  zoom={zoom}
                  onSeatClick={onSeatClick}
                  onSelect={() => {
                    setEditSelection({ kind: 'seat', id: seat.id })
                    setBulkSelection(null)
                  }}
                  onMove={(x, y) => {
                    if (bulkSelection?.seatIds.has(seat.id)) {
                      onBulkMove([...bulkSelection.seatIds], [...bulkSelection.blockIds], x - seat.x, y - seat.y)
                    } else {
                      onMoveSeat(seat.id, x, y)
                    }
                  }}
                  onInteractionActiveChange={setInteractionActive}
                  scrollContainerRef={scrollContainerRef}
                />
              )
            })}

            {/* Floating Delete/Duplicate bar for whatever's currently
                selected in edit mode — one instance, positioned off
                whichever item is selected, rather than baking its own copy
                into every seat/block. */}
            {editMode && selectionRect && !interactionActive && (
              <div
                className="absolute z-40 flex items-center gap-0.5 rounded-full bg-ink-900 px-1.5 py-1 shadow-lg"
                style={{ left: selectionRect.x + LEAD_PAD, top: Math.max(0, selectionRect.y - 38) }}
              >
                {/* Duplicate now applies to either selection kind — a
                    block copies via onDuplicateBlock, a seat via
                    onDuplicateSeat (see handleDuplicateSelected) — so this
                    no longer gates on editSelection.kind the way the
                    Switch button below still does (a block genuinely has
                    no group to switch). */}
                <button
                  type="button"
                  onClick={handleDuplicateSelected}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-white/15"
                >
                  Duplicate
                </button>
                {switchTargetGroup && (
                  <button
                    type="button"
                    onClick={handleSwitchSelected}
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-white/15"
                  >
                    Switch to {switchTargetGroup.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-red-500"
                >
                  Delete
                </button>
              </div>
            )}

            {/* The marquee itself — a live, blue selection rectangle drawn
                straight from marqueeRect's own coordinates, in the same
                unscaled space every seat/block already renders in, so it
                lines up with them correctly at any zoom level with no
                extra math. */}
            {marqueeRect && (
              <div
                className="pointer-events-none absolute z-40 rounded-sm border-2 border-accent-700 bg-accent-700/10"
                style={{ left: marqueeRect.x + LEAD_PAD, top: marqueeRect.y, width: marqueeRect.width, height: marqueeRect.height }}
              />
            )}

            {/* Bulk Delete/Duplicate bar for a marquee selection — anchored
                to the union of every selected item's own box, same idea as
                the single-select bar above but for however many items the
                marquee actually caught. */}
            {editMode && bulkSelection && (bulkSelection.seatIds.size > 0 || bulkSelection.blockIds.size > 0) && (() => {
              const boxes: Rect[] = [
                ...seatableSeats.filter((s) => bulkSelection.seatIds.has(s.id)).map((s) => ({ x: s.x, y: s.y, width: CELL_PX, height: CELL_PX })),
                ...layoutBlocks.filter((b) => bulkSelection.blockIds.has(b.id)),
              ]
              if (boxes.length === 0) return null
              const left = Math.min(...boxes.map((b) => b.x))
              const top = Math.min(...boxes.map((b) => b.y))
              const count = bulkSelection.seatIds.size + bulkSelection.blockIds.size
              return (
                <div
                  className="absolute z-40 flex items-center gap-0.5 rounded-full bg-ink-900 px-1.5 py-1 shadow-lg"
                  style={{ left: left + LEAD_PAD, top: Math.max(0, top - 38) }}
                >
                  {count > 0 && (
                    <button
                      type="button"
                      onClick={handleBulkDuplicate}
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-white/15"
                    >
                      Duplicate ({count})
                    </button>
                  )}
                  {/* Same rule the single-select bar's own switchTargetGroup
                      uses (fewer than 2 groups: nothing to switch to) — no
                      single "Switch to X" label here though, since a mixed
                      selection can hold seats in different groups already;
                      each one just flips to its own other category. */}
                  {bulkSelection.seatIds.size > 0 && groups.length > 1 && (
                    <button
                      type="button"
                      onClick={handleBulkSwitch}
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-white/15"
                    >
                      Switch ({bulkSelection.seatIds.size})
                    </button>
                  )}
                  {/* Aligning 1 item is meaningless — needs at least two to
                      have something to line up against each other. Two
                      buttons, not one: a selection can be straightened into
                      either a row or a column, and there's no single "right"
                      guess between them worth collapsing to one click. */}
                  {count > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAlignSelected('horizontal')}
                        aria-label="Align horizontally"
                        className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-white/15"
                      >
                        Align ↔
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAlignSelected('vertical')}
                        aria-label="Align vertically"
                        className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-white/15"
                      >
                        Align ↕
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-red-500"
                  >
                    Delete ({count})
                  </button>
                </div>
              )
            })()}
          </div>
        </div>

        {/* The guest picker — floats over the canvas on the left, always
            available (not gated by editMode: assigning a guest to a seat
            isn't a layout edit). Sits outside the scroll container for the
            same reason the library dock below does — its own position
            shouldn't move with scroll/pan/zoom. */}
        <GuestDock
          guests={guests}
          seatById={seatById}
          groups={groups}
          selectedGuestId={selectedGuestId}
          onSelectGuest={onSelectGuest}
          onUnassignSeat={onUnassignSeat}
          onAssignGuestToSeat={onAssignGuestToSeat}
          onViewProfile={onViewProfile}
          onToast={onToast}
        />

        {/* Zoom controls — its own small floating stack in the canvas's own
            top-right corner (top-left is GuestDock's, bottom-right is the
            library dock's below), same floating-panel recipe those two
            already use. Vertical, not the old horizontal row shared with
            the edit toolbar — always visible regardless of edit mode, same
            as it always was. Outside the scroll container/zoomed canvas
            div for the same reason the other two docks are: its own
            position and size shouldn't move with scroll/pan/zoom. */}
        <div className="absolute right-4 top-4 z-30 flex flex-col items-center gap-1 rounded-2xl bg-cream/95 p-1.5 shadow-[0_20px_50px_-15px_rgba(16,30,51,0.4)] ring-1 ring-black/5">
          <IconButton icon={PlusIcon} size="sm" onClick={() => handleZoomButton(1)} disabled={zoom >= MAX_ZOOM - 0.001} aria-label="Zoom in" />
          <span className="text-center text-[11px] font-medium text-ink-900">{Math.round(zoom * 100)}%</span>
          <IconButton icon={MinusIcon} size="sm" onClick={() => handleZoomButton(-1)} disabled={zoom <= MIN_ZOOM + 0.001} aria-label="Zoom out" />
        </div>

        {/* Component library dock — moved off the page and onto the canvas
            itself (a build-mode item tray, not a row of labeled cards above
            the canvas any more). Light cream fill (an earlier dark-ink pass
            read as too heavy a surface for something this small and this
            temporary — GuestDock's own light recipe is the more consistent
            match now that both docks float over the same canvas) with a
            real shadow + ring doing the "floating, interactive surface"
            work instead of a dark fill. Sits outside the scroll container
            so it stays put regardless of scroll position, and outside the
            zoomed canvas div so its own size never changes with zoom. Each
            item is a real pick-up-and-drag (see handleDockPointerDown) — a
            plain tap still falls back to the old "center of the view"
            placement. */}
        {editMode && (
          <div
            // items-end, not items-center: a dock's own magnify effect only
            // reads correctly when every item shares one common baseline —
            // an item scaling up from a vertically-centered row grows both
            // up AND down, which just looks like the whole dock jittering;
            // anchored to the bottom edge instead, growth reads as the item
            // rising to meet the cursor, the actual macOS-dock cue this is
            // modeled on.
            className="absolute bottom-4 right-4 z-30 flex items-end gap-1 rounded-2xl bg-cream/95 p-2 shadow-[0_20px_50px_-15px_rgba(16,30,51,0.4)] ring-1 ring-black/5"
            onMouseMove={dockMagnify.handleMouseMove}
            onMouseLeave={dockMagnify.handleMouseLeave}
          >
            {LIBRARY_ITEMS.map((item, index) => (
              <Tooltip key={item.id} label={item.name}>
                <button
                  ref={dockMagnify.setItemRef(index)}
                  type="button"
                  onPointerDown={(e) => handleDockPointerDown(e, item.id)}
                  onPointerMove={handleDockPointerMove}
                  onPointerUp={handleDockPointerUp}
                  onPointerCancel={() => setPlacingItem(null)}
                  aria-label={item.name}
                  // transition here (not a blanket app-wide rule) is what
                  // turns the hook's own discrete per-mousemove `transform`
                  // writes into a smooth glide rather than a snap between
                  // sizes — same "CSS does the tweening, JS just sets the
                  // target" split the rest of this file already uses for
                  // drag/zoom.
                  className="flex h-11 w-11 touch-none items-center justify-center rounded-xl text-ink-900 transition-[transform,background-color] duration-150 ease-out will-change-transform hover:bg-black/5 active:scale-[0.9]"
                >
                  {/* The inner frame — each item now reads as a small
                      preview swatch of the actual piece it places (see
                      SeatSquareIcon/StageIcon/TagIcon's own doc), not just a
                      bare glyph floating in the button. */}
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/15">
                    <item.icon className="h-4 w-4" />
                  </span>
                </button>
              </Tooltip>
            ))}
          </div>
        )}

        {/* The dragged item's own floating preview — fixed to the viewport
            (not the canvas's own scaled/scrolled coordinate space), since it
            has to track the cursor across the whole screen, including areas
            outside the canvas entirely. */}
        {placingItem && (
          <div
            ref={ghostRef}
            className="pointer-events-none fixed z-50 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-accent-700 text-white shadow-xl"
          >
            {(() => {
              const Icon = LIBRARY_ITEMS.find((i) => i.id === placingItem)?.icon
              return Icon ? <Icon className="h-5 w-5" /> : null
            })()}
          </div>
        )}
        </div>

        {/* Edit-mode instructions + shortcuts — both plain text in normal
            flow (not a floating chip like the docks above, and not rendered
            ABOVE this card either), specifically so toggling edit mode can
            never end up competing with GuestDock's own z-30 panel for the
            same screen space, AND — the actual bug this replaced — so it
            never changes this card's own on-page position either. This
            used to be a separate banner rendered ABOVE the card, only while
            editMode was on: turning edit mode on inserted it into the page
            flow, which pushed this whole card (GuestDock included, since
            its own absolute position is anchored to the card) down by the
            banner's height. A cursor that didn't move after that toggle
            landed on whatever used to be under GuestDock's collapsed chip
            a moment earlier — reading as "the guest list won't expand in
            edit mode," when the panel had simply moved out from under the
            click. Living down here instead, below everything, the same way
            the dot legend right under it always has, means this card is
            exactly as tall in edit mode as out of it. */}
        {/* The footer strip — editing tips (edit mode only), the legend,
            and the fill% line — now its own visually distinct muted panel
            (bg-rail, the same pale neutral this floor plan already uses
            for "empty seat"/"nothing here" elsewhere) rather than plain
            text sitting directly on the card's own translucent wash. That
            wash — plus the dot-grid pattern above, which paints across
            this WHOLE card, not just the scroll viewport — used to show
            straight through this text too, reading as if it were still
            part of the canvas rather than a separate summary strip
            underneath it. rail's own cool blue-gray reads as clearly
            distinct from the canvas's warm cream either way. */}
        <div className="relative mt-3 rounded-xl bg-rail px-3 py-2.5">
          {editMode && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTipsOpen((v) => !v)}
                  aria-expanded={tipsOpen}
                  className="flex items-center gap-1 rounded-full px-1.5 py-1 font-semibold text-accent-700 transition hover:bg-accent-700/10"
                >
                  <InfoIcon className="h-3.5 w-3.5" />
                  Editing tips
                </button>

                {tipsOpen && <div className="fixed inset-0 z-40" onClick={() => setTipsOpen(false)} />}

                {/* Bottom-anchored (not top): this trigger sits at the very
                    bottom of the card, so a dropdown opening downward like
                    GuestFilterPopover's own would spill past the card's edge
                    more often than not. */}
                <div
                  inert={!tipsOpen}
                  className={`absolute bottom-[calc(100%+8px)] left-0 z-50 max-h-[60vh] w-80 max-w-[calc(100vw-3rem)] origin-bottom-left overflow-auto rounded-2xl bg-white p-4 text-left shadow-xl ring-1 ring-black/5 transition duration-150 ease-out ${
                    tipsEntered ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
                  }`}
                >
                  {/* Gesture/action, then what it does — real two-column
                      tables instead of a flat bulleted sentence list, so the
                      "what do I press/do" half reads as its own scannable
                      column rather than buried mid-sentence. Grouped the way
                      the work actually splits: shaping the plan, moving
                      around it, and keyboard shortcuts. min-w keeps the
                      columns readable on narrow canvases — the popover
                      scrolls horizontally instead of crushing them. */}
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Shaping the plan</p>
                  <table className="mt-1.5 w-full min-w-[19rem] border-collapse text-xs text-ink-900">
                    <tbody>
                      <tr className="align-top">
                        <td className="w-28 py-1 pr-2 font-semibold text-ink-900/70">Drag</td>
                        <td className="py-1">Move a piece, or drop a new one from the dock.</td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1 pr-2 font-semibold text-ink-900/70">Tap</td>
                        <td className="py-1">Select for delete, duplicate, or switch.</td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1 pr-2 font-semibold text-ink-900/70">Double-click</td>
                        <td className="py-1">Rename a stage or label.</td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1 pr-2 font-semibold text-ink-900/70">Corner handles</td>
                        <td className="py-1">Resize stages, tables, labels.</td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1 pr-2 font-semibold text-ink-900/70">Drag empty space</td>
                        <td className="py-1">Box-select for bulk actions.</td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1 pr-2 font-semibold text-ink-900/70">Guest dock</td>
                        <td className="py-1">Drop a guest onto an empty seat.</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Getting around</p>
                  <table className="mt-1.5 w-full min-w-[19rem] border-collapse text-xs text-ink-900">
                    <tbody>
                      <tr className="align-top">
                        <td className="w-28 py-1 pr-2 font-semibold text-ink-900/70">Space, or middle-drag</td>
                        <td className="py-1">Pan.</td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1 pr-2 font-semibold text-ink-900/70">Scroll</td>
                        <td className="py-1">Move around.</td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1 pr-2 font-semibold text-ink-900/70">Ctrl/Cmd + scroll</td>
                        <td className="py-1">Zoom to cursor.</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Shortcuts</p>
                  <table className="mt-1.5 w-full border-collapse text-xs text-ink-900">
                    <tbody>
                      <tr>
                        <td className="w-28 py-1 pr-2 font-mono text-[11px] text-ink-900/70">Del</td>
                        <td className="py-1">Delete</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 font-mono text-[11px] text-ink-900/70">⌘/Ctrl+D</td>
                        <td className="py-1">Duplicate</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 font-mono text-[11px] text-ink-900/70">Arrows</td>
                        <td className="py-1">Nudge (Shift = 10px)</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 font-mono text-[11px] text-ink-900/70">Esc</td>
                        <td className="py-1">Deselect</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2 font-mono text-[11px] text-ink-900/70">⌘/Ctrl+Z, ⇧⌘/Ctrl+Z</td>
                        <td className="py-1">Undo, redo</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Truthful to the actual two-state model (empty/assigned) — no
              invented sold/held/blocked states. */}
          <ul className={`flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted ${editMode ? 'mt-2' : ''}`}>
            <li className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-white ring-1 ring-black/10" />
              Available
            </li>
            {usedGroups.map((g) => (
              <li key={g.id} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                {g.label}
              </li>
            ))}
          </ul>

          <p className="mt-2 text-xs text-muted">
            <span className="font-semibold text-ink-900">{fillPct}%</span> of seats assigned
          </p>
        </div>
      </div>

      <ConfirmModal
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        title="Reset to default?"
        body="Every change since you opened the editor will be lost."
        confirmLabel="Reset"
        onConfirm={handleConfirmReset}
      />

      {/* Discard/Save uses ConfirmModal's onCancel override — Discard isn't
          a neutral "never mind, close this dialog" (that's what
          onClose/Escape/backdrop-click already are here, all still wired to
          "keep editing" via setDoneConfirmOpen(false)); it's its own
          destructive exit path (handleDiscardAndExit), so it gets the same
          status-declined-ghost treatment Button's own variant table
          reserves for that via cancelVariant. tone="neutral": Save, not
          Discard, is the bold recommended action here, so the title's icon
          badge reads blue/info rather than red/warning — matching the
          primary button on the right, not a leading assumption that this
          dialog is dangerous. */}
      <ConfirmModal
        open={doneConfirmOpen}
        // Truly "never mind, keep editing" — also drops whatever pending
        // navigation raised this dialog (see pendingNavigationRef's own
        // doc), so a later plain "Done" click doesn't accidentally replay a
        // stale attempt to navigate away that was already called off here.
        onClose={() => {
          setDoneConfirmOpen(false)
          pendingNavigationRef.current = null
        }}
        title="Save these changes?"
        body="You have unsaved changes to this floor plan."
        tone="neutral"
        cancelLabel="Discard"
        cancelVariant="destructive-ghost"
        onCancel={handleDiscardAndExit}
        confirmLabel="Save"
        onConfirm={handleSaveAndExit}
      />

      {/* Templates — moved here from event details: a floor plan is
          something you pick while looking at the canvas it replaces, not a
          field on the event's own name/date/venue form. A card carousel
          (each card gets its own schematic preview, not just a name and a
          sentence) rather than the plain text-only picker this replaces. */}
      <Modal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="Floor plan templates"
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTemplateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="dark" onClick={handleApplyTemplateClick} disabled={!selectedTemplateId || applyingTemplate}>
              {applyingTemplate ? 'Applying…' : 'Apply template'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Replaces this event's seat map with a fresh layout. Only available before anyone's seated.</p>

        <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
          {SEAT_MAP_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSelectedTemplateId(t.id)
                setTemplateError(null)
              }}
              className={`w-48 shrink-0 rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                selectedTemplateId === t.id ? 'border-accent-700 bg-accent-700/10' : 'border-black/10 bg-white hover:bg-black/5'
              }`}
            >
              <div className="flex h-24 items-center justify-center rounded-xl bg-page/60 p-2">
                <TemplatePreview id={t.id} />
              </div>
              <p className="mt-2.5 text-sm font-semibold text-ink-900">{t.name}</p>
              <p className="mt-0.5 text-xs text-muted">{t.description}</p>
            </button>
          ))}
        </div>

        {templateError && <p className="mt-3 text-xs font-medium text-status-declined">{templateError}</p>}
      </Modal>
    </div>
  )
}

// A small schematic floor-plan drawing per template — a stage bar plus
// whatever its own seat/table arrangement actually looks like (rows, a
// split-by-aisle pair of blocks, or a grid of tables), not a generic
// placeholder icon repeated three times. Purely illustrative: the numbers
// here are a simplified stand-in for each template's real generated layout
// (see seatMapTemplates.ts), not drawn to its exact seat count.
function TemplatePreview({ id }: { id: SeatMapTemplateId }) {
  const stage = <rect x={32} y={6} width={56} height={9} rx={2} fill="var(--color-ink-900)" />
  const dot = (cx: number, cy: number, key: string) => <circle key={key} cx={cx} cy={cy} r={2.1} fill="var(--color-accent-cyan)" />

  if (id === 'theater') {
    const dots = []
    for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) dots.push(dot(10 + c * 11.5, 30 + r * 10, `${r}-${c}`))
    return (
      <svg viewBox="0 0 120 76" className="h-full w-full">
        {stage}
        {dots}
      </svg>
    )
  }

  if (id === 'classroom') {
    const dots = []
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) dots.push(dot(8 + c * 9, 30 + r * 10, `l-${r}-${c}`))
      for (let c = 0; c < 4; c++) dots.push(dot(72 + c * 9, 30 + r * 10, `r-${r}-${c}`))
    }
    return (
      <svg viewBox="0 0 120 76" className="h-full w-full">
        {stage}
        {dots}
      </svg>
    )
  }

  // 'banquet'
  const tables = []
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      tables.push(<rect key={`${r}-${c}`} x={14 + c * 34} y={30 + r * 24} width={22} height={10} rx={2} fill="var(--color-accent-cyan)" />)
    }
  }
  return (
    <svg viewBox="0 0 120 76" className="h-full w-full">
      {stage}
      {tables}
    </svg>
  )
}

interface LayoutBlockTileProps {
  block: LayoutBlock
  zoom: number
  editMode: boolean
  /** True while space is held for a Figma-style pan — disables this tile's
   * own drag for the moment so a space+left-drag pans the canvas instead of
   * moving this block (see SeatMapCanvas's handleCanvasPointerDown). */
  panActive: boolean
  isSelected: boolean
  /** True when this block is part of the current marquee/bulk selection
   * (not just single-selected) — routes its own drag to the shared group-
   * drag gesture instead of its own useDragToMove (see bulkDragHandlers),
   * and suppresses its own resize handles (a bulk selection has no single
   * "this one's corners" to grab — resizing stays a single-select action). */
  isBulkSelected: boolean
  bulkDragHandlers: BulkDragHandlers
  bulkWasDragged: () => boolean
  resetBulkWasDragged: () => void
  isRenaming: boolean
  renameDraft: string
  onRenameDraftChange: (v: string) => void
  onCommitRename: () => void
  onSelect: () => void
  onStartRename: () => void
  onMove: (x: number, y: number) => void
  onResize: (x: number, y: number, width: number, height: number) => void
  onInteractionActiveChange: (active: boolean) => void
  /** A table-rect's own generated chairs — separate SeatTile elements
   * elsewhere in the tree (see the doc a few lines down) — so they visually
   * drag along with the table in real time instead of only snapping to
   * their new spot once the drag commits. undefined for stage/label blocks,
   * which have no chairs of their own. */
  getTableChairElements?: () => HTMLElement[]
}

const RESIZE_CORNERS: { corner: ResizeCorner; className: string; cursor: string }[] = [
  { corner: 'nw', className: '-left-1.5 -top-1.5', cursor: 'cursor-nwse-resize' },
  { corner: 'ne', className: '-right-1.5 -top-1.5', cursor: 'cursor-nesw-resize' },
  { corner: 'sw', className: '-bottom-1.5 -left-1.5', cursor: 'cursor-nesw-resize' },
  { corner: 'se', className: '-bottom-1.5 -right-1.5', cursor: 'cursor-nwse-resize' },
]

// A stage, a table's own surface, or a custom label — one tile renders all
// three kinds, since they share the same drag/select/resize mechanics and
// differ only in their own fill/border/content. A table-rect's chairs are
// NOT rendered here — they're ordinary Seat records positioned around this
// block at creation time (see layoutBlocks.ts's createTableBlock), drawn by
// the main seatableSeats loop right alongside every other seat.
function LayoutBlockTile({
  block,
  zoom,
  editMode,
  panActive,
  isSelected,
  isBulkSelected,
  bulkDragHandlers,
  bulkWasDragged,
  resetBulkWasDragged,
  isRenaming,
  renameDraft,
  onRenameDraftChange,
  onCommitRename,
  onSelect,
  onStartRename,
  onMove,
  onResize,
  onInteractionActiveChange,
  getTableChairElements,
}: LayoutBlockTileProps) {
  const elRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStart = useRef({ pointerX: 0, pointerY: 0, x: 0, y: 0, width: 0, height: 0, corner: 'se' as ResizeCorner })
  const resizeLast = useRef({ x: block.x, y: block.y, width: block.width, height: block.height })

  const drag = useDragToMove(elRef, {
    enabled: editMode && !isResizing && !panActive && !isBulkSelected,
    zoom,
    x: block.x,
    y: block.y,
    onCommit: onMove,
    getSyncedElements: getTableChairElements,
  })

  // Relays drag.isDragging's own transitions up — same reasoning as
  // SeatTile's identical block: useDragToMove has no lifecycle hook of its
  // own to call this from, so this catches the transition during render
  // instead of needing an effect that would otherwise fire every render.
  const wasDraggingRef = useRef(false)
  if (drag.isDragging !== wasDraggingRef.current) {
    wasDraggingRef.current = drag.isDragging
    onInteractionActiveChange(drag.isDragging)
  }

  const canRename = block.kind === 'stage' || block.kind === 'label'

  function handleResizeDown(e: ReactPointerEvent<HTMLSpanElement>, corner: ResizeCorner) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    resizeStart.current = { pointerX: e.clientX, pointerY: e.clientY, x: block.x, y: block.y, width: block.width, height: block.height, corner }
    resizeLast.current = { x: block.x, y: block.y, width: block.width, height: block.height }
    setIsResizing(true)
    onInteractionActiveChange(true)
  }

  function handleResizeMove(e: ReactPointerEvent<HTMLSpanElement>) {
    if (!isResizing || !elRef.current) return
    const dx = (e.clientX - resizeStart.current.pointerX) / zoom
    const dy = (e.clientY - resizeStart.current.pointerY) / zoom
    const { x: sx, y: sy, width: sw, height: sh, corner } = resizeStart.current
    let width = sw
    let height = sh
    let x = sx
    let y = sy
    if (corner === 'se') {
      width = sw + dx
      height = sh + dy
    } else if (corner === 'sw') {
      width = sw - dx
      height = sh + dy
      x = sx + dx
    } else if (corner === 'ne') {
      width = sw + dx
      height = sh - dy
      y = sy + dy
    } else {
      width = sw - dx
      height = sh - dy
      x = sx + dx
      y = sy + dy
    }
    width = Math.max(MIN_BLOCK_WIDTH, Math.round(width))
    height = Math.max(MIN_BLOCK_HEIGHT, Math.round(height))
    x = Math.max(0, Math.round(x))
    y = Math.max(0, Math.round(y))
    resizeLast.current = { x, y, width, height }
    // +LEAD_PAD: resizeLast/onResize below stay in data space (x itself);
    // only this direct CSS write needs the render-space value — see
    // LEAD_PAD's own doc.
    elRef.current.style.left = `${x + LEAD_PAD}px`
    elRef.current.style.top = `${y}px`
    elRef.current.style.width = `${width}px`
    elRef.current.style.height = `${height}px`
  }

  function handleResizeUp() {
    if (!isResizing) return
    setIsResizing(false)
    onInteractionActiveChange(false)
    const { x, y, width, height } = resizeLast.current
    onResize(x, y, width, height)
  }

  const kindClass =
    block.kind === 'stage'
      ? 'bg-ink-900 text-white font-display text-xs font-bold uppercase tracking-widest'
      : block.kind === 'table-rect'
        ? 'border-2 border-ink-700 bg-rail'
        : 'border-2 border-dashed border-muted bg-page/50 text-xs font-semibold text-ink-700'

  return (
    <div
      ref={elRef}
      data-block-id={block.id}
      {...(isBulkSelected ? bulkDragHandlers : drag.handlers)}
      onClick={(e) => {
        if (!editMode) return
        e.stopPropagation()
        if (isBulkSelected ? bulkWasDragged() : drag.wasDragged) {
          if (isBulkSelected) resetBulkWasDragged()
          else drag.resetWasDragged()
          return
        }
        onSelect()
      }}
      onDoubleClick={(e) => {
        if (!editMode || !canRename) return
        e.stopPropagation()
        onStartRename()
      }}
      title={block.kind === 'table-rect' ? 'Table' : block.label}
      className={`absolute flex select-none items-center justify-center overflow-hidden rounded-xl ${kindClass} ${
        editMode ? 'cursor-grab touch-none active:cursor-grabbing' : ''
      } ${isSelected ? 'ring-2 ring-inset ring-accent-700 ring-offset-2' : ''} ${drag.isDragging || isResizing ? 'opacity-70' : ''}`}
      style={{ left: block.x + LEAD_PAD, top: block.y, width: block.width, height: block.height }}
    >
      {isRenaming ? (
        <input
          type="text"
          value={renameDraft}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => onRenameDraftChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={onCommitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className="w-[85%] rounded bg-white/90 px-1.5 py-0.5 text-center text-xs font-semibold text-ink-900 outline-none"
        />
      ) : (
        block.kind !== 'table-rect' && <span className="truncate px-2">{block.label}</span>
      )}

      {editMode && isSelected && !isBulkSelected && (
        <>
          {RESIZE_CORNERS.map(({ corner, className, cursor }) => (
            // draggable={false}: this handle sits inside the block's own
            // pointer-drag area, so an explicit opt-out (rather than relying
            // on stopPropagation alone) keeps a grab that starts exactly on
            // the handle from ever being read as a plain block drag instead.
            <span
              key={corner}
              draggable={false}
              onPointerDown={(e) => handleResizeDown(e, corner)}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeUp}
              onPointerCancel={handleResizeUp}
              className={`absolute z-10 h-4 w-4 touch-none rounded-full border-2 border-accent-700 bg-white ${className} ${cursor}`}
            />
          ))}
        </>
      )}
    </div>
  )
}

interface SeatTileProps {
  seat: Seat
  group: SeatGroup | undefined
  occupant: Guest | undefined
  color: string
  isSelected: boolean
  isEditSelected: boolean
  /** See LayoutBlockTileProps's identical prop — same reason. */
  isBulkSelected: boolean
  bulkDragHandlers: BulkDragHandlers
  bulkWasDragged: () => boolean
  resetBulkWasDragged: () => void
  editMode: boolean
  /** See LayoutBlockTileProps's identical prop — same reason. */
  panActive: boolean
  zoom: number
  onSeatClick: (seat: Seat) => void
  onSelect: () => void
  onMove: (x: number, y: number) => void
  onInteractionActiveChange: (active: boolean) => void
  scrollContainerRef: MutableRefObject<HTMLDivElement | null>
}

// One seat + its own guest mini-profile tooltip — split out from the main
// canvas loop because the tooltip needs real per-seat state (which side it
// opens on), not just CSS: a seat near the canvas's top edge has nowhere
// above it to open into without spilling out of the scrollable viewport
// (see the screenshot that prompted this — "Carmen Wulandari..." clipped at
// the very top). Measured on hover/focus against `scrollContainerRef` (the
// actual visible viewport), not the canvas itself, since the canvas is
// usually much taller than what's actually on screen at once —
// `getBoundingClientRect()` already accounts for the canvas's own zoom
// transform, so this works correctly at any zoom level with no extra math.
function SeatTile({
  seat,
  group,
  occupant,
  color,
  isSelected,
  isEditSelected,
  isBulkSelected,
  bulkDragHandlers,
  bulkWasDragged,
  resetBulkWasDragged,
  editMode,
  panActive,
  zoom,
  onSeatClick,
  onSelect,
  onMove,
  onInteractionActiveChange,
  scrollContainerRef,
}: SeatTileProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [flipDown, setFlipDown] = useState(false)
  // How far (px) the tooltip needs to slide sideways from its default
  // seat-centered position to stay inside the scroll container — 0 when
  // there's no collision. Previously the tooltip was only ever centered
  // (`-translate-x-1/2`), so a seat near the canvas's left/right edge got
  // cut off the same way top-edge seats did before the flipDown fix.
  const [shiftX, setShiftX] = useState(0)
  const TOOLTIP_HALF_WIDTH = 88 // half of w-44 (176px)
  const EDGE_MARGIN = 8

  const drag = useDragToMove(wrapperRef, {
    enabled: editMode && !panActive && !isBulkSelected,
    zoom,
    x: seat.x,
    y: seat.y,
    onCommit: onMove,
  })

  // useDragToMove's own isDragging doesn't reach onInteractionActiveChange
  // by itself (it has no side-effecting lifecycle hook to report through) —
  // relaying it here, only on the transitions that matter, is simpler than
  // adding an effect that would otherwise fire on every render.
  const wasDraggingRef = useRef(false)
  if (drag.isDragging !== wasDraggingRef.current) {
    wasDraggingRef.current = drag.isDragging
    onInteractionActiveChange(drag.isDragging)
  }

  function checkFlip() {
    const wrapper = wrapperRef.current
    const scrollEl = scrollContainerRef.current
    if (!wrapper || !scrollEl) return
    const wrapperRect = wrapper.getBoundingClientRect()
    const scrollRect = scrollEl.getBoundingClientRect()
    // ~120px is the tooltip's own height (its p-3 content) plus the mb-2
    // gap and a little slack for the caret — not measured live since the
    // tooltip isn't in the layout yet at hover-start (opacity-0, but still
    // occupying its own space would be needed for a real measurement, and
    // that's more complexity than a "starter" version needs).
    setFlipDown(wrapperRect.top - scrollRect.top < 120)

    // Same idea on the horizontal axis: default position is centered on the
    // seat, which cuts off the same way near the canvas's left/right edges.
    const seatCenterX = wrapperRect.left + wrapperRect.width / 2
    const overflowLeft = scrollRect.left + EDGE_MARGIN - (seatCenterX - TOOLTIP_HALF_WIDTH)
    const overflowRight = seatCenterX + TOOLTIP_HALF_WIDTH - (scrollRect.right - EDGE_MARGIN)
    if (overflowLeft > 0) setShiftX(overflowLeft)
    else if (overflowRight > 0) setShiftX(-overflowRight)
    else setShiftX(0)
  }

  return (
    // Positioning lives on this wrapper (not the button) so the tooltip
    // below has something of the right size to anchor to (`bottom-full`/
    // `top-full`, relative to *this* box, not the whole scaled canvas) —
    // the button itself just fills it. This wrapper is also useDragToMove's
    // own elRef now: dragging translates the whole wrapper (tooltip and
    // all), not just the button, which is what keeps the tooltip glued to
    // its seat mid-drag instead of the two visibly separating.
    <div
      ref={wrapperRef}
      // data-seat-id/data-seat-status: GuestDock's own drag-a-guest-onto-a-
      // seat drop detection (document.elementFromPoint(...).closest(...))
      // reads these directly rather than needing any canvas-coordinate math
      // of its own — a plain DOM lookup works at any zoom/scroll/pan state
      // with no conversion needed.
      data-seat-id={seat.id}
      data-seat-status={seat.status}
      className="group/seat absolute"
      style={{ left: seat.x + LEAD_PAD, top: seat.y, height: CELL_PX, width: CELL_PX }}
      onMouseEnter={checkFlip}
      onFocus={checkFlip}
    >
      <button
        type="button"
        {...(isBulkSelected ? bulkDragHandlers : drag.handlers)}
        onClick={(e) => {
          if (editMode) {
            e.stopPropagation()
            if (isBulkSelected ? bulkWasDragged() : drag.wasDragged) {
              if (isBulkSelected) resetBulkWasDragged()
              else drag.resetWasDragged()
              return
            }
            onSelect()
            return
          }
          onSeatClick(seat)
        }}
        title={`${seat.label}${group ? ` — ${group.label}` : ''}${occupant ? ` — ${occupant.name}` : ''}`}
        style={{ backgroundColor: color }}
        className={`flex h-full w-full select-none items-center justify-center rounded-lg border text-[10px] font-medium transition-transform ${
          editMode ? 'touch-none cursor-grab active:cursor-grabbing' : 'hover:scale-110'
        } ${
          seat.status === 'assigned' ? 'border-black/5 text-white' : 'border-ink-900/15 text-ink-900/50'
        } ${isSelected || isEditSelected ? 'ring-2 ring-inset ring-accent-700' : ''} ${drag.isDragging ? 'opacity-70' : ''} ${
          editMode ? 'outline outline-1 outline-dashed outline-offset-[-3px] outline-ink-900/25' : ''
        }`}
      >
        {seat.label}
      </button>

      {/* Guest mini-profile tooltip — shown on hover (mouse) or focus
          (keyboard tab, and a mobile tap — tapping a button focuses it) via
          the same group-hover/group-focus-within pattern IconRail's own nav
          tooltip already uses; `flipDown` (see checkFlip above) is the only
          part that needs real JS instead of pure CSS. Only assigned seats
          get one; there's nothing to show for an empty seat. */}
      {occupant && (
        // Two levels on purpose: the collision-avoidance shiftX (this outer
        // div's own inline transform) and the tooltip's own centering +
        // hover/focus scale-in (the inner div's Tailwind transform classes,
        // -translate-x-1/2 composed with scale-95/100) are two separate
        // `transform` values on two separate elements — an inline style
        // fully replaces whatever a class would have set for that same
        // property on the *same* element, so putting both on one node would
        // have silently dropped one of them (in practice, the scale-in
        // reveal, since the inline style always wins).
        <div
          className={`pointer-events-none absolute left-1/2 z-30 ${flipDown ? 'top-full mt-2' : 'bottom-full mb-2'}`}
          style={{ transform: `translateX(${shiftX}px)` }}
        >
          <div
            role="tooltip"
            className={`w-44 -translate-x-1/2 scale-95 rounded-xl bg-cream p-3 opacity-0 shadow-xl ring-1 ring-black/5 transition-[opacity,transform] duration-150 ease-out group-hover/seat:scale-100 group-hover/seat:opacity-100 group-focus-within/seat:scale-100 group-focus-within/seat:opacity-100 ${
              flipDown ? 'origin-top' : 'origin-bottom'
            }`}
          >
          <div className="flex items-center gap-2">
            <GuestAvatar
              name={occupant.name}
              imageUrl={occupant.imageUrl}
              avatarConfig={occupant.avatarConfig}
              sizeClassName="h-8 w-8"
              ringClassName={STAGE_TONE[getGuestStage(occupant)].ring}
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-ink-900">{occupant.name}</p>
              <p className="truncate text-[10px] text-muted">{occupant.organization || '—'}</p>
            </div>
          </div>
          <span
            className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STAGE_TONE[getGuestStage(occupant)].wash} ${STAGE_TONE[getGuestStage(occupant)].text}`}
          >
            {STAGE_TONE[getGuestStage(occupant)].label}
          </span>
          <span
            className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
              flipDown ? 'bottom-full border-b-cream' : 'top-full border-t-cream'
            }`}
          />
          </div>
        </div>
      )}
    </div>
  )
}
