import { useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
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
  }

  return (
    <>
    <DrawerPanelPortal open={open} onClose={onClose} title="Scan a ticket" icon={QrCheckIcon}>
      <div className="flex flex-col gap-6">
        {/* Full-bleed camera stage — negative margins cancel the drawer
            body's own px-6 py-5 padding so this actually reaches the
            drawer's edges, the way a real gate camera fills the screen
            instead of sitting in a small inset square. */}
        <div className="relative -mx-6 -mt-5 h-[58vh] max-h-[560px] min-h-[380px] overflow-hidden bg-ink-900 lg:h-[440px]">
          {cameraOpen ? (
            <>
              <QrScanner active={!resolution} onDecode={handleDecode} />
              <button
                type="button"
                onClick={() => setCameraOpen(false)}
                className="absolute right-3 top-3 flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/20 bg-ink-900/70 px-3 text-xs font-semibold text-white/90 backdrop-blur-sm transition active:scale-[0.97] hover:bg-ink-900/90"
              >
                <CloseIcon className="h-3.5 w-3.5" /> Use search
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="flex h-full w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-accent-cyan-light/30 bg-ink-900 text-accent-cyan-light transition active:scale-[0.98] hover:bg-ink-800"
            >
              <QrCheckIcon className="h-9 w-9" />
              <span className="text-sm font-semibold">Reopen camera</span>
              <span className="text-xs text-accent-cyan-light/70">or enter the invitation code below</span>
            </button>
          )}

          {/* Every outcome — success, already-in, no-seat, not-found — now
              overlays the stage as a bottom sheet, the gate "accepting" or
              "rejecting" whatever was just scanned, instead of appearing
              in the scrollable list below it. Each card supplies its own
              solid fill (see CheckInResultCard) so it reads clearly over
              the camera feed. */}
          {resolution && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
              <div className="pointer-events-auto">
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
              </div>
            </div>
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
          /* Same bordered-secondary treatment "Use search" above uses — a
             different role from Button.tsx's own pill variants (final
             Cancel/Submit), this is an in-flow toggle within an active scan
             session, so it stays its own family rather than being forced
             into a Button variant that doesn't fit. min-h-[44px] to match
             this app's own touch-target standard though — this used to be
             the one secondary button in the whole app sitting at 48px
             instead. */
          <button
            type="button"
            onClick={handleReset}
            className="flex min-h-[44px] items-center justify-center rounded-xl border border-black/10 bg-white/60 px-4 text-sm font-semibold text-ink-900 transition active:scale-[0.97] hover:bg-white"
          >
            Scan next guest
          </button>
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
// boxes auto-verify the moment the sixth character lands (no separate tap —
// this is a door flow), one box per character so the shape mirrors the code
// staff read off the profile and the printed card.
function InviteCodeGate({ guest, onVerified, onCancel }: { guest: Guest; onVerified: (guest: Guest) => void; onCancel: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const verifiedRef = useRef(false)
  const firstName = guest.name.split(' ')[0] || guest.name

  useEffect(() => {
    if (code.length < CODE_LENGTH || verifiedRef.current) return
    if (normalizeInviteCode(code) === normalizeInviteCode(guest.token)) {
      verifiedRef.current = true
      onVerified(guest)
    } else {
      setError(true)
    }
  }, [code, guest, onVerified])

  function handleCodeChange(next: string) {
    setCode(next)
    setError(false)
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

      <CodeBoxes value={code} onChange={handleCodeChange} error={error} />

      {error && (
        <p role="alert" className="mt-2 text-center text-xs font-medium text-status-declined">
          That code doesn&rsquo;t match {guest.name} — check and try again.
        </p>
      )}

      <div className="mt-3 flex justify-center">
        <Button variant="ghost" onClick={onCancel}>
          Not them
        </Button>
      </div>
    </div>
  )
}

const CODE_LENGTH = 6

// Six boxes, one character each — typing advances, backspace retreats,
// pasting a whole code fills them left to right. Uppercase alphanumerics
// only (anything else never survives normalization, so it never enters).
function CodeBoxes({ value, onChange, error }: { value: string; onChange: (value: string) => void; error: boolean }) {
  const boxRefs = useRef<(HTMLInputElement | null)[]>([])

  function setChar(i: number, ch: string) {
    const clean = ch.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1)
    const next = value.split('')
    while (next.length < CODE_LENGTH) next.push('')
    next[i] = clean
    onChange(next.join('').slice(0, CODE_LENGTH))
    if (clean && i < CODE_LENGTH - 1) boxRefs.current[i + 1]?.focus()
  }

  function handleKeyDown(i: number, e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      boxRefs.current[i - 1]?.focus()
      const next = value.split('')
      while (next.length < CODE_LENGTH) next.push('')
      next[i - 1] = ''
      onChange(next.join('').slice(0, CODE_LENGTH))
    }
  }

  function handlePaste(e: ReactClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = normalizeInviteCode(e.clipboardData.getData('text')).slice(0, CODE_LENGTH)
    if (!pasted) return
    onChange(pasted)
    boxRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus()
  }

  return (
    <div className="mt-4 flex items-center justify-center gap-1.5 sm:gap-2" role="group" aria-label="Invitation code">
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            boxRefs.current[i] = el
          }}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={1}
          autoFocus={i === 0}
          aria-label={`Character ${i + 1} of ${CODE_LENGTH}`}
          value={value[i] ?? ''}
          onChange={(e) => setChar(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={`h-12 w-10 rounded-xl border-[1.5px] bg-white text-center font-mono text-lg font-bold uppercase outline-none transition sm:h-14 sm:w-12 ${
            error ? 'border-status-declined' : 'border-black/10 focus:border-accent-700 focus:ring-4 focus:ring-accent-700/10'
          }`}
        />
      ))}
    </div>
  )
}
