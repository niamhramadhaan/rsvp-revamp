import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'

export interface UseSwipeToDismissOptions {
  /** Called once a release counts as a dismiss (past the distance or
   * velocity threshold) — the caller is responsible for actually closing
   * (flipping its own `open` state), same as any other close trigger. */
  onDismiss: () => void
  /** Downward drag distance (px) that counts as a dismiss on its own,
   * regardless of how fast it happened. */
  distanceThreshold?: number
  /** Downward velocity (px/ms) that counts as a dismiss even short of the
   * distance threshold — a quick flick dismisses without needing to travel
   * as far as a slow, deliberate drag would. */
  velocityThreshold?: number
}

// Drag-to-dismiss for a bottom sheet, via Pointer Events (one code path for
// touch, mouse, and pen alike) — driving the visual transform by mutating
// the sheet element's own style directly through `sheetRef`, not through
// React state. That distinction is the whole fix for a real bug this had
// before: every pointermove used to call setState, which re-rendered the
// component on every single pixel of movement — on a phone, that's easily
// slow enough to drop frames, and dropped frames don't just look laggy,
// they also corrupt the release's own velocity read (fewer, larger gaps
// between the samples this actually receives), which is exactly what made
// a fast, deliberate swipe-down sometimes fail to register as a dismiss at
// all. Bypassing React for the high-frequency part removes both problems
// at once — rAF-batches the actual style writes (never more than one per
// frame), while the raw pointer samples (position + timestamp) are still
// recorded synchronously on every event, so the velocity math reads real
// data regardless of how the visuals are throttled.
export function useSwipeToDismiss({ onDismiss, distanceThreshold = 100, velocityThreshold = 0.5 }: UseSwipeToDismissOptions) {
  // Typed to the more specific HTMLDivElement (not the generic HTMLElement)
  // so this same ref object structurally satisfies both call sites this
  // hook has today — a <div> (EventSwitcher's own sheet) and an <aside>
  // (DrawerPanel's) — since RefObject's `current` is read-only, a ref typed
  // for a more specific element is assignable wherever a less specific one
  // is expected, but not the other way around.
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const pointerId = useRef<number | null>(null)
  const startY = useRef(0)
  const startTime = useRef(0)
  const lastY = useRef(0)
  const lastTime = useRef(0)
  const pendingY = useRef(0)
  const rafId = useRef<number | null>(null)

  // withTransition=false is the live-drag state (tracks the finger 1:1, no
  // easing lag); true is used exactly once per gesture, on release, so the
  // final snap-back-to-0 or continue-off-screen motion actually animates
  // instead of jumping. An empty string (not a literal transition value)
  // removes the inline override entirely, letting the element's own
  // stylesheet-defined `transition-transform duration-300` (Tailwind
  // classes, unaffected by any of this) take over — which is also what a
  // fresh `resetDrag()` needs, so normal open/close transitions are never
  // left fighting a stale inline one from the last drag.
  const applyTransform = useCallback((y: number, withTransition: boolean) => {
    const el = sheetRef.current
    if (!el) return
    el.style.transition = withTransition ? '' : 'none'
    el.style.transform = y === 0 ? '' : `translateY(${y}px)`
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (pointerId.current !== null) return // a drag is already in progress
      pointerId.current = e.pointerId
      startY.current = e.clientY
      startTime.current = performance.now()
      lastY.current = e.clientY
      lastTime.current = startTime.current
      applyTransform(0, false)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [applyTransform]
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (pointerId.current !== e.pointerId) return
      lastY.current = e.clientY
      lastTime.current = performance.now()
      // Only downward drag moves the sheet — it's already resting at its
      // open position, so dragging up has nowhere further to go; clamping
      // at 0 avoids it floating upward past that.
      pendingY.current = Math.max(0, e.clientY - startY.current)
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          rafId.current = null
          applyTransform(pendingY.current, false)
        })
      }
    },
    [applyTransform]
  )

  const release = useCallback(
    (e: ReactPointerEvent) => {
      if (pointerId.current !== e.pointerId) return
      pointerId.current = null
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }

      const elapsedMs = Math.max(1, lastTime.current - startTime.current)
      const velocity = (lastY.current - startY.current) / elapsedMs // px/ms, positive = downward
      const draggedFar = lastY.current - startY.current > distanceThreshold
      const flickedFast = velocity > velocityThreshold

      if (draggedFar || flickedFast) {
        // Keep sliding in the same direction the finger was already
        // moving, clear off whatever's currently visible — a value based
        // on the drag distance alone could leave the sheet visually stuck
        // partway if released before reaching that distance but still
        // fast enough to count via velocity.
        applyTransform(typeof window === 'undefined' ? 1000 : window.innerHeight, true)
        onDismiss()
      } else {
        applyTransform(0, true)
      }
    },
    [distanceThreshold, velocityThreshold, onDismiss, applyTransform]
  )

  // Call when the sheet is opening fresh — clears any transform/transition
  // left over from how the last drag ended, so a reopen always starts from
  // a clean slate governed purely by the component's own className-driven
  // open/close transition.
  const resetDrag = useCallback(() => {
    pointerId.current = null
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
    const el = sheetRef.current
    if (el) {
      el.style.transition = ''
      el.style.transform = ''
    }
  }, [])

  return {
    sheetRef,
    resetDrag,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: release,
      onPointerCancel: release,
    },
  }
}
