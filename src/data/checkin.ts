// Guest check-in writes. The only module that mutates 'guests' for check-in
// purposes — same convention as seating.ts (which owns seat-assignment
// writes). useGuests already subscribes to the 'guests' table (data/hooks.ts),
// so a write here refreshes every mounted consumer — the Reports tab's
// no-show/walk-in callouts and Overview's check-in ring included.

import { readTable, writeTable } from './store'
import type { Guest } from './types'

const GUESTS_TABLE = 'guests'

// Stamps `checkedInAt`/`checkedInBy` — used for both a normal confirmed
// check-in and a discretionary walk-in override (see plan.md); the caller
// decides which state licenses the tap, this just performs the write. The
// `!guest.checkedInAt` guard is the actual duplicate-check-in block from the
// spec: once stamped, calling this again is a no-op, so a double-tap or a
// second scan of the same code can never overwrite the original time/staff.
export async function checkInGuest(guestId: string, staffName = 'Admin Desk'): Promise<void> {
  const guests = readTable<Guest>(GUESTS_TABLE)
  const guest = guests.find((g) => g.id === guestId)
  if (!guest || guest.checkedInAt) return

  const now = new Date().toISOString()
  writeTable(
    GUESTS_TABLE,
    guests.map((g) => (g.id === guestId ? { ...g, checkedInAt: now, checkedInBy: staffName } : g))
  )
}

// Staff-facing correction for a mis-scan/mis-tap — clears the stamp so the
// guest can be checked in again properly. Deliberately not exposed as a
// prominent action (see CheckInResultCard) — it's an undo, not a toggle.
export async function undoCheckIn(guestId: string): Promise<void> {
  const guests = readTable<Guest>(GUESTS_TABLE)
  writeTable(
    GUESTS_TABLE,
    guests.map((g) => (g.id === guestId ? { ...g, checkedInAt: null, checkedInBy: null } : g))
  )
}
