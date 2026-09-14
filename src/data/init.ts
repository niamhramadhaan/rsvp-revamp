import { clearTable, readTable, readValue, seedIfEmpty, writeTable, writeValue } from './store'
import { SEED_EVENTS, SEED_SEATMAPS, SEED_SEAT_GROUPS, SEED_SEATS, SEED_GUESTS, SEED_SEAT_SPACING, SEED_VERSION, SEED_USERS } from './seed'
import { generateInviteCode, INVITE_CODE_RE } from './guests'
import type { AppUser, Guest, Seat, SeatGroup } from './types'

const SEED_VERSION_KEY = 'seedVersion'
const SEEDED_TABLES = ['events', 'seatmaps', 'seatGroups', 'seats', 'guests']

// Populates localStorage with mock fixtures the very first time the app
// loads (leaves everything alone on later loads, including a deliberately
// emptied table). Call once at boot, before anything reads the store.
export function initMockData(): void {
  // seed.ts's fixture *content* moved on (see SEED_VERSION's own comment) —
  // a version mismatch means whatever's currently in localStorage predates
  // that change, and since content can't be reconciled row-by-row the way a
  // new field can (migrateSchema below), the only honest fix is to wipe
  // every seeded table and reseed from scratch. This is mock/demo fixture
  // data, not real user data, so blowing away local edits made while
  // testing (a moved seat, an added guest) is the correct trade — the
  // alternative is staying stuck on stale fixtures forever.
  if (readValue<number>(SEED_VERSION_KEY) !== SEED_VERSION) {
    for (const table of SEEDED_TABLES) clearTable(table)
    clearTable('currentEventId')
    writeValue(SEED_VERSION_KEY, SEED_VERSION)
  }

  seedIfEmpty('events', SEED_EVENTS)
  seedIfEmpty('seatmaps', SEED_SEATMAPS)
  seedIfEmpty('seatGroups', SEED_SEAT_GROUPS)
  seedIfEmpty('seats', SEED_SEATS)
  seedIfEmpty('guests', SEED_GUESTS)
  // No SEED_VERSION bump for this one: 'users' never existed as a table
  // before, so seedIfEmpty treats it as genuinely never-seeded on every
  // browser (fresh or stale) without wiping anyone's events/guests the way
  // a version bump would.
  seedIfEmpty('users', SEED_USERS)
  ensureSeedUsers()
  migrateInviteCodes()
  migrateSchema()
}

// Invitation codes used to be long random strings — now they're short
// name-derived codes (see generateInviteCode), and the check-in gate's own
// boxes only fit the short form. Rewrites any token that isn't one, keeping
// already-current tokens untouched (and reserved, so a rewrite can never
// collide with one). Safe to do blindly: old tokens were never communicated
// anywhere outside this browser's mock data, so nothing external references
// them — unlike a version bump, this preserves every guest, seat, and
// check-in around the rewritten field.
function migrateInviteCodes(): void {
  const guests = readTable<Guest>('guests')
  if (!guests.some((g) => !INVITE_CODE_RE.test(g.token))) return
  const taken = new Set<string>()
  for (const g of guests) if (INVITE_CODE_RE.test(g.token)) taken.add(g.token)
  writeTable<Guest>(
    'guests',
    guests.map((g) => {
      if (INVITE_CODE_RE.test(g.token)) return g
      const token = generateInviteCode(g.name, g.contact.wa, g.contact.email, taken)
      taken.add(token)
      return { ...g, token }
    })
  )
}

// The demo sign-in accounts have to exist even on browsers whose users table
// predates them (someone added roster rows in Settings before the login gate
// shipped) — seedIfEmpty only fires on a never-seeded table, so a table that
// already exists would silently keep missing them and every demo login would
// fail with "no account matches". Merges the demo rows in by email when
// they're absent. Additive-only, never touches existing rows.
function ensureSeedUsers(): void {
  const users = readTable<AppUser>('users')
  const emails = new Set(users.map((u) => u.email.toLowerCase()))
  const missing = SEED_USERS.filter((u) => !emails.has(u.email.toLowerCase()))
  if (missing.length > 0) writeTable('users', [...users, ...missing])
}

// seedIfEmpty only ever runs against a brand-new table, so a browser that
// already had this app's data seeded before Seat.x/y (the free-form canvas
// position) or SeatGroup.quota existed would otherwise keep rows missing
// those fields forever, rather than picking them up on the next load like a
// fresh seed would. Additive-only: backfills exactly the rows/fields that
// are missing, never touches one that already has a value.
function migrateSchema(): void {
  const seats = readTable<Seat>('seats')
  if (seats.some((s) => s.x == null || s.y == null)) {
    writeTable<Seat>(
      'seats',
      seats.map((s) => ({
        ...s,
        x: s.x ?? s.column * SEED_SEAT_SPACING,
        y: s.y ?? s.row * SEED_SEAT_SPACING,
      }))
    )
  }

  const groups = readTable<SeatGroup>('seatGroups')
  if (groups.some((g) => g.quota == null)) {
    // No stored "intended capacity" to recover for a pre-existing group, so
    // fall back to however many seats already exist in it — the same
    // reasonable default the seed data itself uses.
    writeTable<SeatGroup>(
      'seatGroups',
      groups.map((g) => (g.quota != null ? g : { ...g, quota: seats.filter((s) => s.groupId === g.id).length }))
    )
  }

  // SeatGroup used to get invented, template-specific names ("General
  // Admission," "Attendee," "Guest" — see seatMapTemplates.ts's own doc)
  // before this app settled on exactly two categories everywhere, VIP and
  // Regular (SeatMapCanvas's own Switch action only ever cycles between
  // those). A browser that already applied one of those old templates
  // would otherwise keep showing that stale name forever — code-only fixes
  // (like the one that stopped NEW templates from doing this) never reach
  // data that's already sitting in localStorage. Folded into "Regular":
  // none of those old names were ever a premium/exclusive tier, each was
  // simply the one and only group its own template created. Every affected
  // seat's own label is regenerated too (the same prefix/sequence
  // convention nextSeatLabel already uses elsewhere), so a seat doesn't
  // keep reading e.g. "GUE-3" once its group is renamed to Regular.
  const currentGroups = readTable<SeatGroup>('seatGroups')
  const staleGroups = currentGroups.filter((g) => g.label !== 'VIP' && g.label !== 'Regular')
  if (staleGroups.length > 0) {
    writeTable<SeatGroup>(
      'seatGroups',
      currentGroups.map((g) => (staleGroups.includes(g) ? { ...g, label: 'Regular', color: '#3CA8D8' } : g))
    )

    const staleGroupIds = new Set(staleGroups.map((g) => g.id))
    const currentSeats = readTable<Seat>('seats')
    const seatIndexByGroup = new Map<string, number>()
    writeTable<Seat>(
      'seats',
      currentSeats.map((s) => {
        if (s.kind !== 'seat' || !staleGroupIds.has(s.groupId)) return s
        const nextIndex = (seatIndexByGroup.get(s.groupId) ?? 0) + 1
        seatIndexByGroup.set(s.groupId, nextIndex)
        return { ...s, label: `REG-${nextIndex}` }
      })
    )
  }

  // The fold above can leave a seat map with two separate SeatGroup rows
  // that now share the same label (e.g. an old "General Admission" group
  // and an old "Attendee" group both just became "Regular") — same thing
  // can happen even without that fold, from two old templates applied at
  // different times. AutoAssignDrawer's own "Assign into" picker lists
  // every group with no dedup, so this showed up there as "Regular seats"
  // (or "VIP seats") appearing more than once, not as one clean category.
  // Collapse them here too: the first group per (seatMapId, label) stays
  // canonical, every seat pointing at a later duplicate is repointed to it,
  // and the duplicate rows are dropped. Quotas are summed into the survivor
  // rather than silently discarded.
  const groupsAfterFold = readTable<SeatGroup>('seatGroups')
  const canonicalByKey = new Map<string, SeatGroup>()
  const remap = new Map<string, string>() // duplicate group id -> canonical group id
  for (const g of groupsAfterFold) {
    const key = `${g.seatMapId}::${g.label}`
    const canonical = canonicalByKey.get(key)
    if (!canonical) canonicalByKey.set(key, g)
    else remap.set(g.id, canonical.id)
  }
  if (remap.size > 0) {
    writeTable<SeatGroup>(
      'seatGroups',
      groupsAfterFold
        .filter((g) => !remap.has(g.id))
        .map((g) => {
          const extraQuota = groupsAfterFold
            .filter((d) => remap.get(d.id) === g.id)
            .reduce((sum, d) => sum + d.quota, 0)
          return extraQuota > 0 ? { ...g, quota: g.quota + extraQuota } : g
        })
    )
    writeTable<Seat>(
      'seats',
      readTable<Seat>('seats').map((s) => (remap.has(s.groupId) ? { ...s, groupId: remap.get(s.groupId)! } : s))
    )
  }
}
