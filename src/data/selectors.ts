// Pure derived values computed from a Guest array — never separately stored
// counters, so they're always in sync with whatever's in localStorage.

import type { ActivityEntry, ActivityType, Guest, GuestCounts, GroupBreakdown, RawActivityEvent, Seat, SeatGroup } from './types'

// There's no guest-facing RSVP reply anywhere in this app — invites go out
// one-way through NetMessage, nothing ever writes a "yes"/"no" back onto a
// Guest record. "Invited" (at least one channel sent) is the closest real
// signal to "we expect them," so every selector below that used to key off
// a confirmed/declined/pending status keys off this instead.
export function isGuestInvited(guest: Guest): boolean {
  return guest.invites?.wa?.status === 'sent' || guest.invites?.email?.status === 'sent'
}

/** A guest's whole journey collapses to one of three stages — cardChrome.ts's
 * STAGE_TONE is the visual side of this same ladder (avatar rings, status
 * pills, everywhere a guest's "state" needs a single color). Seat assignment
 * is deliberately not part of this ladder — it's orthogonal (a guest can be
 * seated before their invite even goes out, e.g. VIP holds), so it stays its
 * own separate signal (Guest.seatId) wherever it's shown. */
export type GuestStage = 'not_invited' | 'invited' | 'checked_in'

export function getGuestStage(guest: Guest): GuestStage {
  if (guest.checkedInAt) return 'checked_in'
  return isGuestInvited(guest) ? 'invited' : 'not_invited'
}

export function getGuestCounts(guests: Guest[]): GuestCounts {
  const total = guests.length
  const invited = guests.filter(isGuestInvited).length
  const checkedIn = guests.filter((g) => Boolean(g.checkedInAt)).length
  const seatsAssigned = guests.filter((g) => Boolean(g.seatId)).length

  return { total, invited, notInvited: total - invited, checkedIn, seatsAssigned }
}

const ACTIVITY_LABELS: Record<ActivityType, (name: string) => string> = {
  invited_wa: (name) => `${name} was invited via WhatsApp`,
  invited_email: (name) => `${name} was invited via email`,
  seat_assigned: (name) => `${name} was assigned a seat`,
  checked_in: (name) => `${name} checked in`,
}

// Flattens every timestamped guest event (invite sent, seat assigned,
// checked in) into one feed, newest first — no separate activity log to
// keep in sync, it's all derived from the guest records themselves. `limit`
// omitted (or undefined) returns the whole feed, unsliced — used by the
// Overview widget's own "View all" drawer (RecentActivityFeed), which wants
// every entry, not just however many fit the mini-widget's own capped
// preview.
export function getRecentActivity(guests: Guest[], limit?: number): ActivityEntry[] {
  const events: RawActivityEvent[] = []

  for (const g of guests) {
    if (g.invites?.wa?.sentAt) events.push({ type: 'invited_wa', guest: g.name, at: g.invites.wa.sentAt })
    if (g.invites?.email?.sentAt) events.push({ type: 'invited_email', guest: g.name, at: g.invites.email.sentAt })
    if (g.seatAssignedAt) events.push({ type: 'seat_assigned', guest: g.name, at: g.seatAssignedAt })
    if (g.checkedInAt) events.push({ type: 'checked_in', guest: g.name, at: g.checkedInAt })
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  const sliced = limit != null ? events.slice(0, limit) : events
  return sliced.map((e) => ({
    ...e,
    label: ACTIVITY_LABELS[e.type](e.guest),
  }))
}

export function getSeatFillPercent(seats: Seat[]): number {
  if (!seats.length) return 0
  const seatable = seats.filter((s) => s.kind !== 'gap')
  if (!seatable.length) return 0
  const assigned = seatable.filter((s) => s.status === 'assigned').length
  return Math.round((assigned / seatable.length) * 100)
}

// Guest.seatId -> Guest lookup. Needed by both the guest list (show a seat's
// label on a row) and the seat map (know who occupies an assigned seat) —
// there's no such helper anywhere else, only the raw Guest.seatId field.
export function indexGuestsBySeat(guests: Guest[]): Map<string, Guest> {
  const map = new Map<string, Guest>()
  for (const g of guests) if (g.seatId) map.set(g.seatId, g)
  return map
}

// Distinct, trimmed, blank-free values, alphabetically — feeds every
// Role/Organization ComboField's suggestions (AddGuestDrawer, GuestProfile
// Drawer's own edit mode) so a value typed once on any guest becomes a
// quick pick for the next one, without a second stored list to keep in
// sync. Moved here (not left duplicated in each drawer) once a second
// caller needed it.
export function distinctSorted(values: (string | undefined)[]): string[] {
  const set = new Set(values.map((v) => v?.trim()).filter((v): v is string => Boolean(v)))
  return [...set].sort((a, b) => a.localeCompare(b))
}

// Invited but never checked in — the attendance report's headline "did the
// people we reached actually show up" callout.
export function getNoShows(guests: Guest[]): Guest[] {
  return guests.filter((g) => isGuestInvited(g) && !g.checkedInAt)
}

// Checked in without ever being invited — not a data error, a genuine walk-
// up (or simply an invite that never went out before they arrived at the
// door), so it's surfaced as its own callout rather than folded silently
// into "invited" after the fact.
export function getWalkIns(guests: Guest[]): Guest[] {
  return guests.filter((g) => Boolean(g.checkedInAt) && !isGuestInvited(g))
}

// A guest's own "group" is now purely derived from whichever seat they're
// assigned to (see types.ts's Guest doc for why Guest itself no longer
// carries a groupLabel field) — undefined for an unseated guest, since
// there's no seat yet whose SeatGroup could answer that.
export function getGuestGroupLabel(guest: Guest, seatById: Map<string, Seat>, groupById: Map<string, SeatGroup>): string | undefined {
  const seat = guest.seatId ? seatById.get(guest.seatId) : undefined
  return seat ? groupById.get(seat.groupId)?.label : undefined
}

// Rolls guests up by their assigned seat's SeatGroup into the Reports tab's
// per-group breakdown — grouping lives on the seat map now, not a free-text
// guest field (see getGuestGroupLabel above). A guest with no seat yet (or
// whose seat map has no groups) lands under "Unassigned" rather than being
// silently dropped.
export function getGroupBreakdown(guests: Guest[], seats: Seat[], groups: SeatGroup[]): GroupBreakdown[] {
  const seatById = new Map(seats.map((s) => [s.id, s]))
  const groupById = new Map(groups.map((g) => [g.id, g]))
  const byGroup = new Map<string, Guest[]>()
  for (const g of guests) {
    const key = getGuestGroupLabel(g, seatById, groupById) ?? 'Unassigned'
    const list = byGroup.get(key)
    if (list) list.push(g)
    else byGroup.set(key, [g])
  }

  return Array.from(byGroup.entries())
    .map(([groupLabel, list]) => {
      const counts = getGuestCounts(list)
      const noShows = getNoShows(list).length
      const walkIns = getWalkIns(list).length
      return {
        groupLabel,
        total: counts.total,
        invited: counts.invited,
        notInvited: counts.notInvited,
        checkedIn: counts.checkedIn,
        noShows,
        walkIns,
        attendanceRate: counts.invited > 0 ? Math.round((counts.checkedIn / counts.invited) * 100) : 0,
      }
    })
    .sort((a, b) => b.total - a.total)
}
