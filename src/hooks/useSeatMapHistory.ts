import { useCallback, useRef, useState } from 'react'
import { restoreSeatMapSnapshot } from '../data/layoutBlocks'
import type { LayoutBlock, Seat } from '../data/types'

interface Snapshot {
  seats: Seat[]
  layoutBlocks: LayoutBlock[]
}

// Undo/redo for the floor-plan editor — scoped to layout edits (move/
// resize/add/delete/rename/duplicate of seats and blocks, plus Reset to
// default), not guest seat assignment, which has its own separate
// unassign-based undo already. A whole-snapshot stack, not a replay of
// individual commands: far simpler to get right for this app's size of
// data, at the cost of also reverting anything else that happened to this
// seat map's rows in between two snapshots (a guest assignment made
// mid-edit-session, say) — a documented tradeoff, not an oversight; see
// restoreSeatMapSnapshot's own doc.
//
// Also owns baselineRef — a snapshot of this seat map as it looked before
// this editing session's first edit — and resetToBaseline, the thing both
// "Reset to default" and discarding out of the editor actually restore.
export function useSeatMapHistory(seatMapId: string | undefined, seats: Seat[], layoutBlocks: LayoutBlock[]) {
  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  // Initialized to a value that can never equal a real seatMapId (rather
  // than useRef(seatMapId)) specifically so the "seat map identity changed"
  // branch below also fires once on this hook's very first render for
  // whichever seat map loads first — that's what captures baselineRef the
  // very first time, not just on a later switch between events.
  const lastSeatMapId = useRef<string | undefined>(undefined)
  // A snapshot of how this seat map looked the moment its editing session
  // started — i.e. before any edit made THIS SESSION touched it. This is
  // what "Reset to default" (see resetToBaseline) and discarding out of the
  // editor both actually mean now: back to here, not a wipe to a blank
  // canvas. Deliberately its own ref rather than "the bottom of undoStack" —
  // reads the same today (undoStack's oldest entry IS this same state,
  // since recordBeforeChange only ever pushes what was true right before
  // the FIRST edit too) but keeping it separate means it survives even if
  // undoStack's own shape ever changes (e.g. a max stack depth) independent
  // of this file's more basic promise: what did the floor plan look like
  // when the admin opened the editor.
  const baselineRef = useRef<Snapshot | null>(null)

  // An undo stack built against a different event's floor plan would be
  // nonsensical to apply here — clears both stacks the moment the seat map
  // identity itself changes (switching events), during render rather than
  // an effect so it takes hold before any handler could read a stale stack.
  if (lastSeatMapId.current !== seatMapId) {
    lastSeatMapId.current = seatMapId
    undoStack.current = []
    redoStack.current = []
    baselineRef.current = seatMapId ? { seats, layoutBlocks } : null
    if (canUndo) setCanUndo(false)
    if (canRedo) setCanRedo(false)
  }

  // Call immediately before performing a mutating action — captures the
  // state as it is RIGHT NOW (pre-mutation) onto the undo stack. Any new
  // edit invalidates whatever used to be "ahead," the same as a text
  // editor's own undo/redo.
  const recordBeforeChange = useCallback(() => {
    undoStack.current.push({ seats, layoutBlocks })
    redoStack.current = []
    setCanUndo(true)
    setCanRedo(false)
  }, [seats, layoutBlocks])

  const undo = useCallback(() => {
    if (!seatMapId || undoStack.current.length === 0) return
    const previous = undoStack.current.pop()!
    redoStack.current.push({ seats, layoutBlocks })
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(true)
    restoreSeatMapSnapshot(seatMapId, previous.seats, previous.layoutBlocks)
  }, [seatMapId, seats, layoutBlocks])

  const redo = useCallback(() => {
    if (!seatMapId || redoStack.current.length === 0) return
    const next = redoStack.current.pop()!
    undoStack.current.push({ seats, layoutBlocks })
    setCanRedo(redoStack.current.length > 0)
    setCanUndo(true)
    restoreSeatMapSnapshot(seatMapId, next.seats, next.layoutBlocks)
  }, [seatMapId, seats, layoutBlocks])

  // "Reset to default" (and discarding out of the editor, which is the same
  // action under a different button) — restores baselineRef rather than
  // wiping the seat map, and is itself just another undoable step (pushed
  // onto undoStack the same as any other mutation) so an admin who resets
  // by mistake can still hit Undo right after, same promise every other
  // layout edit already makes.
  const resetToBaseline = useCallback(() => {
    if (!seatMapId || !baselineRef.current) return
    undoStack.current.push({ seats, layoutBlocks })
    redoStack.current = []
    setCanUndo(true)
    setCanRedo(false)
    restoreSeatMapSnapshot(seatMapId, baselineRef.current.seats, baselineRef.current.layoutBlocks)
  }, [seatMapId, seats, layoutBlocks])

  return { recordBeforeChange, undo, redo, resetToBaseline, canUndo, canRedo }
}
