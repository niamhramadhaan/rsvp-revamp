import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import Avatar, { genConfig } from 'react-nice-avatar'
import { useEnterTransition } from '../../hooks/useEnterTransition'
import { CloseIcon, DownloadIcon } from '../icons/UiIcons'
import type { Event, Guest } from '../../data/types'

export interface GuestPrintCardProps {
  open: boolean
  onClose: () => void
  guest: Guest | null
  event: Event | null
  seatLabel: string | null
}

// One label:value row for Role/Org below — a full-width row, not a fixed
// column, so a long job title or company name wraps onto a second line
// instead of truncating or (the actual bug an earlier pass had) overflowing
// the card entirely: a 3-equal-column grid sizes each column to a fixed
// share of the card's own ~320px width regardless of what's in it, and
// "Chief Executive Officer" in a ~100px column has nowhere to go but out.
// min-w-0 is load-bearing on the value span — a flex item's default
// min-width is `auto` (sized to its own content's min-content width), which
// silently defeats wrapping/truncation alike until it's reset to 0.
function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-full items-baseline justify-between gap-3">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-900/50">{label}</span>
      <span className="min-w-0 flex-1 text-right text-sm font-semibold text-ink-900">{value}</span>
    </div>
  )
}

// The card itself — same structural DNA as UserIdCardModal (a framed photo,
// a nameplate below it, info below a divider), styled for paper instead of
// glass per request: a warm, grained paper texture (the same
// feTurbulence-noise-as-a-data-URI trick GradientBackground already uses,
// just tinted cream and blended `multiply` instead of that component's
// blue/cyan `overlay`) rather than a translucent blue wash, and bolder
// dashed "stroke" dividers instead of the hairline one, matching the
// perforated-ticket language this app already uses elsewhere (TicketStub's
// own dashed seams).
//
// The photo frame carries the same "foil card" interaction UserIdCardModal
// has — the whole card tilts toward the cursor and a metallic sheen glides
// across the photo (same direct-DOM-transform technique: style mutation on
// pointermove, not React state). Screen-only: the sheen is `print:hidden`
// and the tilt is neutralized in print (`print:transform-none`), so the
// printed badge stays flat and clean.
//
// The photo is always this guest's own: uploaded imageUrl wins, otherwise
// their pinned/random avatarConfig, otherwise a name-derived generated face
// (the same precedence GuestAvatar uses) — never a generic icon.
//
// Layout reimagined from an earlier pass's fragile 3-equal-column stat row
// (Role/Seat/Org side by side): Seat is the one thing staff actually need
// at a glance, so it gets its own prominent badge; Role and Org each get a
// full-width row instead, since either one can genuinely run long (a job
// title, a company name) and a fixed column has no good answer for that.
function GuestPrintCardFace({ guest, event, seatLabel }: { guest: Guest; event: Event | null; seatLabel: string | null }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const shineRef = useRef<HTMLDivElement>(null)

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const card = cardRef.current
    if (!card || e.pointerType === 'touch') return
    const rect = card.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    card.style.transform = `perspective(900px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg)`
    if (shineRef.current) shineRef.current.style.backgroundPosition = `${50 + px * 60}% ${50 + py * 60}%`
  }

  function handlePointerLeave() {
    if (cardRef.current) cardRef.current.style.transform = ''
    if (shineRef.current) shineRef.current.style.backgroundPosition = '50% 50%'
  }

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative w-[320px] overflow-hidden rounded-[28px] border border-black/10 p-4 shadow-xl transition-transform duration-300 ease-out [transform-style:preserve-3d] print:transform-none"
      style={{
        backgroundColor: '#faf6ef',
        backgroundImage:
          'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'120\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.35\'/%3E%3C/svg%3E")',
        backgroundSize: '120px 120px',
        backgroundBlendMode: 'multiply',
      }}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-black/10 bg-black/5">
        {guest.imageUrl ? (
          <img src={guest.imageUrl} alt={guest.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Avatar shape="square" {...(guest.avatarConfig ?? genConfig(guest.name))} className="absolute inset-0 h-full w-full" />
        )}
        {/* The metallic sheen — same foil recipe UserIdCardModal's own photo
            frame uses: a repeating diagonal band blended `overlay` so it
            reads as light glinting across the photo, not a tint on top of
            it. Screen-only (print:hidden) — the printed badge stays flat. */}
        <div
          ref={shineRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 print:hidden"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.02) 6%, rgba(255,255,255,0.28) 12%, rgba(0,0,0,0.08) 20%, rgba(255,255,255,0.35) 28%)',
            backgroundSize: '250% 250%',
            backgroundPosition: '50% 50%',
            mixBlendMode: 'overlay',
          }}
        />
      </div>

      <div className="mt-4 flex flex-col items-center gap-3 text-center">
        <div className="flex min-w-0 flex-col items-center gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/gamefinity icon.png" alt="" className="h-5 w-5 shrink-0 rounded-md object-contain" />
            <p className="min-w-0 truncate font-display text-lg font-bold text-ink-900">{guest.name}</p>
          </div>
          {event && <p className="min-w-0 truncate text-xs text-ink-900/60">{event.name}</p>}
        </div>

        {/* The "stroke divider" — a bolder dashed rule, not the hairline
            `h-px bg-black/10` UserIdCardModal uses, so it reads as a
            deliberate perforated seam on paper rather than a faint digital
            hairline. */}
        <div className="h-0 w-full border-t-2 border-dashed border-black/20" />

        <div className="flex items-center gap-2 rounded-full bg-accent-700/10 px-4 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-accent-700/70">Seat</span>
          <span className="font-display text-base font-bold text-accent-700">{seatLabel ?? 'Unassigned'}</span>
        </div>

        <div className="h-0 w-full border-t-2 border-dashed border-black/20" />

        <div className="flex w-full flex-col gap-2 pb-1">
          <DetailLine label="Role" value={guest.role || '—'} />
          <DetailLine label="Org" value={guest.organization || '—'} />
        </div>
      </div>
    </div>
  )
}

// Opened by CheckInResultCard's own "Print card" button (see
// CheckedInCelebration) once a guest is actually checked in — a portal
// (same reasoning as Modal's own doc: this needs to escape any transformed
// ancestor to truly center over the viewport) that auto-triggers
// `window.print()` the moment it mounts. There's no PDF library anywhere in
// this app (a real dependency this project doesn't otherwise need) — the
// browser's own print dialog's "Save as PDF" destination is what actually
// produces the PDF file here, the same zero-new-dependency approach this
// app's own CSV export already takes for "generate a file" elsewhere.
export default function GuestPrintCard({ open, onClose, guest, event, seatLabel }: GuestPrintCardProps) {
  const entered = useEnterTransition(open)

  useEffect(() => {
    if (!open || !guest) return
    // One frame's grace so the card is fully painted before the print
    // dialog's own preview snapshots it.
    const id = window.setTimeout(() => window.print(), 150)
    return () => window.clearTimeout(id)
  }, [open, guest])

  if (!guest) return null

  return createPortal(
    <div
      inert={!open}
      onClick={onClose}
      className={`fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/50 p-4 backdrop-blur-sm transition-opacity duration-200 ease-out print:hidden ${
        entered ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-4">
        <div className="print-card-root">
          <GuestPrintCardFace guest={guest} event={event} seatLabel={seatLabel} />
        </div>

        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-white/90 px-4 text-sm font-semibold text-ink-900 transition active:scale-[0.97] hover:bg-white"
          >
            <CloseIcon className="h-4 w-4" />
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-accent-700 px-4 text-sm font-semibold text-white transition active:scale-[0.97] hover:brightness-110"
          >
            <DownloadIcon className="h-4 w-4" />
            Print / Save as PDF
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
