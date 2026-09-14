// Small utility icons used throughout the header, cards and chart controls.

import type { SVGProps } from 'react'

export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M12 4a5 5 0 0 0-5 5v3.2c0 .8-.3 1.6-.9 2.2L5 15.5h14l-1.1-1.1a3.1 3.1 0 0 1-.9-2.2V9a5 5 0 0 0-5-5Z" strokeLinejoin="round" />
      <path d="M10 18.5a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  )
}

export function LogoutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 12H9" strokeLinecap="round" />
    </svg>
  )
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DotsVerticalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="12" cy="5.5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="18.5" r="1.6" />
    </svg>
  )
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M12 4v11" strokeLinecap="round" />
      <path d="M7.5 11.5 12 16l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19.5h14" strokeLinecap="round" />
    </svg>
  )
}

export function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M9 6.5v11l9-5.5-9-5.5Z" />
    </svg>
  )
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  )
}

export function ChevronLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}

export function FullscreenEnterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 9V5a1 1 0 0 1 1-1h4" />
      <path d="M20 9V5a1 1 0 0 0-1-1h-4" />
      <path d="M4 15v4a1 1 0 0 0 1 1h4" />
      <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
    </svg>
  )
}

export function FullscreenExitIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 4v3a1 1 0 0 1-1 1H5" />
      <path d="M15 4v3a1 1 0 0 0 1 1h3" />
      <path d="M9 20v-3a1 1 0 0 0-1-1H5" />
      <path d="M15 20v-3a1 1 0 0 1 1-1h3" />
    </svg>
  )
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
      <path d="M4 9.5h16" />
      <path d="M8 3.5v3.2M16 3.5v3.2" strokeLinecap="round" />
    </svg>
  )
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.8-4.8" />
    </svg>
  )
}

export function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M12 15V4" strokeLinecap="round" />
      <path d="M7.5 8.5 12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19.5h14" strokeLinecap="round" />
    </svg>
  )
}

export function SendIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" {...props}>
      <path d="M20 4 3.5 10.2c-.9.34-.86 1.62.06 1.9L11 14.4l2.3 7.44c.28.92 1.56.96 1.9.06L21.4 4l0 0" strokeLinecap="round" />
      <path d="M20 4 11 14.4" strokeLinecap="round" />
    </svg>
  )
}

export function QrCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11.5 11 14.5l5.5-6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MapPinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21Z" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.3" />
    </svg>
  )
}

export function ChartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 19.5V10" />
      <path d="M12 19.5V4.5" />
      <path d="M19 19.5v-7" />
      <path d="M3.5 19.5h17" />
    </svg>
  )
}

export function MinusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  )
}

export function FilterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M4 5h16l-6 7.5v5l-4 2v-7L4 5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// A landscape photo placeholder — the empty state for an event's own
// (optional) image field, before one's been uploaded.
export function ImageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.2" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M4.5 16.5 9 12l3 3 4-4.5 3.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// An envelope — GuestProfileDrawer's "Send via email" button.
export function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" />
      <path d="M4.2 7l7.8 6 7.8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  )
}

// A generic chat bubble — GuestProfileDrawer's "Send via WhatsApp" button.
// Deliberately generic (not the literal WhatsApp glyph): this app has no
// license to reproduce that brand mark, and a plain speech-bubble already
// reads as "chat/message" without claiming to be that specific app's logo.
export function ChatBubbleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M4 12a8 8 0 1 1 3.3 6.5L4 19.5l1.2-3.4A7.95 7.95 0 0 1 4 12Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// A circled "i" — the Toast component's info-tone icon (distinct from
// AlertTriangleIcon's warning tone and CheckmarkIcon's success tone).
export function InfoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.3" strokeLinecap="round" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

// A simple data table — GuestListMiniWidget's "View guest table" button,
// distinct from NavIcons' GridIcon (four loose dots, used for a layout/grid
// nav destination) since this specifically needs to read as rows+columns.
export function TableIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M9 9.5V19.5M15 9.5V19.5" />
    </svg>
  )
}

// A stage/podium — SeatMapCanvas's "Stage" library item, and the block
// itself once placed.
// A plain solid rectangle — SeatMapCanvas's dock "Stage" item, redrawn to
// directly match what actually lands on the canvas (a solid bg-ink-900
// rect, see LayoutBlockTile's own kindClass) rather than a separate podium
// pictogram — the dock reads as a small preview of the real thing now, not
// a generic icon standing in for it.
export function StageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
      <rect x="3" y="8" width="18" height="8" rx="1.5" />
    </svg>
  )
}

// A curved back-arrow — SeatMapCanvas's Undo button.
export function UndoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M8 8 4 12l4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12h10a6 6 0 0 1 0 12h-1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// UndoIcon mirrored — SeatMapCanvas's Redo button.
export function RedoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M16 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 12H10a6 6 0 0 0 0 12h1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// A counter-clockwise circular arrow — SeatMapCanvas's Reset to default.
export function ResetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}>
      <path d="M4 12a8 8 0 1 1 2.5 5.8" strokeLinecap="round" />
      <path d="M4 17v-5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// A table with 4 chairs (2 filled squares each long edge) — SeatMapCanvas's
// "Table · 4" library item. Distinct from TableIcon (a data-table grid,
// GuestListMiniWidget's "View guest table" button) — reusing that one here
// read as "a spreadsheet," not "furniture."
export function TableFourIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="6" y="9" width="12" height="6" rx="1.5" />
      <rect x="8.5" y="4.3" width="3" height="3" rx="0.8" fill="currentColor" stroke="none" />
      <rect x="12.5" y="4.3" width="3" height="3" rx="0.8" fill="currentColor" stroke="none" />
      <rect x="8.5" y="16.7" width="3" height="3" rx="0.8" fill="currentColor" stroke="none" />
      <rect x="12.5" y="16.7" width="3" height="3" rx="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Same idea as TableFourIcon, 6 chairs (3 each long edge) — SeatMapCanvas's
// "Table · 6" library item.
export function TableSixIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="4.5" y="9" width="15" height="6" rx="1.5" />
      <rect x="6.2" y="4.3" width="2.6" height="2.6" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="10.7" y="4.3" width="2.6" height="2.6" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="15.2" y="4.3" width="2.6" height="2.6" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="6.2" y="17.1" width="2.6" height="2.6" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="10.7" y="17.1" width="2.6" height="2.6" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="15.2" y="17.1" width="2.6" height="2.6" rx="0.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

// A price-tag shape — SeatMapCanvas's "Label" library item (a custom named
// zone, e.g. "Bar," "Entrance").
// A dashed-stroke rectangle — SeatMapCanvas's dock "Label" item, redrawn to
// directly match a placed label block's own look (border-2 border-dashed,
// see LayoutBlockTile's kindClass) instead of a generic price-tag pictogram
// unrelated to what a "Label" actually is on this canvas (a custom-named
// dashed zone, e.g. "Bar," "Entrance").
export function TagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2.5" {...props}>
      <rect x="4" y="7" width="16" height="10" rx="2" />
    </svg>
  )
}

// A plain stroked square — SeatMapCanvas's dock "Seat" item, redrawn to
// directly match an empty seat tile's own look (a bordered square, no fill
// — see SeatTile's own unassigned styling) instead of a chair pictogram;
// ChairIcon itself stays a literal chair silhouette for contexts that mean
// "a seat" generically (Auto assign, check-in), not "this exact canvas
// tile."
export function SeatSquareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="5" y="5" width="14" height="14" rx="3" />
    </svg>
  )
}

// A layout blueprint — four unevenly-sized panes on a single sheet — the
// seat map's own "Templates" action (SeatMapCanvas's toolbar), distinct from
// StageIcon/TableFourIcon/etc (one placeable piece each): this opens a
// picker for a whole ready-made floor plan, not a single item.
// Three ruled lines with their own "1 2 3" — the seat map editor's
// "Renumber seats" action (layoutBlocks.ts's renumberSeatLabels closes label
// gaps left behind by deleted seats). The numbers are the actual point here,
// unlike TableIcon's plain data-grid lines, so this draws them directly
// rather than reaching for a generic ordered-list glyph.
export function ReorderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M9.5 6h10.5" strokeLinecap="round" />
      <path d="M9.5 12h10.5" strokeLinecap="round" />
      <path d="M9.5 18h10.5" strokeLinecap="round" />
      <text x="3" y="8.4" fontSize="6.5" fontWeight="700" fill="currentColor" stroke="none">
        1
      </text>
      <text x="3" y="14.4" fontSize="6.5" fontWeight="700" fill="currentColor" stroke="none">
        2
      </text>
      <text x="3" y="20.4" fontSize="6.5" fontWeight="700" fill="currentColor" stroke="none">
        3
      </text>
    </svg>
  )
}

export function TemplateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M12 3.5v17M3.5 10.5h8.5" strokeLinecap="round" />
    </svg>
  )
}

export function CheckmarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// A person with a "+" beside them — the Add Guest drawer's header badge.
export function UserPlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="8" r="3.1" />
      <path d="M3.6 19c1-3.2 3.5-5 5.4-5s4.4 1.8 5.4 5" />
      <path d="M18.2 7.5v5M15.7 10h5" />
    </svg>
  )
}

// A side-view dining chair — tall backrest on the left (continuing straight
// down into its own back leg), a flat seat, and a front leg — a clearer
// silhouette than this icon's previous rounded-box shape, which read as a
// bench/crate rather than a chair at the dock's small size.
export function ChairIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M7 3.5v16.5" strokeLinecap="round" />
      <path d="M7 11.5h10" strokeLinecap="round" />
      <path d="M17 11.5v8.5" strokeLinecap="round" />
      <path d="M7 20h10" strokeLinecap="round" />
    </svg>
  )
}

// A stage bar over two staggered rows of seat dots — a small floor-plan
// schematic (same visual language SeatMapCanvas's own TemplatePreview
// cards use), EventTabs' own "Seating" tab. Distinct from a single ChairIcon
// (one physical seat) — this is the whole arrangement, not one piece of it.
export function SeatingChartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
      <rect x="7" y="3" width="10" height="3" rx="1" />
      <circle cx="4.7" cy="13" r="1.6" />
      <circle cx="10" cy="13" r="1.6" />
      <circle cx="15.3" cy="13" r="1.6" />
      <circle cx="19.3" cy="13" r="1.6" />
      <circle cx="7.3" cy="19" r="1.6" />
      <circle cx="12.6" cy="19" r="1.6" />
      <circle cx="17.9" cy="19" r="1.6" />
    </svg>
  )
}

// Two sparkles (one large, one small) — the standard "auto/generated" glyph
// language, SeatMapCanvas's own "Auto assign" action. Replaces ChairIcon
// there (a plain chair didn't say "automatic" — it just repeated the dock's
// own seat icon), fill-based to read clearly at the toolbar's small size,
// same "no stroke, solid shape" treatment CheckmarkIcon/DotsVerticalIcon
// already use for small glyphs.
export function AutoAssignIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
      <path d="M11 2.5c.45 3.2 1.15 5.2 2.1 6.15.95.95 2.95 1.65 6.15 2.1-3.2.45-5.2 1.15-6.15 2.1-.95.95-1.65 2.95-2.1 6.15-.45-3.2-1.15-5.2-2.1-6.15-.95-.95-2.95-1.65-6.15-2.1 3.2-.45 5.2-1.15 6.15-2.1.95-.95 1.65-2.95 2.1-6.15Z" />
      <path d="M19 15.2c.2 1.35.5 2.2.9 2.6.4.4 1.25.7 2.6.9-1.35.2-2.2.5-2.6.9-.4.4-.7 1.25-.9 2.6-.2-1.35-.5-2.2-.9-2.6-.4-.4-1.25-.7-2.6-.9 1.35-.2 2.2-.5 2.6-.9.4-.4.7-1.25.9-2.6Z" />
    </svg>
  )
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AlertTriangleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M12 4.5 21 19.5H3L12 4.5Z" strokeLinejoin="round" />
      <path d="M12 10v4" strokeLinecap="round" />
      <circle cx="12" cy="16.7" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

// A pencil — the shared "edit" affordance (event detail, seat map layout).
export function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M4 20l.9-3.9L16.2 4.8a1.5 1.5 0 0 1 2.1 0l1 1a1.5 1.5 0 0 1 0 2.1L7.9 19.1 4 20Z" strokeLinejoin="round" />
      <path d="M14.5 6.5l3 3" strokeLinecap="round" />
    </svg>
  )
}

// A doorway with a footstep through it — this app's stand-in for "walked in
// off the street," used by the check-in flow's walk-in/no-RSVP state.
export function DoorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M6 20.5V4.5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" strokeLinejoin="round" />
      <path d="M4 20.5h16" strokeLinecap="round" />
      <circle cx="13.3" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Diagonal "open this" arrow — WidgetCard's own pill "View all" button (see
// its own doc), replacing a plain text-link underline with a real pill
// button that needed a trailing glyph to read as "goes somewhere," not a
// generic chevron (ChevronRightIcon already means "next/expand inline"
// elsewhere, e.g. RowActionsMenu's own kebab affordances never use one).
export function ArrowUpRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M7 17 17 7" strokeLinecap="round" />
      <path d="M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// A tall main block with a shorter annex — the leading icon for
// AddGuestDrawer/GuestProfileDrawer's own "Organization" field
// (BriefcaseIcon, NavIcons.tsx, already covers "Role" right next to it, so
// this needed to read as the company/building itself, not a second
// work-adjacent glyph).
export function BuildingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="4" y="3.5" width="12" height="17" rx="1.5" />
      <path d="M16 9.5h4v11h-4" strokeLinejoin="round" />
      <path d="M7.5 8h2M11.5 8h2M7.5 12h2M11.5 12h2M7.5 16h2M11.5 16h2" strokeLinecap="round" />
    </svg>
  )
}
