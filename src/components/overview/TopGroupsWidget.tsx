import { useMemo } from 'react'
import type { GroupBreakdown } from '../../data/types'
import WidgetCard from './WidgetCard'

export interface TopGroupsWidgetProps {
  groups: GroupBreakdown[]
  onViewAll: () => void
}

// 4, not the whole roster — this sits under Recent check-ins purely to
// fill the leftover width in that row (see OverviewContent's own comment)
// rather than growing into a second Reports tab; "View all" is the real
// place to see every group's full breakdown.
const MAX_SHOWN = 4

// A compact companion to ReportsView's own GroupRow (same checked-in/total
// bar recipe, single segment instead of the full checked-in/no-show/not-
// invited stack — this card is a glance, not the report itself).
export default function TopGroupsWidget({ groups, onViewAll }: TopGroupsWidgetProps) {
  const top = useMemo(() => groups.slice(0, MAX_SHOWN), [groups])

  return (
    <WidgetCard title="Top groups" onViewAll={onViewAll} viewAllLabel="Reports">
      {top.length === 0 ? (
        <p className="text-sm text-muted">No seating groups yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {top.map((g) => {
            const pct = g.total > 0 ? Math.round((g.checkedIn / g.total) * 100) : 0
            return (
              <li key={g.groupLabel} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-ink-900">{g.groupLabel}</span>
                  <span className="shrink-0 text-xs text-muted">
                    <span className="font-semibold text-ink-900">{g.checkedIn}</span>/{g.total} checked in
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-lavender-2">
                  <div
                    className="h-full rounded-full bg-status-confirmed transition-[width] duration-700 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </WidgetCard>
  )
}
