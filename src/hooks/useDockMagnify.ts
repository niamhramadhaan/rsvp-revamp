import { useRef, type MouseEvent as ReactMouseEvent } from 'react'

// The macOS-dock "hover to magnify" effect (adapted from a shared
// FloatingDock reference — the same behavior, hand-rolled instead of
// pulled in via framer-motion, which isn't a dependency anywhere in this
// app) for SeatMapCanvas's own component-library dock. Direct DOM style
// mutation on every mousemove, not React state — the same call GuestDock's
// own applyDropHighlight already makes (see its doc): re-rendering N
// buttons every pointermove frame just to change a transform would be
// real, felt cost for zero benefit, since nothing else about those
// buttons needs to re-render along with it. A plain CSS `transition` on
// each button is what turns these discrete per-event updates into a
// smooth glide, with no animation loop of our own needed.
const INFLUENCE_PX = 70
const MAX_SCALE = 1.35
// How far an item lifts (translateY, px) at full magnification — scaled by
// the same 0..1 falloff the size itself uses, so a fully-magnified item
// rises the most and the effect fades to 0 lift exactly where it fades to
// scale 1.
const MAX_LIFT_PX = 10

export function useDockMagnify() {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  function setItemRef(index: number) {
    return (el: HTMLButtonElement | null) => {
      itemRefs.current[index] = el
    }
  }

  function handleMouseMove(e: ReactMouseEvent<HTMLDivElement>) {
    const mouseX = e.clientX
    for (const el of itemRefs.current) {
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const distance = Math.abs(mouseX - (rect.left + rect.width / 2))
      // Cosine falloff (not linear) — the same "eases in, eases out" curve
      // every transition in this app already uses, just applied to a
      // continuous mouse-distance input instead of a fixed duration.
      const t = distance < INFLUENCE_PX ? Math.cos((distance / INFLUENCE_PX) * (Math.PI / 2)) : 0
      const scale = 1 + (MAX_SCALE - 1) * t
      const lift = MAX_LIFT_PX * t
      el.style.transform = `translateY(-${lift}px) scale(${scale})`
    }
  }

  function handleMouseLeave() {
    for (const el of itemRefs.current) {
      if (el) el.style.transform = ''
    }
  }

  return { setItemRef, handleMouseMove, handleMouseLeave }
}
