import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export interface UseSwipeToConfirmOptions {
  /** Fires once, the instant a release counts as a completed swipe. */
  onConfirm: () => void
  /** Fraction (0-1) of the handle's own available travel that counts as a
   * completed swipe on release. */
  threshold?: number
}

// Horizontal drag-to-confirm — the "swipe to check in" gesture. Same
// direct-DOM-transform-during-drag technique useSwipeToDismiss already uses
// (bypass React state for the high-frequency part — see that hook's own
// doc for the dropped-frame/velocity-corruption bug this avoids), adapted
// for a bounded horizontal track instead of an unbounded vertical dismiss:
// the handle's travel is clamped to [0, track width − handle width], and
// reaching `threshold` of that travel on release locks it to the end and
// fires onConfirm; falling short springs it back to the start.
export function useSwipeToConfirm({ onConfirm, threshold = 0.75 }: UseSwipeToConfirmOptions) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<HTMLDivElement | null>(null)
  // Optional — a caller can render a "fill" bar behind the handle that
  // grows with drag progress (see CheckInResultCard's own ReadyCard) for
  // live feedback on how close a swipe is to completing; nothing reads
  // this ref if the caller never assigns it.
  const fillRef = useRef<HTMLDivElement | null>(null)
  const pointerId = useRef<number | null>(null)
  const startX = useRef(0)
  const maxTravel = useRef(0)
  const pendingX = useRef(0)
  const rafId = useRef<number | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [dragging, setDragging] = useState(false)

  const applyX = useCallback((x: number, withTransition: boolean) => {
    // withTransition=false is the live-drag state (tracks the finger 1:1,
    // no easing lag); true is used exactly once per gesture, on release, so
    // the final lock-to-end or spring-back-to-start motion actually
    // animates — same split useSwipeToDismiss's own applyTransform uses,
    // for the same reason: an inline `transition` override always wins
    // over the handle's own class-driven one regardless of Tailwind's
    // generated-CSS ordering, which is what makes toggling it here safe
    // (unlike trying to swap Tailwind classes for the same effect).
    const handle = handleRef.current
    if (handle) {
      handle.style.transition = withTransition ? '' : 'none'
      handle.style.transform = x === 0 ? '' : `translateX(${x}px)`
    }
    const fill = fillRef.current
    if (fill && maxTravel.current > 0) {
      fill.style.transition = withTransition ? '' : 'none'
      fill.style.transform = `scaleX(${Math.min(1, x / maxTravel.current)})`
    }
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (pointerId.current !== null || confirmed) return
      const track = trackRef.current
      const handle = handleRef.current
      if (!track || !handle) return
      pointerId.current = e.pointerId
      startX.current = e.clientX
      maxTravel.current = Math.max(0, track.getBoundingClientRect().width - handle.getBoundingClientRect().width)
      setDragging(true)
      applyX(0, false)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [applyX, confirmed]
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (pointerId.current !== e.pointerId) return
      const raw = e.clientX - startX.current
      pendingX.current = Math.min(Math.max(0, raw), maxTravel.current)
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          rafId.current = null
          applyX(pendingX.current, false)
        })
      }
    },
    [applyX]
  )

  const release = useCallback(
    (e: ReactPointerEvent) => {
      if (pointerId.current !== e.pointerId) return
      pointerId.current = null
      setDragging(false)
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }
      const reachedThreshold = maxTravel.current > 0 && pendingX.current / maxTravel.current >= threshold
      if (reachedThreshold) {
        applyX(maxTravel.current, true)
        setConfirmed(true)
        onConfirm()
      } else {
        applyX(0, true)
      }
    },
    [threshold, onConfirm, applyX]
  )

  return {
    trackRef,
    handleRef,
    fillRef,
    confirmed,
    /** True for as long as a drag is actively in progress — lets a caller
     * (e.g. suppress the handle's own hover/press scale while genuinely
     * dragging vs. just resting). */
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: release,
      onPointerCancel: release,
    },
  }
}
