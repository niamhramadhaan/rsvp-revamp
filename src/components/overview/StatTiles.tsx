import type { ComponentType, SVGProps } from 'react'
import type { GuestCounts } from '../../data/types'
import { ChairIcon, QrCheckIcon, SendIcon } from '../icons/UiIcons'
import { UserIcon } from '../icons/NavIcons'
import { gradientFromIconText } from './cardChrome'
import KpiTile from './KpiTile'

export interface StatTilesProps {
  counts: GuestCounts
}

// Hero + mini-strip, all four tiles solid — "mostly solid color with a
// watermark" was an explicit request to push past KpiTile's original
// restraint (one accent hero, three plain cream tiles). Checked-in keeps
// its wider hero cell (see KpiTile's own `solid` doc for the gradient/
// watermark recipe itself, shared via cardChrome.ts's gradientFromIconText
// so the hero and the three minis below all read as the same card system
// rather than two different implementations that happen to look similar).
interface MiniStatProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  iconText: string
  value: number
  label: string
}

// A smaller, simpler sibling of KpiTile's own solid variant — same
// gradient-fill + icon-watermark recipe, scaled down (smaller numeral,
// smaller watermark) to fit this row's narrower mini cells, and without
// KpiTile's own count-up/flash/hover-tilt machinery (overkill at this
// size, and these three numbers change together with the hero's own
// animated one right beside them anyway).
function MiniStat({ icon: Icon, iconText, value, label }: MiniStatProps) {
  return (
    <div
      className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl p-4 shadow-sm"
      style={gradientFromIconText(iconText)}
    >
      <Icon
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-3 -right-3 h-16 w-16 text-white opacity-[0.18] transition-[opacity,transform] duration-300 ease-out group-hover:scale-110 group-hover:opacity-[0.28]"
      />
      <div className="relative mt-3">
        <p className="font-display text-2xl font-bold tabular-nums text-white sm:text-3xl">{value}</p>
        <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wide text-white/70">{label}</p>
      </div>
    </div>
  )
}

// Invited / Assigned / Checked-in / Not yet invited — replaces the old
// Invited/Confirmed/Declined/Checked-in row. There's no guest-facing RSVP
// reply anywhere in this app (see selectors.ts's isGuestInvited doc), so
// "Confirmed"/"Declined" never actually moved after a guest was created;
// these four are the real, always-current lifecycle instead.
export default function StatTiles({ counts }: StatTilesProps) {
  const attendanceRate = counts.invited > 0 ? Math.round((counts.checkedIn / counts.invited) * 100) : 0

  return (
    <div>
      <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Key metrics</h3>

      {/* sm:grid-cols-5 — hero takes 2 of 5 (≈40%), the mini-strip's own
          3-up grid takes the remaining 3 (≈60%, ≈20% per cell) — matching
          proportions to the reference this layout was picked from, not an
          even 50/50 split that would make the hero read as just a
          differently-colored fourth tile again. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:items-stretch">
        {/* Checked-in — same accent-700 hue as CheckInProgressRing below it,
            reinforcing that they're the same concept at two zoom levels.
            solid (see KpiTile's own doc) + the widest cell in the row is
            what actually makes it read as this row's headline now, not just
            a fill-color difference. Attendance rate moves from a corner
            badge into a plain caption line under the label — there's room
            for it to just be read, not squeezed into a pill. */}
        <KpiTile
          icon={QrCheckIcon}
          iconWash="bg-accent-700/10"
          iconText="text-accent-700"
          value={counts.checkedIn}
          label="Checked-in"
          glyphColor="text-accent-700"
          solid
          className="h-full sm:col-span-2"
        >
          {counts.invited > 0 && <p className="relative mt-1.5 text-sm font-medium text-white/75">{attendanceRate}% attendance</p>}
        </KpiTile>

        <div className="grid grid-cols-3 gap-3 sm:col-span-3">
          {/* Invited — neutral reach metric, not good/bad; ink-900 (this
              app's own dark neutral) rather than a status hue, since it
              isn't one. */}
          <MiniStat icon={UserIcon} iconText="text-ink-900" value={counts.invited} label="Invited" />

          {/* Assigned — a seating fact, not an invite/attendance one (a VIP
              hold can be seated before their invite even goes out) — cyan,
              the same "structural/logistics" hue QuickActionsPanel's own
              intake action uses, keeps it visually apart from both. */}
          <MiniStat icon={ChairIcon} iconText="text-accent-cyan" value={counts.seatsAssigned} label="Assigned" />

          {/* Not yet invited — the actionable backlog, not a status
              verdict: routine pre-event amber (status-pending), same tone
              Reports' own "pending" chips use for an ordinary waiting
              state. */}
          <MiniStat icon={SendIcon} iconText="text-status-pending" value={counts.notInvited} label="Not yet invited" />
        </div>
      </div>
    </div>
  )
}
