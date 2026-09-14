import { useEffect, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent, type ReactNode, type SVGProps } from 'react'
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber'
import { gradientFromIconText } from './cardChrome'

// The shared KPI card recipe. Two variants: the plain neutral cream card
// (color living only in the icon chip, the numeral, and a hover-reveal
// corner glyph) and, since this "propose a card redesign" round, a bolder
// `solid` variant — a diagonal gradient fill in the metric's own color plus
// a big, permanently-visible watermark of the tile's own icon, replacing
// both the small icon chip and the old generic AscendingBarsGlyph. See
// `solid`'s own doc below for why every StatTiles tile now uses it rather
// than just one hero tile.
export interface KpiTileProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  iconWash: string
  iconText: string
  value: number | string
  label: string
  glyphColor: string
  /** The solid-gradient hero variant (see cardChrome.ts's own
   * gradientFromIconText for the actual gradient/watermark recipe). Was a
   * flat single-color fill reserved for exactly one "hero" tile (see
   * plan.md's Nothing-OS "restraint" note) — StatTiles now deliberately
   * overrides that restraint and puts every tile in this variant, per an
   * explicit request to explore "mostly solid color with a watermark"
   * rather than one accent tile among three neutral ones. */
  solid?: boolean
  /** Extra classes merged onto the card's own root — e.g. `h-full` so a
   * hero tile placed beside a taller sibling (StatTiles' own mini-strip)
   * actually fills its grid cell instead of sizing to its own content and
   * leaving empty space below it. */
  className?: string
  children?: ReactNode
}

// Pulls the leading number out of `value` so it can be counted up/flashed
// even when the tile's own value is a formatted string like "42%" — the
// suffix (the "%", or anything else after the digits) rides along
// unanimated. Returns null for a value with no leading number at all (there
// isn't one today, but a caller could still pass pure text safely).
function parseNumeric(value: number | string): { numeric: number; suffix: string } | null {
  if (typeof value === 'number') return { numeric: value, suffix: '' }
  const match = /^(-?\d+(?:\.\d+)?)(.*)$/.exec(value)
  if (!match) return null
  return { numeric: Number(match[1]), suffix: match[2] }
}

export default function KpiTile({ icon: Icon, iconWash, iconText, value, label, glyphColor, solid, className = '', children }: KpiTileProps) {
  const tileRef = useRef<HTMLDivElement>(null)
  const gradientStyle = solid ? gradientFromIconText(iconText) : undefined
  const parsed = parseNumeric(value)
  const animated = useAnimatedNumber(parsed?.numeric ?? 0, 700)
  const displayValue = parsed ? `${animated}${parsed.suffix}` : value

  // One quick color wash when the REAL value changes direction (not the
  // animated display, which is mid-count-up half the time) — up = the same
  // green this app already uses for "confirmed"/good outcomes, down = the
  // same red it uses for "declined"/bad ones. `flashSeq` (not just a
  // direction string) is what actually keys the overlay below: two flashes
  // in the same direction back to back need a fresh element to replay the
  // keyframe, a plain state change to an identical className wouldn't
  // restart it.
  const [flash, setFlash] = useState<{ seq: number; direction: 'up' | 'down' } | null>(null)
  const prevNumericRef = useRef(parsed?.numeric)
  const flashSeqRef = useRef(0)

  useEffect(() => {
    const prev = prevNumericRef.current
    prevNumericRef.current = parsed?.numeric
    if (parsed === null || prev === undefined || prev === parsed.numeric) return
    flashSeqRef.current += 1
    setFlash({ seq: flashSeqRef.current, direction: parsed.numeric > prev ? 'up' : 'down' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed?.numeric])

  // Hover lift + a few degrees of cursor-following tilt — mutates the
  // tile's own transform directly on pointermove (no React re-render per
  // frame) rather than tracking tilt in state, the same "direct DOM write
  // during a live gesture" call useDragToMove/GuestDock's own drag-hover
  // already make, and for the same reason: a state update on every
  // mousemove frame is real, felt cost for a purely cosmetic effect.
  // `transition-transform` (in the className below) is what eases it back
  // to flat on pointer-leave, same as if this were a CSS-only hover.
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const el = tileRef.current
    if (!el || e.pointerType === 'touch') return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `translateY(-4px) perspective(600px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg)`
  }

  function handlePointerLeave() {
    if (tileRef.current) tileRef.current.style.transform = ''
  }

  return (
    <div
      ref={tileRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={gradientStyle}
      className={`group relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-transform duration-300 ease-out [transform-style:preserve-3d] ${
        solid ? 'border-transparent' : 'border-cream/40 bg-cream'
      } ${className}`}
    >
      {flash && (
        <div
          key={flash.seq}
          aria-hidden="true"
          onAnimationEnd={() => setFlash(null)}
          className={`pointer-events-none absolute inset-0 ${flash.direction === 'up' ? 'bg-status-confirmed/25' : 'bg-status-declined/25'}`}
          style={{ animation: 'kpi-flash 650ms ease-out both' }}
        />
      )}
      {solid ? (
        // The watermark — this tile's own icon (not a generic decorative
        // mark), oversized and bled off the corner via the card's own
        // overflow-hidden, same "faint at rest, a little bolder on hover"
        // restraint AscendingBarsGlyph used, just built from a real icon
        // now that every tile carries this look instead of one accent tile
        // among three plain ones (see `solid`'s own doc).
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 text-white opacity-[0.16] transition-[opacity,transform] duration-300 ease-out group-hover:scale-110 group-hover:opacity-[0.26] sm:h-32 sm:w-32"
        />
      ) : (
        <AscendingBarsGlyph className={glyphColor} />
      )}
      {!solid && (
        <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl sm:h-14 sm:w-14 ${iconWash} ${iconText}`}>
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
        </span>
      )}
      {/* text-4xl/5xl — bumped up from text-3xl/4xl, pushing further into
          the "one huge bold numeral, tiny caption" bento hierarchy plan.md
          already documents for this card (see the Nothing-OS section
          there). solid tiles skip straight to the numeral (no icon chip
          above it) since the watermark now carries the icon instead. */}
      <p className={`relative font-display text-4xl font-bold tabular-nums sm:text-5xl ${solid ? 'text-white' : `mt-4 ${iconText}`}`}>
        {displayValue}
      </p>
      <p className={`relative mt-1 text-xs font-medium uppercase tracking-wide ${solid ? 'text-white/70' : 'text-muted'}`}>{label}</p>
      {children}
    </div>
  )
}

// The hover-reveal corner mark — an ascending 3-bar "growth" glyph, matching
// a reference the user pointed to almost exactly: a faint, monochrome mark
// tucked in a card's corner at rest, fully colored and slightly larger on
// hover. Anchored past the tile's own bottom-right edge on purpose — the
// tile's overflow-hidden clips it into an L-shaped reveal in the corner,
// same as the reference, rather than a neatly-contained icon. Neutral-
// variant only now — the solid variant's own icon watermark (see above)
// replaced it there.
function AscendingBarsGlyph({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className={`pointer-events-none absolute -bottom-2 -right-2 h-20 w-20 opacity-[0.14] transition-[opacity,transform] duration-300 ease-out group-hover:scale-110 group-hover:opacity-100 ${className}`}
    >
      <rect x="6" y="38" width="12" height="20" rx="3" fill="currentColor" />
      <rect x="26" y="24" width="12" height="34" rx="3" fill="currentColor" />
      <rect x="46" y="6" width="12" height="52" rx="3" fill="currentColor" />
    </svg>
  )
}
