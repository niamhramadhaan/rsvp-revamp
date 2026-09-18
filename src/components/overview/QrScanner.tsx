import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

export interface QrScannerProps {
  /** Keep the camera stream open (true) or paused (false) — toggled by the
   * parent while a result card is on screen, so the feed doesn't keep
   * decoding (and re-triggering) the same ticket the staff is still
   * reading. Pausing/resuming an already-running stream is cheap; this
   * never tears the camera down for that. */
  active: boolean
  onDecode: (text: string) => void
}

type Status = 'starting' | 'running' | 'error'

// Real camera scanning for the check-in flow — guests' invitation ticket
// carries a QR (see plan.md: it encodes the guest's `token` alone), and
// TicketCard now also renders that same token as a Code128 barcode, so
// `formatsToSupport` covers both — a staff member scans whichever the
// guest happens to have in front of them, QR or barcode, with the exact
// same camera. Wraps html5-qrcode (the library plan.md already confirmed
// for this) in this app's own scan-frame chrome; the library only owns the
// raw <video> it injects into the container div.
export default function QrScanner({ active, onDecode }: QrScannerProps) {
  const containerId = `qr-reader-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const onDecodeRef = useRef(onDecode)
  onDecodeRef.current = onDecode

  const [status, setStatus] = useState<Status>('starting')
  const [errorMessage, setErrorMessage] = useState('')

  // Starts the camera exactly once per mount — restarting it every time
  // `active` toggles would re-request camera permission/renegotiate the
  // stream on every single guest, which is slow and flickery. The effect
  // below handles pause/resume instead, against this same instance.
  useEffect(() => {
    let cancelled = false
    const scanner = new Html5Qrcode(containerId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128],
      verbose: false,
    })
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: { ideal: 'environment' } },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        (decodedText) => onDecodeRef.current(decodedText),
        () => {
          // Called on every frame with no code found yet — the normal,
          // constant state while a guest's ticket isn't in frame, not an
          // error. Intentionally silent.
        }
      )
      .then(() => {
        if (cancelled) return
        setStatus('running')
        if (!active) scanner.pause(true)
      })
      .catch((err: { name?: string }) => {
        if (cancelled) return
        setStatus('error')
        setErrorMessage(
          err?.name === 'NotAllowedError'
            ? 'Camera access was denied — allow it in your browser/device settings, or use the search below.'
            : "Couldn't open a camera on this device — use the search below instead."
        )
      })

    return () => {
      cancelled = true
      scannerRef.current = null
      if (scanner.isScanning) {
        scanner.stop().catch(() => {}).finally(() => scanner.clear())
      } else {
        scanner.clear()
      }
    }
    // Deliberately mount-once (containerId is stable per mount) — `active`
    // is handled by the pause/resume effect below, not by restarting this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId])

  useEffect(() => {
    const scanner = scannerRef.current
    if (!scanner || status !== 'running') return
    if (active) scanner.resume()
    else scanner.pause(true)
  }, [active, status])

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-900 [&_video]:h-full [&_video]:w-full [&_video]:object-cover">
      <div id={containerId} className="h-full w-full" />

      {status === 'starting' && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/70">
          Opening camera…
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/80">
          {errorMessage}
        </div>
      )}

      {status === 'running' && (
        <>
          {/* Gate-arch scan frame — now a fixed-size arch centered inside
              the full-bleed camera stage (rather than stretching to fill
              it), so a tall viewfinder still reads as "a gate to walk
              through," not a stretched oval. Same corner-bracket-plus-
              scanline chrome as before, just recentered; only
              accent-cyan-light/ink-900 (already this frame's own colors) —
              no new palette. */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-64 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-t-[50%] rounded-b-2xl border-2 border-white/60">
            <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 rounded-bl-2xl border-b-4 border-l-4 border-accent-cyan-light" />
            <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-br-2xl border-b-4 border-r-4 border-accent-cyan-light" />
            <div className="absolute inset-0" style={{ animation: 'qr-scanline 2200ms ease-in-out infinite' }}>
              <span className="absolute inset-x-0 top-0 h-0.5 bg-accent-cyan-light/90 shadow-[0_0_8px_2px_rgba(84,180,240,0.7)]" />
            </div>
          </div>
          <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[168px] rounded-full border border-accent-cyan-light/50 bg-ink-900/90 px-3 py-1 font-display text-[10px] font-bold uppercase tracking-[0.18em] text-accent-cyan-light">
            Gate · Scanning
          </span>

          {!active && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-900/70 text-sm font-medium text-white">
              Paused
            </div>
          )}

          <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-xs font-medium text-white/80">
            Point the camera at the guest's ticket — QR or barcode
          </p>
        </>
      )}
    </div>
  )
}
