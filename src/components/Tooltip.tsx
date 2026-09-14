import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useEnterTransition } from '../hooks/useEnterTransition'
import { InfoIcon } from './icons/UiIcons'

export type TooltipPlacement = 'top' | 'right'

export interface TooltipProps {
  label: string
  children: ReactNode
  /** 'top' (default) for a horizontal row of triggers; 'right' for a
   * vertical stack (IconRail's own nav icons) — 'top' would overlap the
   * next icon up in a vertical rail, so the bubble opens sideways there
   * instead. */
  placement?: TooltipPlacement
  className?: string
  /** Extra classes merged onto the bubble itself, for the rare per-instance
   * need — e.g. IconRail's own `hidden lg:block` (no tooltip below lg:,
   * where that rail lays out horizontally and hover doesn't apply anyway). */
  bubbleClassName?: string
  /** A real sentence, not a one-word label (InfoTooltip's own use — see
   * below) — swaps the bubble from a single `whitespace-nowrap` line to a
   * wrapped, fixed-width paragraph. */
  wide?: boolean
  /** Hover-only — omits the keyboard-focus reveal every other Tooltip gets
   * by default (see this component's own doc for why that's the baseline:
   * keyboard users get the hint too, not just mouse hover). IconRail's own
   * nav buttons opt into this: clicking one leaves it focused (the
   * ordinary browser default after any click), and a tooltip that then
   * stays visibly stuck open next to a freshly-clicked icon reads as a bug,
   * not a hint, for a rail whose icons are self-explanatory after the
   * first hover anyway. */
  hoverOnly?: boolean
}

const GAP = 8

const ARROW_CLASSES: Record<TooltipPlacement, string> = {
  top: 'absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink-900',
  right: 'absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-ink-900',
}

// The one shared "dark caption bubble" hover tooltip — a small rounded-lg
// bg-ink-900 label with a tiny arrow, fading in above (or beside, for a
// vertical rail) its trigger. Portaled to document.body and positioned from
// a measured trigger rect (same FloatingMenu recipe, see that component's
// own doc) rather than a plain CSS-hover sibling — this used to be a
// `group-hover` absolute child, which read fine everywhere it was tried
// until one landed inside a side drawer's own scrollable body —
// `overflow-y-auto` there clips anything positioned near its own edge
// regardless of z-index, the exact bug FloatingMenu already exists to work
// around for kebab menus. Every InfoTooltip inside a drawer (there are
// several) gets the fix for free from this one change.
export default function Tooltip({
  label,
  children,
  placement = 'top',
  className = '',
  bubbleClassName = '',
  wide = false,
  hoverOnly = false,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const entered = useEnterTransition(open)

  useLayoutEffect(() => {
    if (!open) return
    function measure() {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    // capture:true — same reasoning as FloatingMenu's own doc: catches an
    // inner scrollable ancestor's own scroll (e.g. this drawer body), not
    // only the window's, so the bubble tracks its trigger instead of
    // drifting out of place.
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open])

  const show = () => setOpen(true)
  const hide = () => {
    setOpen(false)
    setRect(null)
  }

  const style: React.CSSProperties = rect
    ? placement === 'top'
      ? { position: 'fixed', left: rect.left + rect.width / 2, top: rect.top - GAP, transform: 'translate(-50%, -100%)' }
      : { position: 'fixed', left: rect.left + rect.width + GAP, top: rect.top + rect.height / 2, transform: 'translate(0, -50%)' }
    : {}

  return (
    <span
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={hoverOnly ? undefined : show}
      onBlur={hoverOnly ? undefined : hide}
    >
      {children}
      {open &&
        rect &&
        createPortal(
          <span
            role="tooltip"
            style={{ ...style, zIndex: 80 }}
            className={`pointer-events-none rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white shadow-md transition-[opacity,transform] duration-150 ease-out ${
              wide ? 'w-64 whitespace-normal text-left' : 'whitespace-nowrap'
            } ${entered ? 'opacity-100' : 'opacity-0'} ${bubbleClassName}`}
          >
            {label}
            <span className={ARROW_CLASSES[placement]} />
          </span>,
          document.body
        )}
    </span>
  )
}

export interface InfoTooltipProps {
  label: string
  placement?: TooltipPlacement
  className?: string
}

// A small "i" trigger for a piece of context that used to live as a
// permanent caption underneath whatever it was explaining — several drawers
// had accumulated one of these (a note on when sending actually happens, a
// CSV column requirement, a disclaimer about a stub integration), each
// quietly claiming its own row of vertical space for something only worth
// reading once. One glyph, always in the same visual slot next to whatever
// it clarifies, keeps the explanation available without keeping it on
// screen — `wide` on the underlying Tooltip since these are real sentences,
// not one-word labels. Focusable (not just hoverable), so the same
// touch-and-keyboard-friendly reveal every other Tooltip in this app gets.
export function InfoTooltip({ label, placement = 'top', className = '' }: InfoTooltipProps) {
  return (
    <Tooltip label={label} placement={placement} wide className={className}>
      <span
        tabIndex={0}
        role="button"
        aria-label={label}
        className="flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full text-icon-gray outline-none transition hover:text-ink-900 focus-visible:text-ink-900"
      >
        <InfoIcon className="h-full w-full" />
      </span>
    </Tooltip>
  )
}
