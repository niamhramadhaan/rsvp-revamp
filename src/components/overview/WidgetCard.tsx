import type { ReactNode } from 'react'
import { GLASS_CARD } from './cardChrome'
import { ArrowUpRightIcon } from '../icons/UiIcons'

export interface WidgetCardProps {
  title: string
  /** Omitted entirely skips the "View all" pill — same optionality
   * RecentActivityFeed's own onViewAll already had (it's reused inside the
   * "view all" drawer itself, where there's nowhere further to view all
   * of from). */
  onViewAll?: () => void
  viewAllLabel?: string
  className?: string
  children: ReactNode
}

// The shared "title lives inside the card" widget shell — replaces the
// older convention every glass-card widget on Overview used to hand-roll
// (GuestListMiniWidget, RecentActivityFeed): an `<h3>` + a plain
// `text-accent-700 hover:underline` "View all" link in their own flex row
// SITTING ABOVE a separate `${GLASS_CARD}` div. Reference dashboard's own
// widgets ("Next steps", "Detected") instead treat the title/action as part
// of the same bordered card, at real headline size, with "View all" as a
// pill button rather than a text link — this is that same recipe, pulled
// into one place so every widget that adopts it stays in sync rather than
// three copies of the same header row drifting apart by eye.
export default function WidgetCard({ title, onViewAll, viewAllLabel = 'View all', className = '', children }: WidgetCardProps) {
  return (
    <div className={`rounded-2xl p-5 ${GLASS_CARD} ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-black/5 pb-3">
        <h3 className="font-display text-lg font-semibold text-ink-900 sm:text-xl">{title}</h3>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex shrink-0 items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink-900 transition hover:bg-black/5 active:scale-[0.97]"
          >
            {viewAllLabel}
            <ArrowUpRightIcon className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="pt-4">{children}</div>
    </div>
  )
}
