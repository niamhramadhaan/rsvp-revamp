import type { Guest } from '../../data/types'
import { getGuestStage } from '../../data/selectors'
import { STAGE_TONE } from './cardChrome'
import GuestAvatar from './GuestAvatar'
import WidgetCard from './WidgetCard'

export interface GuestListMiniWidgetProps {
  guests: Guest[]
  onViewAll: () => void
  onViewProfile: (guestId: string) => void
}

// The latest of whichever real, timestamped things have happened to this
// guest — checked in, seated, or invited on either channel. Replaces the old
// respondedAt-based sort (there's no guest-facing reply anywhere in this
// app — see selectors.ts's isGuestInvited doc).
function lastActivityAt(guest: Guest): number {
  return Math.max(
    new Date(guest.checkedInAt ?? 0).getTime(),
    new Date(guest.seatAssignedAt ?? 0).getTime(),
    new Date(guest.invites.wa.sentAt ?? 0).getTime(),
    new Date(guest.invites.email.sentAt ?? 0).getTime()
  )
}

export default function GuestListMiniWidget({ guests, onViewAll, onViewProfile }: GuestListMiniWidgetProps) {
  // 20, not 5 — this list now scrolls inside a fixed-height card below
  // instead of being capped short, so there's room to show more than a
  // handful before "View all" is the only way to see further down the roster.
  const recent = [...guests].sort((a, b) => lastActivityAt(b) - lastActivityAt(a)).slice(0, 20)

  return (
    <WidgetCard title="Guests" onViewAll={onViewAll}>
      <ul className="no-scrollbar flex max-h-[360px] flex-col gap-2 overflow-y-auto">
        {recent.map((g) => {
          const tone = STAGE_TONE[getGuestStage(g)]
          return (
            <li
              key={g.id}
              role="button"
              tabIndex={0}
              onClick={() => onViewProfile(g.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onViewProfile(g.id)
                }
              }}
              className="flex cursor-pointer items-center gap-3.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-black/5"
            >
              {/* Photo when this guest has one, a name-generated avatar
                  otherwise (see GuestAvatar), ringed by guest stage
                  (STAGE_TONE) — same two-signal split as every other
                  guest avatar in the app. Whole row opens the guest's
                  profile (same drawer GuestSeatingList's avatar opens) —
                  there's no second action competing for this row's click
                  the way there is in the full list (seat assignment), so
                  it doesn't need a nested stopPropagation() button here. */}
              <div aria-hidden="true">
                <GuestAvatar name={g.name} imageUrl={g.imageUrl} avatarConfig={g.avatarConfig} sizeClassName="h-10 w-10" ringClassName={tone.ring} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">{g.name}</p>
                <p className="truncate text-xs text-muted">{g.organization || 'Guest'}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${tone.wash} ${tone.text}`}>
                {tone.label}
              </span>
            </li>
          )
        })}
        {recent.length === 0 && <p className="text-sm text-muted">No guests yet.</p>}
      </ul>
    </WidgetCard>
  )
}
