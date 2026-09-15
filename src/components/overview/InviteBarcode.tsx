import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export interface InviteBarcodeProps {
  value: string
  ariaLabel?: string
  className?: string
}

// Shared Code128 renderer for a guest's own invite token — used both on
// GuestProfileDrawer's own invitation card and SendInvitationsDrawer's
// "what goes out" preview, since both need the exact same barcode a guest's
// invite message actually embeds.
export default function InviteBarcode({ value, ariaLabel, className = '' }: InviteBarcodeProps) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current) return
    JsBarcode(ref.current, value, {
      format: 'CODE128',
      displayValue: false,
      background: 'transparent',
      lineColor: '#101e33',
      width: 1.6,
      height: 40,
      margin: 6,
    })
  }, [value])

  return <svg ref={ref} role="img" aria-label={ariaLabel ?? `Barcode ${value}`} className={className} />
}
