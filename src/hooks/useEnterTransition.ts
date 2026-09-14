import { useEffect, useState } from 'react'

// `entered` lags one frame behind `open` so the browser paints the "closed"
// position first, before flipping to "open" — otherwise React can commit
// both states in the same paint and the transition never plays. Shared by
// Modal/Drawer and every popover (UserIdCardModal, EventSwitcher) that
// needs this same enter animation.
export function useEnterTransition(open: boolean): boolean {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(open))
    return () => cancelAnimationFrame(raf)
  }, [open])

  return entered
}
