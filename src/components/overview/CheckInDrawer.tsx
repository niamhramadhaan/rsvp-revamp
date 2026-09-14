import { useEffect, useMemo, useState } from 'react'
import type { Event, Guest, Seat } from '../../data/types'
import { checkInGuest, undoCheckIn } from '../../data/checkin'
import { assignSeat } from '../../data/seating'
import { getGuestStage } from '../../data/selectors'
import { GLASS_CARD, STAGE_TONE } from './cardChrome'
import { SearchIcon, QrCheckIcon, CloseIcon } from '../icons/UiIcons'
import DrawerPanelPortal from '../DrawerPanelPortal'
import QrScanner from './QrScanner'
import CheckInResultCard, { type CheckInResolution } from './CheckInResultCard'
import GuestPrintCard from './GuestPrintCard'
import type { ToastTone } from '../Toast'

export interface CheckInDrawerProps {
  open: boolean
  onClose: () => void
  guests: Guest[]
  seats: Seat[]
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
export default function CheckInDrawer({ open, onClose, guests, seats, event, onToast }: CheckInDrawerProps) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Guest[]>([])
  const [resolution, setResolution] = useState<CheckInResolution | null>(null)
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
    setCameraOpen(true)
    setPrintGuest(null)
  }, [open])

  const emptySeats = useMemo(
    () => seats.filter((s) => s.kind === 'seat' && s.status === 'empty').sort((a, b) => a.row - b.row || a.column - b.column),
    [seats]
  )

  const seatById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats])
  const resolvedSeatLabel = resolution && 'guest' in resolution && resolution.guest.seatId ? (seatById.get(resolution.guest.seatId)?.label ?? null) : null

  function resolve(value: string) {
    const trimmed = value.trim()
    if (!trimmed) {
      setMatches([])
      setResolution(null)
      return
    }

    const byToken = guests.find((g) => g.token === trimmed)
    if (byToken) {
      setMatches([])
      setResolution(classifyGuest(byToken))
      return
    }

    const q = trimmed.toLowerCase()
    const found = guests.filter((g) => matchesQuery(g, q))
    if (found.length === 1) {
      setMatches([])
      setResolution(classifyGuest(found[0]))
    } else if (found.length > 1) {
      setMatches(found)
      setResolution(null)
    } else {
      setMatches([])
      setResolution({ kind: 'not_found', query: trimmed })
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
    setResolution(classifyGuest(guest))
  }

  // Clears the current result so a still-open camera resumes for the next
  // guest — without this, the feed would stay paused on whoever just got
  // resolved. Doesn't touch `cameraOpen` either way: if the camera was
  // closed, this doesn't reopen it.
  function handleReset() {
    setQuery('')
    setMatches([])
    setResolution(null)
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
  }

  return (
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
              <span className="text-xs text-accent-700/70">or search by name/code below</span>
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
            {/* The whole row (name included) resolves this guest into the
                check-in action card below — not a view-profile shortcut.
                Tapping a match here means "this is who I meant," the same
                as an exact code match would have skipped straight to; a
                name that only sometimes opens a profile and sometimes
                picks a guest (depending on exactly what you tapped) read as
                a mistake, not two real actions. */}
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

        {resolution && (
          <div className="flex flex-col gap-3">
            <CheckInResultCard
              resolution={resolution}
              emptySeats={emptySeats}
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
