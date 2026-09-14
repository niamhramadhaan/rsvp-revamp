import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { Guest, Seat } from '../../data/types'
import { useSwipeToConfirm } from '../../hooks/useSwipeToConfirm'
import { QrCheckIcon, ChairIcon, ClockIcon, AlertTriangleIcon, ChevronRightIcon, DownloadIcon } from '../icons/UiIcons'
import GuestAvatar from './GuestAvatar'

// The check-in flow's single result state, produced by CheckInDrawer's
// resolver — a decoded QR (QrScanner, reading the guest's invitation-email
// ticket) or an exact/unambiguous text-search match both land here the same
// way. There's no separate "walk-in" resolution any more — a guest already
// on the roster checks in the same way whether or not their invite happened
// to go out yet (see CheckInDrawer's own classifyGuest doc); `checked_in`'s
// own `wasWalkIn` flag still notes it afterward, purely informational, no
// discretionary gate attached to it.
export type CheckInResolution =
  | { kind: 'not_found'; query: string }
  | { kind: 'ready'; guest: Guest }
  | { kind: 'already_checked_in'; guest: Guest }
  | { kind: 'no_seat'; guest: Guest }
  | { kind: 'checked_in'; guest: Guest; wasWalkIn: boolean }

export interface CheckInResultCardProps {
  resolution: CheckInResolution
  emptySeats: Seat[]
  /** The resolved guest's own seat label (e.g. "REG-12"), already looked up
   * by CheckInDrawer — null when they have none. Only used by the 'ready' and
   * 'checked_in' cards, to render the boarding-pass-style seat stub. */
  seatLabel: string | null
  onConfirm: (guest: Guest) => void
  onAssignSeat: (guest: Guest, seatId: string) => void
  onUndo: (guest: Guest) => void
  /** Opens GuestPrintCard for this guest — CheckedInCelebration's own
   * button, once they're actually checked in. */
  onPrintCard: (guest: Guest) => void
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// Small pop-in badge shell shared by every state's icon — the one motion
// beat every card gets regardless of outcome, so a state always announces
// itself with the same "something just happened" gesture before its
// state-specific flourish (shake/bob/ring/draw) layers on top.
function IconBadge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 ${className}`}
      style={{ animation: 'checkin-pop 420ms cubic-bezier(0.34,1.56,0.64,1) both' }}
    >
      {children}
    </span>
  )
}

// The 'ready' card's own badge — the guest's actual identity (their real
// avatar, same GuestAvatar every other card in the app uses) instead of a
// generic ticket icon, since this card exists specifically to confirm *this*
// person. The small circular overlay (same "status icon corner badge"
// language RecentActivityFeed uses) keeps the ticket/QR affordance without
// it needing to be the badge's whole identity.
function PersonBadge({ guest }: { guest: Guest }) {
  return (
    <span
      className="relative flex h-16 w-16 shrink-0 items-center justify-center"
      style={{ animation: 'checkin-pop 420ms cubic-bezier(0.34,1.56,0.64,1) both' }}
    >
      <GuestAvatar name={guest.name} imageUrl={guest.imageUrl} avatarConfig={guest.avatarConfig} sizeClassName="h-16 w-16" />
      <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-accent-700 bg-white text-accent-700">
        <QrCheckIcon className="h-3.5 w-3.5" />
      </span>
    </span>
  )
}

export default function CheckInResultCard({
  resolution,
  emptySeats,
  seatLabel,
  onConfirm,
  onAssignSeat,
  onUndo,
  onPrintCard,
}: CheckInResultCardProps) {
  if (resolution.kind === 'not_found') {
    return (
      <div
        key={`not-found-${resolution.query}`}
        className="rounded-2xl border border-status-declined/20 bg-status-declined/10 p-6 text-status-declined"
      >
        <div className="flex items-center gap-4">
          <IconBadge className="bg-status-declined/10">
            <AlertTriangleIcon className="h-7 w-7" style={{ animation: 'checkin-shake 500ms ease-out 420ms both' }} />
          </IconBadge>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold">No match for &ldquo;{resolution.query}&rdquo;</p>
            <p className="mt-0.5 text-sm text-status-declined/80">
              Double-check the code, or search the guest's name above — it searches as you type.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (resolution.kind === 'checked_in') {
    return (
      <CheckedInCelebration
        guest={resolution.guest}
        wasWalkIn={resolution.wasWalkIn}
        seatLabel={seatLabel}
        onUndo={onUndo}
        onPrintCard={onPrintCard}
      />
    )
  }

  if (resolution.kind === 'already_checked_in') {
    const { guest } = resolution
    // Neutral ink, not status-pending — this used to share the same amber
    // as walk_in below, but a duplicate scan is the one state here with
    // nothing to decide (no discretionary call, no waiting), so it reads
    // calmer than every other outcome instead of borrowing an urgency color
    // it doesn't need. Same "neutral, not a status hue" ink-900/8 wash
    // StatTiles' own Invited tile uses for the same reason.
    return (
      <div
        key={`dup-${guest.id}`}
        className="rounded-2xl border border-ink-900/10 bg-ink-900/5 p-6 text-ink-900"
      >
        <div className="flex flex-wrap items-center gap-4">
          <IconBadge className="bg-ink-900/8">
            <ClockIcon className="h-7 w-7" style={{ animation: 'checkin-shake 500ms ease-out 420ms both' }} />
          </IconBadge>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-ink-900">{guest.name} is already checked in</p>
            <p className="mt-0.5 text-sm text-muted">
              Checked in at {guest.checkedInAt ? formatTime(guest.checkedInAt) : '—'}
              {guest.checkedInBy ? ` by ${guest.checkedInBy}` : ''}. Not letting them in twice.
            </p>
            {/* -mx-2 -my-1 + matching px/py: grows the actual tap target
                past the visible underlined text (a link's rendered text is
                usually well under 44px tall) without changing how it looks. */}
            <button
              type="button"
              onClick={() => onUndo(guest)}
              className="-mx-2 -my-1 mt-1 inline-block px-2 py-2 text-xs font-semibold text-ink-900 underline decoration-ink-900/25 underline-offset-2 transition hover:decoration-ink-900/60 active:scale-[0.97]"
            >
              Not them? Undo this check-in
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (resolution.kind === 'no_seat') {
    const { guest } = resolution
    const preview = emptySeats.slice(0, 24)
    return (
      <div
        key={`no-seat-${guest.id}`}
        className="rounded-2xl border border-accent-cyan/25 bg-accent-cyan/10 p-6 text-accent-700"
      >
        <div className="flex flex-wrap items-center gap-4">
          <IconBadge className="bg-accent-cyan/10">
            <ChairIcon className="h-7 w-7" style={{ animation: 'checkin-bob 900ms ease-in-out 2', animationDelay: '380ms' }} />
          </IconBadge>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-ink-900">{guest.name} has no seat yet</p>
            <p className="mt-0.5 text-sm text-accent-700/90">
              Assign any open seat to let them straight through — this doesn't touch the seat map layout.
            </p>
          </div>
        </div>

        {preview.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {preview.map((seat) => (
              <button
                key={seat.id}
                type="button"
                onClick={() => onAssignSeat(guest, seat.id)}
                className="min-h-[44px] rounded-lg bg-white/70 px-3.5 text-sm font-semibold text-ink-900 transition active:scale-[0.97] hover:bg-white"
              >
                {seat.label}
              </button>
            ))}
            {emptySeats.length > preview.length && (
              <span className="self-center px-1 text-xs text-accent-700/70">+{emptySeats.length - preview.length} more open</span>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm font-medium text-accent-700/90">No open seats left — check the seat map.</p>
        )}
      </div>
    )
  }

  // resolution.kind === 'ready'
  return <ReadyCard guest={resolution.guest} seatLabel={seatLabel} onConfirm={onConfirm} />
}

const CONFIRM_DELAY_MS = 3000

// The swipe-to-check-in flow: swipe the handle across → a determinate 3s
// "confirming" bar plays → only then does the real onConfirm(guest) fire
// (the actual checkInGuest write + CheckInDrawer's own resolution flip to
// `checked_in`). Local to this card, not CheckInDrawer, since it's purely a
// presentational delay in front of an otherwise-instant action — nothing
// about the check-in itself waits on it.
function ReadyCard({ guest, seatLabel, onConfirm }: { guest: Guest; seatLabel: string | null; onConfirm: (guest: Guest) => void }) {
  const [confirming, setConfirming] = useState(false)
  const { trackRef, handleRef, fillRef, dragging, handlers } = useSwipeToConfirm({ onConfirm: () => setConfirming(true) })

  useEffect(() => {
    if (!confirming) return
    const id = window.setTimeout(() => onConfirm(guest), CONFIRM_DELAY_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirming])

  return (
    <div key={`ready-${guest.id}`} className="overflow-hidden rounded-2xl bg-accent-700 text-white">
      <div className="flex flex-wrap items-center gap-4 p-6">
        <PersonBadge guest={guest} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold">{guest.name}</p>
          <p className="mt-0.5 text-sm text-white/75">{guest.organization || 'Guest'}</p>
        </div>
      </div>
      <TicketStub seatLabel={seatLabel}>
        {confirming ? (
          <div className="h-12 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full origin-left rounded-full bg-white"
              style={{ animation: `checkin-progress-fill ${CONFIRM_DELAY_MS}ms linear forwards` }}
            />
          </div>
        ) : (
          <div ref={trackRef} className="relative flex h-12 w-full items-center overflow-hidden rounded-full bg-white/20 px-1">
            {/* The fill — grows with live drag progress (fillRef, written
                directly by useSwipeToConfirm's own pointermove handler, no
                React re-render per pixel), so the track itself reads as
                "filling up" toward completion instead of just the handle
                sliding across an inert background. */}
            <div
              ref={fillRef}
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-white/25 transition-transform duration-300 ease-out"
              style={{ transform: 'scaleX(0)' }}
            />
            <p
              className={`pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold text-white/85 transition-opacity duration-200 ${
                dragging ? 'opacity-0' : 'opacity-100'
              }`}
            >
              Swipe to check in
            </p>
            {/* Solid white fill is load-bearing here, not a stray choice:
                this handle sits on the card's own accent-700 fill, where a
                transparent ghost surface would have neither contrast nor a
                legible fill. touch-none stops the browser's own scroll
                gesture from fighting the drag, same as DrawerPanel's own
                drag handle. transition-transform (eased, not instant) is
                what makes the release — lock to the end, or spring back to
                the start — read as smooth motion rather than a snap; a
                slightly bigger, lifted scale while actively dragging is the
                same "picked up" cue KpiTile's own hover tilt uses elsewhere. */}
            <div
              ref={handleRef}
              {...handlers}
              className={`relative z-10 flex h-10 w-10 shrink-0 touch-none items-center justify-center rounded-full bg-white text-accent-700 shadow-sm transition-transform duration-300 ease-out ${
                dragging ? 'scale-110 shadow-md' : ''
              }`}
            >
              <ChevronRightIcon className="h-5 w-5" />
            </div>
          </div>
        )}
      </TicketStub>
    </div>
  )
}

// The boarding-pass "stub" strip — a dashed perforation dividing the main
// card from a seat-number block, the way a real ticket's tear-off stub
// carries just the seat. Deliberately not a fake circular cutout at the
// dashed line's ends: that trick only reads right when the card sits on a
// single flat, known background color, and this card is nested inside
// translucent glass panels over a gradient page wash — a hard-coded "hole"
// color would just look like a mismatched solid disc, not a real cutout.
// A dashed rule plus a tinted stub panel gets the boarding-pass read without
// depending on what's actually behind the card.
function TicketStub({ seatLabel, children }: { seatLabel: string | null; children: ReactNode }) {
  if (!seatLabel) {
    return <div className="px-6 pb-6">{children}</div>
  }
  return (
    <div className="flex items-stretch border-t border-dashed border-white/30">
      <div className="min-w-0 flex-1 px-6 py-4">{children}</div>
      <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 border-l border-dashed border-white/30 bg-black/10 px-2 py-4 text-center">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-white/60">Seat</span>
        <span className="font-display text-lg font-bold tabular-nums">{seatLabel}</span>
      </div>
    </div>
  )
}

// The one moment this whole tab exists to deliver — an explicit checkmark
// draws itself in (stroke-dashoffset, not a hard cut) inside the popped-in
// badge, plus a one-shot confetti burst behind it. Both are finite (no
// `infinite` iteration anywhere), so this doesn't cost anything once played.
function CheckedInCelebration({
  guest,
  wasWalkIn,
  seatLabel,
  onUndo,
  onPrintCard,
}: {
  guest: Guest
  wasWalkIn: boolean
  seatLabel: string | null
  onUndo: (guest: Guest) => void
  onPrintCard: (guest: Guest) => void
}) {
  // Deterministic, not Math.random() — a fixed jitter per index still reads
  // as an organic burst (varied radius/rotation/delay per particle) without
  // an impure call inside render, and it's the same tasteful burst every
  // time rather than an occasional lucky/unlucky spread.
  const confetti = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2 + ((i * 7) % 5) * 0.08
        const distance = 46 + ((i * 11) % 7) * 4
        return {
          id: i,
          tx: Math.cos(angle) * distance,
          ty: Math.sin(angle) * distance,
          rot: ((i * 53) % 241) - 120,
          delay: 380 + ((i * 17) % 5) * 24,
          hue: i % 3,
        }
      }),
    []
  )

  const dotColor = ['bg-white', 'bg-white/70', 'bg-accent-cyan-light']
  // The celebration badge (confetti + drawn checkmark) stays exactly as
  // designed — it's the one hero moment this whole flow builds to, and a
  // guest photo/avatar there would fight the white checkmark's own contrast.
  // Their identity still shows up, just as a small chip next to their name
  // instead of replacing that badge.

  return (
    <div key={`checked-in-${guest.id}`} className="relative overflow-hidden rounded-2xl bg-status-confirmed text-white">
      <div className="flex flex-wrap items-center gap-4 p-6">
        <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15" style={{ animation: 'checkin-pop 420ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
          {confetti.map((c) => (
            <span
              key={c.id}
              aria-hidden="true"
              className={`absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full ${dotColor[c.hue]}`}
              style={
                {
                  '--tx': `${c.tx}px`,
                  '--ty': `${c.ty}px`,
                  '--rot': `${c.rot}deg`,
                  animation: `checkin-confetti 700ms ease-out ${c.delay}ms both`,
                } as CSSProperties
              }
            />
          ))}
          <svg viewBox="0 0 24 24" fill="none" className="relative h-8 w-8">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="44"
              style={{ animation: 'checkin-draw 420ms ease-out 320ms both' }}
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <GuestAvatar name={guest.name} imageUrl={guest.imageUrl} avatarConfig={guest.avatarConfig} sizeClassName="h-6 w-6" />
            <p className="truncate font-display text-lg font-bold">Welcome, {guest.name}!</p>
          </div>
          <p className="mt-0.5 text-sm text-white/80">
            {wasWalkIn ? 'Checked in as a walk-in' : 'Checked in'}
            {!seatLabel && ' · no seat assigned'}
          </p>
        </div>
      </div>
      <TicketStub seatLabel={seatLabel}>
        <div className="flex flex-col items-start gap-2">
          {/* The one action this celebration hands off to — a printable
              badge (GuestPrintCard) in the UserIdCardModal visual language,
              per request. Solid white on this card's own status-confirmed
              fill, same "needs real contrast, not a ghost surface" call
              ReadyCard's own swipe handle makes. */}
          <button
            type="button"
            onClick={() => onPrintCard(guest)}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-status-confirmed transition active:scale-[0.97] hover:bg-white/90"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            Print card
          </button>
          <button
            type="button"
            onClick={() => onUndo(guest)}
            className="-mx-2 -my-1 inline-block px-2 py-2 text-xs font-semibold text-white/70 underline decoration-white/30 underline-offset-2 transition hover:text-white hover:decoration-white/60 active:scale-[0.97]"
          >
            Wrong guest? Undo
          </button>
        </div>
      </TicketStub>
    </div>
  )
}
