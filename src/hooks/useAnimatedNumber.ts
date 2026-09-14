import { useEffect, useRef, useState } from 'react'

// Eases a displayed number toward `target` over `duration`ms instead of
// snapping straight to it — KpiTile's own "count up" read whenever a stat
// changes. Runs via rAF (cancelled cleanly on unmount/re-target, no
// dangling timers) rather than a CSS transition: there's no CSS property
// that interpolates a plain text node, only actual DOM/SVG attributes do.
// Skips the animation on first mount — nothing real to count up FROM yet,
// the tile should just show its true starting value immediately.
export function useAnimatedNumber(target: number, duration = 700): number {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const mountedRef = useRef(false)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      fromRef.current = target
      setDisplay(target)
      return
    }

    const from = fromRef.current
    if (from === target) return
    const start = performance.now()

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration)
      // easeOutCubic — fast start, gentle settle, same shape as every
      // other `ease-out` transition already used across this app.
      const eased = 1 - (1 - t) ** 3
      setDisplay(Math.round(from + (target - from) * eased))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration])

  return display
}
