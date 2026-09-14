import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

// Pointer-event-based dragging for one item on SeatMapCanvas's free-form
// floor plan — replaces the native HTML5 drag-and-drop this used to run on
// (draggable/onDragStart/onDrop). Native drag looks and feels noticeably
// different across browsers (a browser-rendered ghost snapshot, no control
// over its styling, and the actual element doesn't visually move at all
// until drop), which is what read as "not smooth" — a request specifically
// asked for the block to move with the cursor the way direct manipulation
// normally does. This mutates `elRef`'s own `transform` directly on every
// pointermove (compositor-only, no React re-render per frame) — the same
// direct-DOM technique useSwipeToDismiss already uses for its own drag, and
// for the same reason: a re-render on every pointermove is exactly what
// used to cause jank on a page with many seats.
export interface UseDragToMoveOptions {
  enabled: boolean
  /** The canvas's own current zoom — a screen-pixel pointer delta has to be
   * divided by this before being applied as the dragged item's own
   * `translate()`, since that item already sits inside an ancestor with
   * `transform: scale(zoom)`; skipping this would make the drag feel too
   * fast/slow at any zoom level other than 100%. */
  zoom: number
  x: number
  y: number
  onCommit: (x: number, y: number) => void
  /** Other DOM elements that should visually move in lockstep with elRef
   * for the duration of THIS drag — a table's own generated chairs, say,
   * which are separate SeatTile elements elsewhere in the tree, not
   * children of the table's own DOM node, but still need to follow it live
   * rather than snapping into place only once the drag commits (the data
   * layer already moves them together — see layoutBlocks.ts's
   * moveLayoutBlock — this is purely about the drag LOOKING like one
   * gesture instead of the chairs visibly lagging behind, then jumping).
   * Called once at pointerdown (not kept warm between drags) so the caller
   * can look the elements up fresh each gesture. */
  getSyncedElements?: () => HTMLElement[]
}

// Real screen-pixel movement (not divided by zoom) below this never counts
// as a drag — keeps a plain click (a fractional pointer wobble between
// press and release) from being misread as a drag-with-no-real-movement,
// which would otherwise suppress the click's own selection toggle for no
// reason.
const DRAG_THRESHOLD_PX = 4

export function useDragToMove<T extends HTMLElement>(
  elRef: RefObject<T | null>,
  { enabled, zoom, x, y, onCommit, getSyncedElements }: UseDragToMoveOptions
) {
  const [isDragging, setIsDragging] = useState(false)
  const start = useRef({ clientX: 0, clientY: 0 })
  const moved = useRef(false)
  const syncedEls = useRef<HTMLElement[]>([])

  function applyDelta(clientX: number, clientY: number) {
    const dx = (clientX - start.current.clientX) / zoom
    const dy = (clientY - start.current.clientY) / zoom
    if (!moved.current && Math.hypot(clientX - start.current.clientX, clientY - start.current.clientY) > DRAG_THRESHOLD_PX) {
      moved.current = true
    }
    const transform = moved.current ? `translate(${dx}px, ${dy}px)` : ''
    if (elRef.current) elRef.current.style.transform = transform
    syncedEls.current.forEach((el) => {
      el.style.transform = transform
    })
    return { dx, dy }
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (!enabled) return
    // Only the primary button/first touch point starts a drag — a
    // secondary mouse button or an extra touch shouldn't hijack the
    // gesture already fitting DRAG_THRESHOLD_PX below.
    if (e.button !== 0) return
    e.stopPropagation()
    start.current = { clientX: e.clientX, clientY: e.clientY }
    moved.current = false
    syncedEls.current = getSyncedElements ? getSyncedElements() : []
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!isDragging) return
    applyDelta(e.clientX, e.clientY)
  }

  function onPointerUp(e: ReactPointerEvent) {
    if (!isDragging) return
    const { dx, dy } = applyDelta(e.clientX, e.clientY)
    setIsDragging(false)
    if (elRef.current) elRef.current.style.transform = ''
    syncedEls.current.forEach((el) => {
      el.style.transform = ''
    })
    syncedEls.current = []
    if (moved.current) onCommit(Math.max(0, Math.round(x + dx)), Math.max(0, Math.round(y + dy)))
  }

  return {
    isDragging,
    /** True only for the click immediately following a real drag (past
     * DRAG_THRESHOLD_PX) — callers check this in their own onClick to skip
     * treating a drag-release as a selection toggle, then should reset it. */
    wasDragged: moved.current,
    resetWasDragged: () => {
      moved.current = false
    },
    handlers: enabled
      ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }
      : {},
  }
}
