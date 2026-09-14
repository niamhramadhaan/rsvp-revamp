import { readTable, writeTable, genId } from './store'
import type { Guest, NewGuestInput, Seat } from './types'
import type { AvatarFullConfig } from 'react-nice-avatar'

const TABLE = 'guests'

export async function listGuests(eventId?: string | null): Promise<Guest[]> {
  const guests = readTable<Guest>(TABLE)
  return eventId ? guests.filter((g) => g.eventId === eventId) : guests
}

export async function listAllGuests(): Promise<Guest[]> {
  return readTable<Guest>(TABLE)
}

// Simple client-side search across every event's guests by name/contact —
// backs the Overview page's global guest search.
export async function searchGuests(query: string): Promise<Guest[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return readTable<Guest>(TABLE).filter(
    (g) =>
      g.name.toLowerCase().includes(q) ||
      g.contact?.wa?.toLowerCase().includes(q) ||
      g.contact?.email?.toLowerCase().includes(q)
  )
}

// A phone number normalized down to just its digits ("+62 812-3456-7890" and
// "62 812 3456 7890" both become "628123456790") — cheap, and enough to
// catch the same number typed with different spacing/dashes/plus-sign
// without attempting real national-number canonicalization (a leading 0
// vs. +62 country code, say), which this app has no other reason to know
// how to do. Email compares case-insensitively instead (trim + lowercase) —
// the standard "same address" rule.
function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

// Characters that survive handwriting and retyping without confusion —
// no 0/O or 1/I pairs. Only the generated parts use this alphabet; the
// name part keeps plain A-Z (it's read off the guest's own name, and any
// ambiguity there is caught by the check digit, not prevented up front).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function randomCodeChars(length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return out
}

function codeCharValue(ch: string): number {
  const code = ch.charCodeAt(0)
  // A-Z → 0-25, 0-9 → 26-35.
  return code >= 65 && code <= 90 ? code - 65 : 26 + (code - 48)
}

function codeValueChar(value: number): string {
  return value < 26 ? String.fromCharCode(65 + value) : String(value - 26)
}

// Typed codes come back with dashes, spaces, or lowercase (see
// GuestPrintCard/GuestProfileDrawer, where staff read them) — matching
// always compares this normalized form, never the raw strings. Old
// random-style tokens (pre-name-code era) normalize the same way, so they
// keep working: "tok-ab12" and "TOKAB12" are the same code.
export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// What a current-format code looks like on the record ("ABC-12D") —
// anything else is a pre-redesign token, still matchable (see
// normalizeInviteCode) but rewritten to this shape by init.ts's own
// migration, so staff only ever read and type the short form.
export const INVITE_CODE_RE = /^[A-Z]{3}-[A-Z0-9]{3}$/

// An invitation code derived from who the guest IS, not a random string:
// three letters off their name, two characters off their phone number (or
// email, or random when neither exists), plus a check digit that catches
// single-character typos at manual entry. Six characters, all caps, stored
// with one dash ("ABC-12D") so staff read and type it in two chunks;
// matching always goes through normalizeInviteCode, so the dash is
// cosmetic. `existing` is every token already on this event — on the rare
// collision the middle part re-rolls random until it's unique, keeping the
// name part personal either way.
export function generateInviteCode(name: string, wa: string, email: string, existing: Set<string>): string {
  const namePart = (name.toUpperCase().replace(/[^A-Z]/g, '') + 'XXX').slice(0, 3)

  const digits = normalizePhone(wa)
  let mid: string
  if (digits.length >= 2) {
    mid = digits.slice(-2)
  } else if (digits.length === 1) {
    mid = `0${digits}`
  } else {
    const local = email.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2)
    mid = local.length === 2 ? local : (local + randomCodeChars(2)).slice(0, 2)
  }

  const build = (midPart: string) => {
    const core = `${namePart}${midPart}`
    const check = codeValueChar([...core].reduce((sum, ch) => sum + codeCharValue(ch), 0) % 36)
    return `${namePart}-${midPart}${check}`
  }

  let code = build(mid)
  while (existing.has(code)) {
    code = build(randomCodeChars(2))
  }
  return code
}

// Finds another guest AT THE SAME EVENT already using this email or phone —
// scoped per-event on purpose: the same real person attending two different
// events with the same contact info is normal and shouldn't collide, only
// two DIFFERENT guest entries on the SAME event's own roster sharing one
// should. Blank fields never collide with other blanks (most guests only
// ever fill in one of the two, so "both empty" is the common case, not a
// real duplicate). `excludeGuestId` lets a future "edit guest" caller check
// against everyone ELSE without always flagging itself; unused by
// createGuest/createGuestsBulk below (a brand-new guest can't collide with
// its own not-yet-created record) but there for that reason, not dead code.
function findDuplicateContact(
  guests: Guest[],
  eventId: string,
  wa: string,
  email: string,
  excludeGuestId?: string
): string | null {
  const waNorm = normalizePhone(wa)
  const emailNorm = email.trim().toLowerCase()
  for (const g of guests) {
    if (g.eventId !== eventId || g.id === excludeGuestId) continue
    if (emailNorm && g.contact.email.trim().toLowerCase() === emailNorm) {
      return `${g.name} already uses this email address.`
    }
    if (waNorm && normalizePhone(g.contact.wa) === waNorm) {
      return `${g.name} already uses this phone number.`
    }
  }
  return null
}

export interface CreateGuestResult {
  ok: boolean
  guest?: Guest
  reason?: string
}

// The one write this module owns — manual guest add (see plan.md's guest
// management spec). Everything invite/seat/check-in-related starts fully
// unset, same as a freshly-imported row would: this guest hasn't been
// invited yet, so there's nothing to default to `sent`/etc. Rejects outright
// (rather than creating a second entry) when this event already has a guest
// on the same email or phone — see findDuplicateContact's own doc for the
// exact rule.
export async function createGuest(eventId: string, input: NewGuestInput): Promise<CreateGuestResult> {
  const guests = readTable<Guest>(TABLE)
  const wa = input.wa?.trim() ?? ''
  const email = input.email?.trim() ?? ''
  const duplicateReason = findDuplicateContact(guests, eventId, wa, email)
  if (duplicateReason) return { ok: false, reason: duplicateReason }

  const guest: Guest = {
    id: genId('gst'),
    eventId,
    name: input.name.trim(),
    contact: { wa, email },
    role: input.role?.trim() ?? '',
    organization: input.organization?.trim() ?? '',
    token: generateInviteCode(input.name.trim(), wa, email, new Set(guests.filter((g) => g.eventId === eventId).map((g) => g.token))),
    seatId: null,
    seatAssignedAt: null,
    invites: {
      wa: { status: 'not_sent', sentAt: null },
      email: { status: 'not_sent', sentAt: null },
    },
    checkedInAt: null,
    checkedInBy: null,
    status: 'active',
    createdAt: new Date().toISOString(),
    imageUrl: input.imageUrl,
    avatarConfig: input.avatarConfig,
  }
  writeTable(TABLE, [...guests, guest])
  return { ok: true, guest }
}

/** GuestProfileDrawer's own inline "Edit" form — every editable field at
 * once (a full replace of the editable subset, not a partial patch), since
 * the form always submits its complete current draft rather than only
 * whichever single field changed. */
export interface UpdateGuestInput {
  name: string
  role: string
  organization: string
  wa: string
  email: string
  /** undefined clears a photo back to the generated fallback — see
   * GuestAvatar's own doc — same as never having set one. */
  imageUrl: string | undefined
  /** undefined clears a pinned "Randomize" look back to the plain,
   * name-derived generated avatar — see Guest.avatarConfig's own doc. */
  avatarConfig: AvatarFullConfig | undefined
}

// GuestProfileDrawer's own inline "Edit" — replaces updateGuestPhoto (a
// single-field version of this, now folded in: photo is just one more field
// this same form edits, not a separate modal/flow any more).
export async function updateGuest(guestId: string, input: UpdateGuestInput): Promise<void> {
  const guests = readTable<Guest>(TABLE)
  writeTable(
    TABLE,
    guests.map((g) =>
      g.id === guestId
        ? {
            ...g,
            name: input.name.trim(),
            role: input.role.trim(),
            organization: input.organization.trim(),
            imageUrl: input.imageUrl,
            avatarConfig: input.avatarConfig,
            contact: { wa: input.wa.trim(), email: input.email.trim() },
          }
        : g
    )
  )
}

export interface CreateGuestsBulkResult {
  created: Guest[]
  /** Rows skipped for sharing an email/phone with either an existing guest
   * on this event or an earlier row in this SAME batch — see
   * findDuplicateContact's own doc. Reported as a count (like
   * AddGuestDrawer's own blank-name `skipped`), not which rows exactly —
   * this app's bulk import already treats "some rows don't make it in" as
   * a normal, expected outcome to summarize, not an error to enumerate. */
  duplicates: number
}

// AddGuestDrawer's own bulk Excel import mode — one write for the whole
// parsed batch (matching writeTable's own "one replace, not N appends" shape
// used everywhere else in this file) rather than calling createGuest in a
// loop, which would re-read and re-write the whole table once per row. Each
// row is checked against every guest already on this event AND every row
// already accepted earlier in this SAME batch (a spreadsheet can just as
// easily contain its own internal duplicate as collide with someone already
// on the roster) — a duplicate is skipped, not a reason to fail the whole
// import, the same "one bad row doesn't sink the batch" rule blank names
// already follow one step up in AddGuestDrawer's own parser.
export async function createGuestsBulk(eventId: string, inputs: NewGuestInput[]): Promise<CreateGuestsBulkResult> {
  const guests = readTable<Guest>(TABLE)
  const created: Guest[] = []
  let duplicates = 0
  // Every token already on this event, plus each row accepted earlier in
  // this same batch — generateInviteCode draws uniqueness from this set,
  // so two rows with similar names/numbers can't land the same code.
  const takenTokens = new Set(guests.filter((g) => g.eventId === eventId).map((g) => g.token))

  for (const input of inputs) {
    const wa = input.wa?.trim() ?? ''
    const email = input.email?.trim() ?? ''
    if (findDuplicateContact([...guests, ...created], eventId, wa, email)) {
      duplicates++
      continue
    }
    const token = generateInviteCode(input.name.trim(), wa, email, takenTokens)
    takenTokens.add(token)
    created.push({
      id: genId('gst'),
      eventId,
      name: input.name.trim(),
      contact: { wa, email },
      role: input.role?.trim() ?? '',
      organization: input.organization?.trim() ?? '',
      token,
      seatId: null,
      seatAssignedAt: null,
      invites: {
        wa: { status: 'not_sent', sentAt: null },
        email: { status: 'not_sent', sentAt: null },
      },
      checkedInAt: null,
      checkedInBy: null,
      status: 'active',
      createdAt: new Date().toISOString(),
      imageUrl: input.imageUrl,
    })
  }

  writeTable(TABLE, [...guests, ...created])
  return { created, duplicates }
}

// SendInvitationsDrawer's own bulk send — marks a batch of guests' one
// channel (WhatsApp or email) as sent, in the one write every other bulk
// operation in this file uses (see createGuestsBulk above). There's no real
// third-party messaging integration behind this (see SendInvitationsDrawer's
// own doc for why sending itself stays a stub) — this is the one thing that
// IS real: recording that staff told this app "these went out," the same
// fact GuestProfileDrawer's Invitation section used to only ever show as
// permanently "Not sent yet."
export async function markInvitesSent(guestIds: string[], channel: 'wa' | 'email'): Promise<void> {
  const ids = new Set(guestIds)
  const guests = readTable<Guest>(TABLE)
  const sentAt = new Date().toISOString()
  writeTable(
    TABLE,
    guests.map((g) => (ids.has(g.id) ? { ...g, invites: { ...g.invites, [channel]: { status: 'sent' as const, sentAt } } } : g))
  )
}


export interface DeleteGuestResult {
  ok: boolean
  reason?: string
}

// GuestProfileDrawer's own "Delete" — a real, irreversible removal (this
// app has no undo/trash for guests the way the seat-map editor has for
// layout edits), which is why GuestProfileDrawer asks with a confirm dialog
// before ever calling this. Frees the guest's own seat first if they were
// holding one, the same "don't orphan the other side of a relationship"
// rule deleteLayoutBlock/deleteSeat already follow for seats/blocks.
export async function deleteGuest(guestId: string): Promise<DeleteGuestResult> {
  const guests = readTable<Guest>(TABLE)
  const guest = guests.find((g) => g.id === guestId)
  if (!guest) return { ok: false, reason: 'Already removed' }

  if (guest.seatId) {
    writeTable(
      'seats',
      readTable<Seat>('seats').map((s) => (s.id === guest.seatId ? { ...s, status: 'empty' as const } : s))
    )
  }
  writeTable(TABLE, guests.filter((g) => g.id !== guestId))
  return { ok: true }
}
