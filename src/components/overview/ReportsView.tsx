import { useMemo } from 'react'
import type { Guest, GroupBreakdown, GuestCounts, Seat, SeatGroup } from '../../data/types'
import { getGuestCounts, getGuestGroupLabel, getGuestStage, getGroupBreakdown, getNoShows, getWalkIns, isGuestInvited } from '../../data/selectors'
import { GLASS_CARD, STAGE_TONE } from './cardChrome'
import GuestAvatar from './GuestAvatar'
import { DownloadIcon } from '../icons/UiIcons'
import { buildCsv, downloadCsv } from '../../utils/csv'
import type { ToastTone } from '../Toast'

export interface ReportsViewProps {
  eventName: string
  guests: Guest[]
  seats: Seat[]
  groups: SeatGroup[]
  onToast: (message: string, tone?: ToastTone) => void
  onViewProfile: (guestId: string) => void
}

function buildGuestsCsv(guests: Guest[], seatLabelById: Map<string, string>, seatById: Map<string, Seat>, groupById: Map<string, SeatGroup>): string {
  const header = [
    'Name',
    'Group',
    'Role',
    'Organization',
    'NetMessage',
    'Email',
    'Invite (NetMessage)',
    'Invite (Email)',
    'Invite status',
    'Seat',
    'Checked in at',
    'Checked in by',
  ]

  const rows = guests.map((g) => [
    g.name,
    getGuestGroupLabel(g, seatById, groupById) ?? '',
    g.role,
    g.organization,
    g.contact.wa,
    g.contact.email,
    g.invites.wa.status,
    g.invites.email.status,
    isGuestInvited(g) ? 'Invited' : 'Not invited',
    g.seatId ? (seatLabelById.get(g.seatId) ?? g.seatId) : '',
    g.checkedInAt ?? '',
    g.checkedInBy ?? '',
  ])

  return buildCsv(header, rows)
}

// Reports is the "after the fact" tab (see plan.md phase 8): who did we
// reach, who actually showed up, who showed up unannounced, and how did each
// guest group do — plus a CSV of the final list. Everything here is derived
// straight from the same Guest[] every other tab reads; there's no separate
// report record to keep in sync. There's no guest-facing RSVP reply anywhere
// in this app (see selectors.ts's isGuestInvited doc) — "invited" is the
// closest real signal to "we expect them," so every metric below keys off
// that instead of a confirmed/declined verdict that never actually happens.
export default function ReportsView({ eventName, guests, seats, groups, onToast, onViewProfile }: ReportsViewProps) {
  const counts = useMemo(() => getGuestCounts(guests), [guests])
  const groupBreakdown = useMemo(() => getGroupBreakdown(guests, seats, groups), [guests, seats, groups])
  const noShows = useMemo(() => getNoShows(guests), [guests])
  const walkIns = useMemo(() => getWalkIns(guests), [guests])
  const seatById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats])
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])
  const seatLabelById = useMemo(() => new Map(seats.map((s) => [s.id, s.label])), [seats])

  function handleExport() {
    if (guests.length === 0) {
      onToast('No guests to export', 'warning')
      return
    }
    const csv = buildGuestsCsv(guests, seatLabelById, seatById, groupById)
    const filename = `${eventName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'event'}-attendance.csv`
    downloadCsv(filename, csv)
    onToast('Attendance report exported')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-semibold text-ink-900">Attendance report</h3>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-2 rounded-xl border border-white/40 bg-white/40 px-3.5 py-2 text-xs font-semibold text-ink-900 transition active:scale-[0.97] hover:bg-white/60"
        >
          <DownloadIcon className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Replaces the earlier 4-tile KpiTile row (Invited/Checked-in/Rate/
          No-shows) with one wide segmented summary bar — Reports is
          inherently a comparison ("who actually showed up, out of who we
          expected"), and GroupRow further down already tells exactly this
          story per SeatGroup with a 3-segment bar; this is that same bar
          and the same 3-way split (see GroupRow's own doc for the
          checked-in/no-show/not-invited math, including why walk-ins get
          subtracted back out of "not invited"), just rolled up to the
          whole event instead of scoped to one group. One clear headline
          number (checked-in over invited, plus the rate) replaces four
          separate boxes competing for the first glance. */}
      <div>
        <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Attendance</h3>
        <AttendanceSummaryBar counts={counts} noShowCount={noShows.length} walkInCount={walkIns.length} />
      </div>

      {walkIns.length > 0 && (
        <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-2xl p-4 ${GLASS_CARD}`}>
          <span className="shrink-0 rounded-full bg-accent-cyan/20 px-2.5 py-1 text-xs font-semibold text-accent-700">
            {walkIns.length}
          </span>
          <p className="text-sm text-ink-900/80">
            walk-in{walkIns.length === 1 ? '' : 's'} checked in without ever being invited —
          </p>
          {walkIns.map((g, i) => (
            <span key={g.id} className="text-sm text-ink-900/80">
              <button
                type="button"
                onClick={() => onViewProfile(g.id)}
                className="font-medium text-ink-900 underline decoration-ink-900/20 underline-offset-2 transition hover:decoration-ink-900/60"
              >
                {g.name}
              </button>
              {i < walkIns.length - 1 ? ',' : ''}
            </span>
          ))}
        </div>
      )}

      <div>
        <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">By group</h3>
        <div className={`flex flex-col divide-y divide-black/5 rounded-2xl p-2 ${GLASS_CARD}`}>
          {groupBreakdown.map((group) => (
            <GroupRow key={group.groupLabel} group={group} />
          ))}
          {groupBreakdown.length === 0 && <p className="p-4 text-sm text-muted">No guests yet.</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <GuestCallout
          title="No-shows"
          subtitle="Invited, but never checked in"
          guests={noShows}
          emptyLabel="No no-shows — everyone invited made it in."
          onViewProfile={onViewProfile}
        />
        <GuestCallout
          title="Walk-ins"
          subtitle="Checked in without ever being invited"
          guests={walkIns}
          emptyLabel="No walk-ins."
          onViewProfile={onViewProfile}
        />
      </div>
    </div>
  )
}

// The whole-event version of GroupRow's own segmented bar just below (same
// checked-in/no-show/not-invited 3-way split, same colors, same walk-ins-
// subtracted-out-of-not-invited math — see that component's own doc) rolled
// up across every group instead of scoped to one. Replaces the earlier row
// of 4 separate KpiTiles (Invited/Checked-in/Rate/No-shows): one headline
// number (checked-in over invited, plus the rate) and one bar tell the same
// "who actually showed up" story GroupRow already tells per group, just
// once at the top for the whole event.
function AttendanceSummaryBar({ counts, noShowCount, walkInCount }: { counts: GuestCounts; noShowCount: number; walkInCount: number }) {
  const total = counts.total || 1
  const attendanceRate = counts.invited > 0 ? Math.round((counts.checkedIn / counts.invited) * 100) : 0
  const notInvitedNotCheckedIn = counts.notInvited - walkInCount
  const segments = [
    // status-confirmed (green), not accent-700 (brand blue) — "checked in"
    // has one canonical color everywhere else in this app (GuestAvatar's
    // ring, CheckInProgressRing, CheckInResultCard, STAGE_TONE's own
    // `checked_in` entry in cardChrome.ts) and this bar was the one place
    // still drawing it in brand blue instead, which read as a fourth status
    // color rather than the same "checked in" everyone already recognizes.
    { key: 'checkedIn', value: counts.checkedIn, colorClass: 'bg-status-confirmed', label: 'Checked-in' },
    { key: 'noShow', value: noShowCount, colorClass: 'bg-status-exception', label: 'No-show' },
    { key: 'notInvited', value: notInvitedNotCheckedIn, colorClass: 'bg-icon-gray', label: 'Not invited' },
  ].filter((s) => s.value > 0)

  return (
    <div className={`rounded-2xl p-5 ${GLASS_CARD}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-display text-2xl font-bold text-ink-900 sm:text-3xl">
          {counts.checkedIn}
          <span className="text-sm font-medium text-muted"> / {counts.invited} invited checked in</span>
        </p>
        <span className="rounded-full bg-status-confirmed/10 px-2.5 py-1 text-xs font-semibold text-status-confirmed">{attendanceRate}% attendance</span>
      </div>

      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-lavender-2">
        {segments.map((s, i) => (
          <div
            key={s.key}
            className={`${s.colorClass} transition-[width] duration-700 ease-out ${i === 0 ? 'rounded-l-full' : ''} ${i === segments.length - 1 ? 'rounded-r-full' : ''}`}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${s.colorClass}`} />
            {s.label} {s.value} ({Math.round((s.value / total) * 100)}%)
          </span>
        ))}
      </div>
    </div>
  )
}

// One group's outcome as a stacked bar (checked-in / no-show / not invited,
// proportional to that group's own total) plus the raw counts below it — the
// "simple bar chart" from plan.md's report spec, scoped per group since
// venues care about section-level fill, not just the event overall. Three
// mutually exclusive segments, not four: there's no RSVP-declined/pending
// concept any more (see selectors.ts's isGuestInvited doc), and walkIns is
// subtracted back out of notInvited so a walk-in (checked in without ever
// being invited) doesn't get counted in both the "Checked in" and "Not
// invited" segments at once.
function GroupRow({ group }: { group: GroupBreakdown }) {
  const total = group.total || 1
  const notInvitedNotCheckedIn = group.notInvited - group.walkIns
  const segments = [
    // Same status-confirmed swap as AttendanceSummaryBar's own segments — see
    // that component's own doc.
    { key: 'checkedIn', value: group.checkedIn, colorClass: 'bg-status-confirmed' },
    { key: 'noShow', value: group.noShows, colorClass: 'bg-status-exception' },
    { key: 'notInvited', value: notInvitedNotCheckedIn, colorClass: 'bg-icon-gray' },
  ].filter((s) => s.value > 0)

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-ink-900">{group.groupLabel}</span>
        <span className="text-xs text-muted">
          <span className="font-semibold text-ink-900">{group.checkedIn}</span> / {group.invited} invited checked in ·{' '}
          {group.attendanceRate}%
        </span>
      </div>

      <div className="flex h-2.5 overflow-hidden rounded-full bg-lavender-2">
        {segments.map((s, i) => (
          <div
            key={s.key}
            className={`${s.colorClass} transition-[width] duration-700 ease-out ${i === 0 ? 'rounded-l-full' : ''} ${i === segments.length - 1 ? 'rounded-r-full' : ''}`}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <span>{group.total} total</span>
        <span>{group.invited} invited</span>
        {group.noShows > 0 && <span className="text-status-exception">{group.noShows} no-show{group.noShows === 1 ? '' : 's'}</span>}
        {group.notInvited > 0 && <span>{group.notInvited} not invited</span>}
      </div>
    </div>
  )
}

// Shared shape for the No-shows/Walk-ins callouts — same avatar+name+org row
// as GuestListMiniWidget, without the status pill (both lists are already
// filtered to one specific outcome, so restating it per-row is noise here).
function GuestCallout({
  title,
  subtitle,
  guests,
  emptyLabel,
  onViewProfile,
}: {
  title: string
  subtitle: string
  guests: Guest[]
  emptyLabel: string
  onViewProfile: (guestId: string) => void
}) {
  return (
    <div>
      <h3 className="font-display text-sm font-semibold text-ink-900">{title}</h3>
      <p className="mb-3 text-xs text-muted">{subtitle}</p>

      <div className={`rounded-2xl p-3 ${GLASS_CARD}`}>
        {guests.length === 0 ? (
          <p className="p-2 text-sm text-muted">{emptyLabel}</p>
        ) : (
          // Capped height + internal scroll — matching GuestListMiniWidget/
          // RecentActivityFeed right next to this tab (both landed on the
          // same max-h-[360px] frame) — an event with a long no-show/walk-in
          // list no longer grows this card past whatever's actually on
          // screen; everyone's still in there, just a scroll away.
          <ul className="no-scrollbar flex max-h-[360px] flex-col gap-1 overflow-y-auto">
            {guests.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => onViewProfile(g.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-black/5"
                >
                  <GuestAvatar name={g.name} imageUrl={g.imageUrl} avatarConfig={g.avatarConfig} sizeClassName="h-9 w-9" ringClassName={STAGE_TONE[getGuestStage(g)].ring} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{g.name}</p>
                    <p className="truncate text-xs text-muted">{g.organization || 'Guest'}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
