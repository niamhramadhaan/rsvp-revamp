import { useEffect, useRef, useState, type RefObject } from 'react'

export interface ScrollEdges {
  atTop: boolean
  atBottom: boolean
}

// Tracks whether a scrollable element is at its top/bottom edge, so a
// container can fade its own content at whichever edge still has more to
// reveal — a softer "there's more below" cue than a visible scrollbar.
// `deps` re-measures whenever content that could change scrollHeight
// changes (e.g. a filtered list getting shorter/taller).
export function useScrollEdges<T extends HTMLElement>(deps: unknown[] = []): [RefObject<T | null>, ScrollEdges] {
  const ref = useRef<T | null>(null)
  const [edges, setEdges] = useState<ScrollEdges>({ atTop: true, atBottom: true })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function measure() {
      if (!el) return
      const { scrollTop, scrollHeight, clientHeight } = el
      setEdges({
        atTop: scrollTop <= 1,
        atBottom: scrollTop + clientHeight >= scrollHeight - 1,
      })
    }

    measure()
    el.addEventListener('scroll', measure, { passive: true })
    return () => el.removeEventListener('scroll', measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return [ref, edges]
}

// Builds a top/bottom fade mask for whichever edges still have more content
// past them — undefined (no mask, fully opaque) once both edges are reached,
// e.g. a list short enough to not need scrolling at all.
export function edgeFadeMask({ atTop, atBottom }: ScrollEdges, size = 28): string | undefined {
  if (atTop && atBottom) return undefined
  const top = atTop ? 'black 0' : `transparent 0, black ${size}px`
  const bottom = atBottom ? 'black 100%' : `black calc(100% - ${size}px), transparent 100%`
  return `linear-gradient(to bottom, ${top}, ${bottom})`
}
