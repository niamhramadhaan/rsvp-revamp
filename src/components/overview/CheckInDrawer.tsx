import { useEffect, useMemo, useState } from 'react'
import type { Event, Guest, Seat, SeatGroup } from '../../data/types'
import { checkInGuest, undoCheckIn } from '../../data/checkin'
import { assignSeat } from '../../data/seating'
import { normalizeInviteCode } from '../../data/guests'
import { getGuestStage } from '../../data/selectors'
import { GLASS_CARD, STAGE_TONE } from './cardChrome'
import { SearchIcon, QrCheckIcon, CloseIcon } from '../icons/UiIcons'
import DrawerPanelPortal from '../DrawerPanelPortal'
import Button from '../Button'
import QrScanner from './QrScanner'
import CheckInResultCard, { type CheckInResolution } from './CheckInResultCard'
import GuestAvatar from './GuestAvatar'
import GuestPrintCard from './GuestPrintCard'
import type { ToastTone } from '../Toast'

export interface CheckInDrawerProps {
  open: boolean
  onClose: () => void
  guests: Guest[]
  seats: Seat[]
  /** Seat categories for the no-seat picker's own group stepper — the
   * currently-selected event's groups, same source SeatingView reads. */
  groups: SeatGroup[]
  /** For GuestPrintCard's own nameplate — the currently-selected event, or
   * null if none (the print button just won't show an event line then). */
  event: Event | null
  onToast: (message: string, tone?: ToastTone) => void
}

// One guest's outcome, decided from its current record — the same
// classification whether it was reached via an exact token match or an
// unambiguous name-search match, so both paths converge on one result card.
// There's no separate "walk-in" branch here any more — a guest already on
// the roster checks in the same way whether or not their invite happened to
// go out yet (being on the roster is what matters, not invite-send status).
// handleConfirm below still notes informationally whether they were ever
// invited (see wasWalkIn), but it's not a gate.
function classifyGuest(guest: Guest): CheckInResolution {
  if (guest.checkedInAt) return { kind: 'already_checked_in', guest }
  if (!guest.seatId) return { kind: 'no_seat', guest }
  return { kind: 'ready', guest }
}

function matchesQuery(guest: Guest, q: string): boolean {
  return (
    guest.name.toLowerCase().includes(q) ||
    guest.contact?.wa?.toLowerCase().includes(q) ||
    guest.contact?.email?.toLowerCase().includes(q)
  )
}

// Groups a raw code keystroke run the way stored codes read — 3 letters,
// 4 middle characters, then the check tail ("CHA-7890-D"). Dynamic rather
// than fixed-width so pre-name-code tokens (longer random strings) still
// format into readable chunks instead of truncating.
export function formatCodeInput(value: string): string {
  const raw = normalizeInviteCode(value)
  return [raw.slice(0, 3), raw.slice(3, 7), raw.slice(7)].filter(Boolean).join('-')
}

// The full scan → resolve → confirm/override/assign-seat/undo flow, in its
// own drawer — reachable only from QuickActionsPanel's "Open Check-in" now
// (there used to also be a dedicated Check-in tab with its own launcher and
// a "recent check-ins" log; that log duplicated Overview's Recent Activity
// feed, which already lists every checked_in event, so the tab was removed
// rather than keeping two lists of the same thing). Opening this drawer is
// itself the explicit action that starts
// the camera — unlike the old inline version, there's no second "tap to
// open camera" step once you're here, since choosing to open this drawer at
// all already is that tap. Two input paths still converge on the same
// `resolve()` — the camera (QrScanner, now also reading the barcode
// TicketCard renders, see its own `formatsToSupport`) and a text field for
// a pasted/typed code or a name-search fallback when the camera can't be
// used (no camera, denied permission, a guest without a phone handy).
export default function CheckInDrawer({ open, onClose, guests, seats, groups, event, onToast }: CheckInDrawerProps) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Guest[]>([])
  const [resolution, setResolution] = useState<CheckInResolution | null>(null)
  // A guest picked by name, waiting on their invitation code — the gate
  // before any swipe card. Null the rest of the time; an exact code typed
  // (or scanned) straight into the field above skips this entirely, since
  // entering the code already proves what this step would ask for.
  const [pendingGuest, setPendingGuest] = useState<Guest | null>(null)
  const [cameraOpen, setCameraOpen] = useState(true)
  // Which guest's printable card is open — CheckedInCelebration's own
  // "Print card" button. Separate from `resolution` so closing the print
  // preview doesn't also lose the check-in result underneath it.
  const [printGuest, setPrintGuest] = useState<Guest | null>(null)

  // A fresh drawer for every visit — without this, closing mid-scan and
  // reopening later would resume on whoever was last resolved instead of
  // starting clean.
  useEffect(() => {
    if (open) return
    setQuery('')
    setMatches([])
    setResolution(null)
    setPendingGuest(null)
    setCameraOpen(true)
    setPrintGuest(null)
  }, [open])

  const emptySeats = useMemo(
    () => seats.filter((s) => s.kind === 'seat' && s.status === 'empty').sort((a, b) => a.row - b.row || a.column - b.column),
    [seats]
  )

  const seatById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats])
  const resolvedSeatLabel = resolution && 'guest' in resolution && resolution.guest.seatId ? (seatById.get(resolution.guest.seatId)?.label ?? null) : null

  // Two ways in. An exact invitation code (typed or scanned) resolves
  // straight to the guest's card — entering the code already proves what
  // the gate below would ask for. A name (or fragment) instead lists
  // matches to pick from, and picking one parks the guest in `pendingGuest`
  // for the code gate rather than resolving them outright: finding someone
  // is not permission to check them in.
  function resolve(value: string) {
    const code = normalizeInviteCode(value)
    if (!code) {
      setMatches([])
      setResolution(null)
      return
    }
    const byCode = guests.find((g) => normalizeInviteCode(g.token) === code)
    if (byCode) {
      setMatches([])
      setPendingGuest(null)
      setResolution(classifyGuest(byCode))
      return
    }

    const q = value.trim().toLowerCase()
    const found = guests.filter((g) => matchesQuery(g, q))
    if (found.length === 0) {
      setMatches([])
      setResolution({ kind: 'not_found', query: value.trim() })
    } else {
      setMatches(found)
      setResolution(null)
    }
  }

  function handleChange(value: string) {
    setQuery(value)
    resolve(value)
  }

  // A decoded QR or barcode feeds the exact same resolver as typed input —
  // the camera's just a faster way to fill in the same string a staff
  // member could otherwise paste in by hand.
  function handleDecode(text: string) {
    setQuery(text)
    resolve(text)
  }

  function handlePickMatch(guest: Guest) {
    setQuery(guest.name)
    setMatches([])
    setResolution(null)
    setPendingGuest(guest)
  }

  // Clears the current result so a still-open camera resumes for the next
  // guest — without this, the feed would stay paused on whoever just got
  // resolved. Doesn't touch `cameraOpen` either way: if the camera was
  // closed, this doesn't reopen it.
  function handleReset() {
    setQuery('')
    setMatches([])
    setResolution(null)
    setPendingGuest(null)
  }

  async function handleConfirm(guest: Guest) {
    await checkInGuest(guest.id)
    // Purely informational at this point (see classifyGuest's own doc) — no
    // separate confirm/override action any more, just a note on the
    // celebration screen for a guest who was never actually invited.
    const wasWalkIn = guest.invites.wa.status !== 'sent' && guest.invites.email.status !== 'sent'
    setResolution({ kind: 'checked_in', guest, wasWalkIn })
  }

  async function handleAssignSeat(guest: Guest, seatId: string) {
    await assignSeat(guest.id, seatId)
    const seat = seats.find((s) => s.id === seatId)
    onToast(`${guest.name} assigned to ${seat?.label ?? 'a seat'}`)
    setResolution(classifyGuest({ ...guest, seatId }))
  }

  async function handleUndo(guest: Guest) {
    await undoCheckIn(guest.id)
    onToast(`Check-in undone for ${guest.name}`)
    setResolution(classifyGuest({ ...guest, checkedInAt: null, checkedInBy: null }))
  }  return (
    <>
    <DrawerPanelPortal open={open} onClose={onClose} title="Scan a ticket" icon={QrCheckIcon}>
      <div className="flex flex-col gap-6">
        <div>
          {cameraOpen ? (
            <div className="flex flex-col gap-2">
              <QrScanner active={!resolution} onDecode={handleDecode} />
              <button
                type="button"
                onClick={() => setCameraOpen(false)}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-black/10 bg-white/60 px-4 text-sm font-semibold text-ink-900 transition active:scale-[0.97] hover:bg-white"
              >
                <CloseIcon className="h-4 w-4" /> Close camera, use search
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent-700/30 bg-accent-700/5 text-accent-700 transition active:scale-[0.98] hover:bg-accent-700/10"
            >
              <QrCheckIcon className="h-9 w-9" />
              <span className="text-sm font-semibold">Reopen camera</span>
              <span className="text-xs text-accent-700/70">or enter the invitation code below</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3">
          <SearchIcon className="h-5 w-5 shrink-0 text-icon-gray" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Paste a code or type a guest's name"
            className="w-full min-w-0 bg-transparent text-sm text-ink-900 outline-none placeholder:text-muted"
          />
        </div>

        {matches.length > 0 && (
          <div className={`flex flex-col gap-1 rounded-2xl p-2 ${GLASS_CARD}`}>
            <p className="px-2 pb-1 pt-1 text-xs font-medium text-muted">{matches.length} guests match — pick one</p>
            {/* Picking a name means "this is who I meant" — it parks them
                in the code gate below, not straight into a swipe card.
                Finding someone is not permission to check them in. */}
            {matches.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => handlePickMatch(g)}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-black/5 active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{g.name}</p>
                  <p className="truncate text-xs text-muted">{g.organization || 'Guest'}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${STAGE_TONE[getGuestStage(g)].wash} ${STAGE_TONE[getGuestStage(g)].text}`}>
                  {STAGE_TONE[getGuestStage(g)].label}
                </span>
              </button>
            ))}
          </div>
        )}

        {pendingGuest && !resolution && (
          <InviteCodeGate
            key={pendingGuest.id}
            guest={pendingGuest}
            onVerified={(guest) => {
              setPendingGuest(null)
              setResolution(classifyGuest(guest))
            }}
            onCancel={() => setPendingGuest(null)}
          />
        )}

        {resolution && (
          <div className="flex flex-col gap-3">
            <CheckInResultCard
              resolution={resolution}
              emptySeats={emptySeats}
              groups={groups}
              seatLabel={resolvedSeatLabel}
              onConfirm={handleConfirm}
              onAssignSeat={handleAssignSeat}
              onUndo={handleUndo}
              onPrintCard={setPrintGuest}
            />
            {/* Same bordered-secondary treatment "Close camera, use search"
                above uses — a different role from Button.tsx's own pill
                variants (final Cancel/Submit), this is an in-flow toggle
                within an active scan session, so it stays its own family
                rather than being forced into a Button variant that doesn't
                fit. min-h-[44px] to match this app's own touch-target
                standard though — this used to be the one secondary button
                in the whole app sitting at 48px instead. */}
            <button
              type="button"
              onClick={handleReset}
              className="flex min-h-[44px] items-center justify-center rounded-xl border border-black/10 bg-white/60 px-4 text-sm font-semibold text-ink-900 transition active:scale-[0.97] hover:bg-white"
            >
              Scan next guest
            </button>
          </div>
        )}
      </div>
    </DrawerPanelPortal>

    <GuestPrintCard
      open={Boolean(printGuest)}
      onClose={() => setPrintGuest(null)}
      guest={printGuest}
      event={event}
      seatLabel={printGuest?.seatId ? (seatById.get(printGuest.seatId)?.label ?? null) : null}
    />
    </>
  )
}

// The code gate between finding a guest by name and being allowed to check
// them in — finding someone is not permission. Bound to THIS guest: the
// entered code must match their own token, not just any valid code. The
// input formats itself with dashes as they type (see formatCodeInput), so
// what staff type mirrors how the code reads on the profile and the
// printed card.
function InviteCodeGate({ guest, onVerified, onCancel }: { guest: Guest; onVerified: (guest: Guest) => void; onCancel: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const firstName = guest.name.split(' ')[0] || guest.name

  function handleVerify() {
    if (normalizeInviteCode(code) === normalizeInviteCode(guest.token)) {
      onVerified(guest)
    } else {
      setError(true)
    }
  }

  return (
    <div className="rounded-2xl border border-accent-700/25 bg-accent-700/5 p-5">
      <div className="flex items-center gap-3">
        <GuestAvatar name={guest.name} imageUrl={guest.imageUrl} avatarConfig={guest.avatarConfig} sizeClassName="h-11 w-11" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">Enter {firstName}&rsquo;s invitation code</p>
          <p className="text-xs text-muted">From their profile or printed card.</p>
        </div>
      </div>

      <input
        type="text"
        value={code}
        onChange={(e) => {
          setCode(formatCodeInput(e.target.value))
          setError(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleVerify()
        }}
        placeholder="ABC-1234-D"
        aria-label={`Invitation code for ${guest.name}`}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={19}
        className={`mt-4 w-full rounded-xl border-[1.5px] bg-white px-4 py-3 text-center font-mono text-lg font-bold tracking-[0.2em] text-ink-900 uppercase outline-none transition placeholder:font-sans placeholder:text-sm placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/60 focus:ring-4 ${
          error ? 'border-status-declined focus:ring-status-declined/15' : 'border-black/10 focus:border-accent-700 focus:ring-accent-700/10'
        }`}
      />
      {error && (
        <p role="alert" className="mt-2 text-center text-xs font-medium text-status-declined">
          That code doesn&rsquo;t match {guest.name} — check and try again.
        </p>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Not them
        </Button>
        <Button variant="primary" onClick={handleVerify} disabled={normalizeInviteCode(code).length === 0}>
          Verify code
        </Button>
      </div>
    </div>
  )
}
