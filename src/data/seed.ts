// Hand-written mock fixtures for local dev/demo — seeded into localStorage
// once (see store.ts#seedIfEmpty) so the Overview page has real-ish variety
// to render instead of empty states on first load.
import { genId } from './store'
import { generateInviteCode } from './guests'
import { buildBanquetTables, TEMPLATE_ORIGIN_X, TEMPLATE_ORIGIN_Y } from './seatMapTemplates'
import type {
  AppUser,
  Event,
  Guest,
  InviteChannelStatus,
  LayoutBlock,
  Seat,
  SeatGroup,
  SeatMap,
} from './types'

// Bump whenever the fixture *content* below changes in a way an
// already-seeded browser should actually pick up — a different event, a
// different guest roster, and so on. `seedIfEmpty` (store.ts) only ever
// seeds a table that's never existed, so without this, a browser that ran
// this app before a content change would stay stuck on stale fixtures
// forever, no matter how this file changes afterward. init.ts wipes and
// fully reseeds every table whenever the stored version doesn't match this
// one — a NEW field on an existing row is a different case (that's
// init.ts#migrateSchema's job, additive-only, no version bump needed).
export const SEED_VERSION = 5

const EVENT_1_ID = 'evt_meetup'
const EVENT_2_ID = 'evt_anniversary'
const SEATMAP_1_ID = 'sm_meetup'
const GROUP_VIP_ID = 'grp_vip'
const GROUP_REG_ID = 'grp_regular'

export const SEED_EVENTS: Event[] = [
  {
    id: EVENT_1_ID,
    name: 'MiniCinema Product Release Press Conference',
    date: '2026-09-19T18:00:00',
    venue: 'Grand Cakrawala Convention Center, Jakarta',
    // Sudirman Central Business District, Jakarta — a real, plausible pin
    // for this fictional venue's own address (Jl. Jenderal Sudirman Kav.
    // 52-53), now that VenueField's real pin replaces the old free-text
    // address/mapUrl pair (see types.ts's Event doc).
    lat: -6.2244,
    lng: 106.809,
    description:
      "The official unveiling of MiniCinema — Gamefinity's next flagship product — for press, partners, and industry leaders.",
    status: 'live',
    createdAt: '2026-08-10T09:00:00',
  },
  {
    id: EVENT_2_ID,
    name: 'Gamefinity Anniversary Party',
    date: '2026-11-14T19:00:00',
    venue: 'The Kasablanka Hall, Jakarta',
    // Kota Kasablanka, Jakarta — the real venue this fictional hall is named
    // after.
    lat: -6.2242,
    lng: 106.8412,
    description: "Celebrating Gamefinity's second anniversary with the whole community.",
    status: 'live',
    createdAt: '2026-08-12T09:00:00',
  },
]

export const SEED_SEATMAPS: SeatMap[] = [
  { id: SEATMAP_1_ID, eventId: EVENT_1_ID, rows: 0, columns: 0, labelScheme: 'group-sequence' },
]

// The default seat map IS the banquet template's own build (see
// seatMapTemplates.ts's buildBanquetTables) — one source of geometry, not
// a second hand-rolled layout next to it. Six rectangular tables, six
// chairs each; the table nearest the stage is VIP, everything else
// Regular — the same "closest to the front is VIP" convention the
// template itself uses when applied later.
const BANQUET = buildBanquetTables()

const STAGE_BLOCK_ID = 'blk_stage'

export const SEED_LAYOUT_BLOCKS: LayoutBlock[] = [
  {
    id: STAGE_BLOCK_ID,
    seatMapId: SEATMAP_1_ID,
    kind: 'stage',
    x: BANQUET.stage.x + TEMPLATE_ORIGIN_X,
    y: BANQUET.stage.y + TEMPLATE_ORIGIN_Y,
    width: BANQUET.stage.width,
    height: BANQUET.stage.height,
    label: 'Stage',
  },
  ...BANQUET.tables.map((table, i) => ({
    id: `blk_table_${i}`,
    seatMapId: SEATMAP_1_ID,
    ...table,
    x: table.x + TEMPLATE_ORIGIN_X,
    y: table.y + TEMPLATE_ORIGIN_Y,
  })),
]

// Quotas match the banquet's actual chair counts (6 VIP off the front
// table, 30 Regular everywhere else) — a sensible starting default,
// though quota is deliberately a separate number from "how many physical
// seats exist for this group" (see the SeatGroup.quota comment in
// types.ts): editable from event details independent of the seat map.
export const SEED_SEAT_GROUPS: SeatGroup[] = [
  { id: GROUP_VIP_ID, seatMapId: SEATMAP_1_ID, label: 'VIP', color: '#0060A8', quota: 6 },
  { id: GROUP_REG_ID, seatMapId: SEATMAP_1_ID, label: 'Regular', color: '#3CA8D8', quota: 30 },
]

// Grid-spacing constant for migrateSchema's own x/y backfill (see
// init.ts) — a leftover from when the seed itself was a painted grid;
// kept exported so that migration doesn't need its own copy of the
// constant.
export const SEED_SEAT_SPACING = 52

// Every chair starts empty — the default preview is an untouched banquet,
// no guest assigned anywhere. Labels are frozen group-sequence numbers
// ("VIP-1".."VIP-6", "REG-1".."REG-30").
export const SEED_SEATS: Seat[] = (() => {
  const seats: Seat[] = []
  let vipSeq = 0
  let regSeq = 0
  BANQUET.seatPositionsByTable.forEach((positions, tableIndex) => {
    const isVip = tableIndex === 0
    const groupId = isVip ? GROUP_VIP_ID : GROUP_REG_ID
    const tableBlockId = `blk_table_${tableIndex}`
    for (const pos of positions) {
      const label = isVip ? `VIP-${++vipSeq}` : `REG-${++regSeq}`
      seats.push({
        id: genId('seat'),
        seatMapId: SEATMAP_1_ID,
        groupId,
        row: tableIndex,
        column: isVip ? vipSeq - 1 : regSeq - 1,
        x: pos.x + TEMPLATE_ORIGIN_X,
        y: pos.y + TEMPLATE_ORIGIN_Y,
        label,
        kind: 'seat',
        status: 'empty',
        tableBlockId,
      })
    }
  })
  return seats
})()

/** Shape of one hand-authored guest fixture, before it's expanded into a
 * full Guest record below. No seat field any more — the default roster
 * arrives entirely unseated (see SEED_SEATS' own doc); seating happens
 * afterward, on the seat map, not in the fixtures. */
interface GuestDef {
  name: string
  role: string
  org: string
  /** Kept on this fixture purely so the table below stays self-documenting
   * without having to guess which rows are meant to read as VIP. */
  group: 'VIP' | 'Regular'
  wa: InviteChannelStatus | null
  email: InviteChannelStatus | null
  checkedIn: boolean
}

// Guest roster for the press conference. VIP slots are real, well-known
// Indonesian conglomerate leaders and their real groups (public knowledge —
// who runs what is reported business-press fact) since that's the specific
// "konglomerat" flavor requested; contact details are still fully fake
// placeholders (+62 812-xxxx-xxxx / @example.com), same as everyone else —
// only the name/title/group are real, nothing else about them is. Press/
// media (Regular) stay fictional, same as before: attaching invented RSVP/
// attendance data to a real named journalist (a private-ish professional,
// not a public business figure) sits less comfortably than doing so for a
// billionaire whose public persona already centers on business dealings.
// Deliberately varied invite/RSVP/seat/check-in combinations so every
// Overview widget has real spread to render.
const GUEST_DEFS: GuestDef[] = [
  { name: 'Chairul Tanjung', role: 'Chairman', org: 'CT Corp', group: 'VIP', wa: 'sent', email: 'sent', checkedIn: true },
  { name: 'Anthoni Salim', role: 'Chairman & CEO', org: 'Salim Group', group: 'VIP', wa: 'sent', email: 'sent', checkedIn: true },
  { name: 'Garibaldi "Boy" Thohir', role: 'President Director', org: 'Adaro Energy', group: 'VIP', wa: 'sent', email: null, checkedIn: false },
  { name: 'Hary Tanoesoedibjo', role: 'Chairman', org: 'MNC Group', group: 'VIP', wa: 'sent', email: 'sent', checkedIn: false },
  { name: 'Jack Kurniawan Susanto', role: 'Editor-in-Chief', org: 'Warta Cakrawala', group: 'VIP', wa: null, email: 'sent', checkedIn: false },
  { name: 'James Riady', role: 'Chief Executive Officer', org: 'Lippo Group', group: 'VIP', wa: 'sent', email: 'sent', checkedIn: false },
  { name: 'R. Budi Hartono', role: 'Co-Founder', org: 'Djarum Group', group: 'VIP', wa: 'sent', email: 'sent', checkedIn: true },
  { name: 'Prajogo Pangestu', role: 'Founder & Chairman', org: 'Barito Pacific Group', group: 'VIP', wa: 'sent', email: null, checkedIn: false },
  { name: 'Low Tuck Kwong', role: 'President Director', org: 'Bayan Resources', group: 'VIP', wa: 'sent', email: 'sent', checkedIn: false },
  { name: 'Franky Oesman Widjaja', role: 'Chairman', org: 'Sinar Mas Group', group: 'VIP', wa: null, email: 'sent', checkedIn: false },
  { name: 'Dato Sri Tahir', role: 'Founder & Chairman', org: 'Mayapada Group', group: 'VIP', wa: 'sent', email: 'sent', checkedIn: false },
  { name: 'Sri Prakash Lohia', role: 'Chairman', org: 'Indorama Corporation', group: 'VIP', wa: 'sent', email: 'sent', checkedIn: true },
  { name: 'Carmen Wulandari Halim', role: 'Senior Reporter', org: 'Nusantara Post', group: 'Regular', wa: 'sent', email: null, checkedIn: true },
  { name: 'Mike Prasetyo Susilo', role: 'Vice President', org: 'PT Anugerah Sejati Makmur', group: 'Regular', wa: 'sent', email: 'sent', checkedIn: false },
  { name: 'Nadia Pratama Wijaya', role: 'Managing Editor', org: 'Media Kencana Group', group: 'Regular', wa: 'sent', email: 'sent', checkedIn: false },
  { name: 'Farhan Saputra Lim', role: 'Producer', org: 'Cerlang TV', group: 'Regular', wa: null, email: null, checkedIn: false },
  { name: 'Bella Anggraini Kusumo', role: 'Corporate Secretary', org: 'PT Sentosa Abadi Perkasa', group: 'Regular', wa: 'sent', email: 'sent', checkedIn: false },
  { name: 'Dimas Wibisono Wongso', role: 'Reporter', org: 'Kabar Nusantara', group: 'Regular', wa: 'sent', email: null, checkedIn: false },
  { name: 'Rina Suryani Tandean', role: 'Finance Director', org: 'PT Kencana Wijaya Group', group: 'Regular', wa: 'sent', email: 'sent', checkedIn: false },
  { name: 'Oscar Hidayat Setiawan', role: 'Editor', org: 'Berita Sentosa', group: 'Regular', wa: null, email: 'sent', checkedIn: false },
  { name: 'Kevin Susanto Halim', role: 'Correspondent', org: 'Warta Nusantara Daily', group: 'Regular', wa: 'sent', email: null, checkedIn: false },
  { name: 'Ayu Lestari Wijaya', role: 'Marketing Director', org: 'PT Cahaya Abadi Sentosa', group: 'Regular', wa: 'sent', email: 'sent', checkedIn: false },
  // Never invited (no channel sent), but checked in anyway — the seed's one
  // real walk-in example, so ReportsView's Walk-ins callout has something
  // to show instead of always rendering its empty state.
  { name: 'Bagas Nugroho Tanjung', role: 'Photographer', org: 'Media Cakrawala Post', group: 'Regular', wa: null, email: null, checkedIn: true },
]

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-09-05T10:00:00').getTime()
const daysAgo = (n: number) => new Date(now - n * DAY).toISOString()

export const SEED_GUESTS: Guest[] = (() => {
  // Claimed in order, so two similar names/numbers in this same roster
  // can't land the same code (see generateInviteCode's own doc).
  const takenTokens = new Set<string>()
  return GUEST_DEFS.map((def, i) => {
    const slug = def.name.toLowerCase().replace(/\s+/g, '.')
    const wa = def.wa ? `+62 812-${1000 + i}-${5000 + i}` : ''
    const email = def.email ? `${slug}@example.com` : ''
    const token = generateInviteCode(def.name, wa, email, takenTokens)
    takenTokens.add(token)

    return {
      id: genId('gst'),
      eventId: EVENT_1_ID,
      name: def.name,
      contact: { wa, email },
      role: def.role,
      organization: def.org,
      token,
      // Unseated across the whole roster (see SEED_SEATS' own doc) — even
      // the checked-in rows: they read as door check-ins without a prior
      // assignment, the same shape a walk-in already has.
      seatId: null,
      seatAssignedAt: null,
      invites: {
        wa: { status: def.wa ?? 'not_sent', sentAt: def.wa ? daysAgo(18 - i * 0.4) : null },
        email: { status: def.email ?? 'not_sent', sentAt: def.email ? daysAgo(18 - i * 0.4) : null },
      },
      checkedInAt: def.checkedIn ? daysAgo(0.2 + i * 0.02) : null,
      checkedInBy: def.checkedIn ? 'Staff Desk 1' : null,
      status: 'active',
    }
  })
})()

// Demo sign-in accounts for the login gate (see session.ts) — one per role,
// so both the full Admin dashboard and the scoped Staff (check-in only)
// experience are one login away. Passwords are plaintext mock data, same as
// every other field in this app (see AppUser's own doc): there is no real
// auth, this only exists so a reviewer can get past the gate.
export const SEED_USERS: AppUser[] = [
  {
    id: 'usr_admin',
    name: 'William Jacobson',
    email: 'admin@gamefinity.id',
    password: 'admin123',
    role: 'admin',
    eventIds: [],
  },
  {
    id: 'usr_staff',
    name: 'Sinta Maharani',
    email: 'staff@gamefinity.id',
    password: 'staff123',
    role: 'staff',
    eventIds: [EVENT_1_ID],
  },
]
