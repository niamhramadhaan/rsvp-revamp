// Three starter floor plans — usable from CreateEventDrawer (a brand-new
// event has no seat map at all until now; see createSeatMap's own doc) or
// EditEventDrawer (replacing an existing, still-empty layout). Each builds a
// real SeatGroup + a stage LayoutBlock + either plain seats or table
// LayoutBlocks with their own generated chairs — the exact same records the
// canvas's own "+" library would produce one at a time, just many at once.

import { genId, readTable, writeTable } from './store'
import { createSeatMap, createSeatGroup, getSeatMapByEvent } from './seatmaps'
import { edgeSeatPositions } from './layoutBlocks'
import type { LayoutBlock, Seat, SeatGroup, SeatMap } from './types'

export type SeatMapTemplateId = 'theater' | 'classroom' | 'banquet'

export interface SeatMapTemplateOption {
  id: SeatMapTemplateId
  name: string
  description: string
}

export const SEAT_MAP_TEMPLATES: SeatMapTemplateOption[] = [
  { id: 'theater', name: 'Theater rows', description: 'A stage with one continuous block of seat rows facing it — cinema/auditorium style.' },
  { id: 'classroom', name: 'Classroom', description: 'A stage with rows of seats split into two sections by a center aisle.' },
  { id: 'banquet', name: 'Banquet tables', description: 'A stage plus a grid of rectangular dining tables, six chairs each.' },
]

const SEAT_CELL_PX = 44 // kept in sync with SeatMapCanvas's own CELL_PX by comment, same as layoutBlocks.ts
const SEAT_GAP_PX = 10
const STAGE_WIDTH = 280
const STAGE_HEIGHT = 64
const STAGE_Y = 24

// Every build*() below computes its own layout relative to (0, 0) — this is
// the shared offset applied once, in applyTemplate, so a freshly-applied
// template actually lands roughly centered in the canvas's own guaranteed-
// minimum area (SeatMapCanvas's own MIN_CANVAS_SIZE) instead of pinned to
// its top-left corner. Pinning to (0,0) read as "the canvas has an edge
// here" — every other way of adding something to this canvas (the "+"
// library's own placement, see SeatMapCanvas's getPlacementPosition) already
// lands wherever the admin is currently looking, not at a fixed corner; a
// template is the one thing that still needs a sensible DEFAULT spot before
// anyone's looked anywhere, so it gets a fixed, roughly-central one instead
// of literally (0,0). SeatMapCanvas's own handleApplyTemplateClick pans the
// camera to this same spot right after a successful apply.
export const TEMPLATE_ORIGIN_X = 900
export const TEMPLATE_ORIGIN_Y = 900

interface TemplateSeat {
  x: number
  y: number
}

function buildTheaterRows(): { stage: Omit<LayoutBlock, 'id' | 'seatMapId'>; seatPositions: TemplateSeat[] } {
  const rows = 8
  const cols = 12
  const rowStep = SEAT_CELL_PX + SEAT_GAP_PX
  const totalWidth = cols * rowStep - SEAT_GAP_PX
  const startX = Math.round((totalWidth - STAGE_WIDTH) / -2) // centers the seat block under a stage of STAGE_WIDTH
  const startY = STAGE_Y + STAGE_HEIGHT + 60
  const seatPositions: TemplateSeat[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      seatPositions.push({ x: startX + c * rowStep, y: startY + r * rowStep })
    }
  }
  const stage = { kind: 'stage' as const, x: Math.round((totalWidth - STAGE_WIDTH) / 2) + startX, y: STAGE_Y, width: STAGE_WIDTH, height: STAGE_HEIGHT, label: 'Stage' }
  return { stage, seatPositions }
}

function buildClassroomRows(): { stage: Omit<LayoutBlock, 'id' | 'seatMapId'>; seatPositions: TemplateSeat[] } {
  const rows = 6
  const colsPerSide = 5
  const rowStep = SEAT_CELL_PX + SEAT_GAP_PX
  const aisle = 40
  const sideWidth = colsPerSide * rowStep - SEAT_GAP_PX
  const totalWidth = sideWidth * 2 + aisle
  const startX = 0
  const startY = STAGE_Y + STAGE_HEIGHT + 60
  const seatPositions: TemplateSeat[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < colsPerSide; c++) {
      seatPositions.push({ x: startX + c * rowStep, y: startY + r * rowStep })
      seatPositions.push({ x: startX + sideWidth + aisle + c * rowStep, y: startY + r * rowStep })
    }
  }
  const stage = { kind: 'stage' as const, x: Math.round((totalWidth - STAGE_WIDTH) / 2), y: STAGE_Y, width: STAGE_WIDTH, height: STAGE_HEIGHT, label: 'Stage' }
  return { stage, seatPositions }
}

export interface BanquetBuild {
  stage: Omit<LayoutBlock, 'id' | 'seatMapId'>
  tables: Omit<LayoutBlock, 'id' | 'seatMapId'>[]
  seatPositionsByTable: TemplateSeat[][]
}

// Exported for seed.ts — the default (seeded) seat map IS this banquet
// build, so both go through the exact same geometry rather than the seed
// hand-rolling a second, slightly-different banquet next to it.
export function buildBanquetTables(): BanquetBuild {
  const tableWidth = 150
  const tableHeight = 48
  const cols = 3
  const rows = 2
  const colGap = 90
  const rowGap = 110
  const startX = 0
  const startY = STAGE_Y + STAGE_HEIGHT + 70
  const tables: Omit<LayoutBlock, 'id' | 'seatMapId'>[] = []
  const seatPositionsByTable: TemplateSeat[][] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * (tableWidth + colGap)
      const y = startY + r * (tableHeight + rowGap)
      tables.push({ kind: 'table-rect', x, y, width: tableWidth, height: tableHeight, label: '' })
      seatPositionsByTable.push(edgeSeatPositions(x, y, tableWidth, tableHeight, 3))
    }
  }
  const totalWidth = cols * (tableWidth + colGap) - colGap
  const stage = { kind: 'stage' as const, x: Math.round((totalWidth - STAGE_WIDTH) / 2), y: STAGE_Y, width: STAGE_WIDTH, height: STAGE_HEIGHT, label: 'Stage' }
  return { stage, tables, seatPositionsByTable }
}

function nextLabel(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`
}

// Every SeatGroup anywhere in this app is one of exactly these two
// categories now (see SeatMapCanvas's own Switch action, which cycles
// between whatever groups exist — in practice always just these two) —
// templates used to invent their own one-off name per template ("General
// Admission," "Attendee," "Guest"), which broke that "only VIP/Regular"
// rule the moment someone applied one. VIP_SHARE mirrors the seed event's
// own convention (its front two rows are VIP, the rest Regular) — the
// seats/table closest to the stage become VIP, everything else Regular.
const VIP_COLOR = '#0060A8'
const REGULAR_COLOR = '#3CA8D8'
const VIP_SHARE = 0.2

export interface ApplyTemplateResult {
  ok: boolean
  reason?: string
}

// Replaces whatever's currently on this event's seat map with the chosen
// template — refuses if any existing seat is already assigned to a guest
// (same "ask/guard" spirit as deleteLayoutBlock/resetSeatMap), since a
// template swap is exactly as destructive as Reset to default plus a fresh
// build. Creating the seat map itself if this event never had one — the
// common case for anything but the one seed event (see createSeatMap).
export async function applyTemplate(eventId: string, templateId: SeatMapTemplateId): Promise<ApplyTemplateResult> {
  const existingMap = await getSeatMapByEvent(eventId)
  if (existingMap) {
    const existingSeats = readTable<Seat>('seats').filter((s) => s.seatMapId === existingMap.id)
    if (existingSeats.some((s) => s.status === 'assigned')) {
      return { ok: false, reason: 'Unassign every guest before applying a template' }
    }
  }

  const seatMap: SeatMap = existingMap ?? (await createSeatMap(eventId))

  // Clears this seat map's own existing rows first — same effect as Reset
  // to default, since applying a template is exactly that plus a fresh
  // build, not a merge with whatever was already there. seatGroups included
  // now (a real bug fix, not just tidiness): this used to only clear
  // seats/layoutBlocks, so re-applying a template — or applying a second
  // one — to the same event kept calling createSeatGroup below without
  // ever removing the PREVIOUS VIP/Regular pair first, silently
  // accumulating an extra duplicate VIP+Regular group every time (visible
  // as a tripled/quadrupled Group filter list in GuestFilterPopover, since
  // that list is just whatever's actually in the seatGroups table for this
  // seat map — not a rendering bug there at all).
  writeTable('seats', readTable<Seat>('seats').filter((s) => s.seatMapId !== seatMap.id))
  writeTable('layoutBlocks', readTable<LayoutBlock>('layoutBlocks').filter((b) => b.seatMapId !== seatMap.id))
  writeTable('seatGroups', readTable<SeatGroup>('seatGroups').filter((g) => g.seatMapId !== seatMap.id))

  const newBlocks: LayoutBlock[] = []
  const newSeats: Seat[] = []

  if (templateId === 'theater' || templateId === 'classroom') {
    const built = templateId === 'theater' ? buildTheaterRows() : buildClassroomRows()
    const vipCount = Math.max(1, Math.round(built.seatPositions.length * VIP_SHARE))
    const vipGroup = await createSeatGroup(seatMap.id, 'VIP', VIP_COLOR, vipCount)
    const regGroup = await createSeatGroup(seatMap.id, 'Regular', REGULAR_COLOR, built.seatPositions.length - vipCount)
    newBlocks.push({ id: genId('block'), seatMapId: seatMap.id, ...built.stage })
    built.seatPositions.forEach((pos, i) => {
      const isVip = i < vipCount
      const group = isVip ? vipGroup : regGroup
      const indexInGroup = isVip ? i : i - vipCount
      newSeats.push({
        id: genId('seat'),
        seatMapId: seatMap.id,
        groupId: group.id,
        row: Math.floor(i / 1000), // template seats aren't a fixed-column grid the same way SEED_SEATS is; row/column only need to be stable, not meaningful
        column: i,
        x: pos.x,
        y: pos.y,
        label: nextLabel(group.label.slice(0, 3).toUpperCase(), indexInGroup),
        kind: 'seat',
        status: 'empty',
      })
    })
  } else {
    const built = buildBanquetTables()
    const totalSeats = built.seatPositionsByTable.reduce((sum, arr) => sum + arr.length, 0)
    // The table nearest the stage (built.tables[0]) is VIP, every other
    // table Regular — same "closest to the front is VIP" convention the
    // row-based templates above use.
    const vipSeatCount = built.seatPositionsByTable[0]?.length ?? 0
    const vipGroup = await createSeatGroup(seatMap.id, 'VIP', VIP_COLOR, vipSeatCount)
    const regGroup = await createSeatGroup(seatMap.id, 'Regular', REGULAR_COLOR, totalSeats - vipSeatCount)
    newBlocks.push({ id: genId('block'), seatMapId: seatMap.id, ...built.stage })
    let vipIndex = 0
    let regIndex = 0
    built.tables.forEach((table, tableIndex) => {
      const blockId = genId('block')
      newBlocks.push({ id: blockId, seatMapId: seatMap.id, ...table })
      const isVipTable = tableIndex === 0
      const group = isVipTable ? vipGroup : regGroup
      built.seatPositionsByTable[tableIndex].forEach((pos) => {
        const indexInGroup = isVipTable ? vipIndex++ : regIndex++
        newSeats.push({
          id: genId('seat'),
          seatMapId: seatMap.id,
          groupId: group.id,
          row: tableIndex,
          column: indexInGroup,
          x: pos.x,
          y: pos.y,
          label: nextLabel(group.label.slice(0, 3).toUpperCase(), indexInGroup),
          kind: 'seat',
          status: 'empty',
          tableBlockId: blockId,
        })
      })
    })
  }

  // Shift the whole freshly-built layout at once — see TEMPLATE_ORIGIN_X/Y's
  // own doc for why every build*() above computes relative to (0, 0) rather
  // than this origin directly (keeps their own internal geometry easy to
  // eyeball independent of where the result ends up landing).
  const offsetBlocks = newBlocks.map((b) => ({ ...b, x: b.x + TEMPLATE_ORIGIN_X, y: b.y + TEMPLATE_ORIGIN_Y }))
  const offsetSeats = newSeats.map((s) => ({ ...s, x: s.x + TEMPLATE_ORIGIN_X, y: s.y + TEMPLATE_ORIGIN_Y }))

  writeTable('layoutBlocks', [...readTable<LayoutBlock>('layoutBlocks'), ...offsetBlocks])
  writeTable('seats', [...readTable<Seat>('seats'), ...offsetSeats])

  return { ok: true }
}
