import { useEffect, useMemo, useRef, useState } from 'react'
import type { Guest } from '../../data/types'
import { STAGE_TONE } from './cardChrome'
import GuestAvatar from './GuestAvatar'
import WidgetCard from './WidgetCard'
import Tooltip from '../Tooltip'

export interface RecentCheckinsWidgetProps {
  guests: Guest[]
  onViewProfile: (guestId: string) => void
}

// Enough to fill a wide card's own wrap without turning into an
// unbounded, ever-growing queue — this is a "who's here right now" glance,
// not the full roster (GuestListMiniWidget/GuestsView already cover that).
const MAX_SHOWN = 18

// Matches RecentActivityFeed's own "just happened" window — long enough to
// catch the eye, short enough that it isn't still lit half a minute later.
const LIVE_HIGHLIGHT_MS = 2200

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

// A queue of guest avatars, most-recent-first, in place of a row of text —
// this app's other two Overview widgets (GuestListMiniWidget,
// RecentActivityFeed) are both lists of rows; this one is deliberately
// avatar-forward, "who's actually here right now" at a glance rather than a
// log to scan. Every avatar still opens that guest's own profile (the same
// onViewProfile every other avatar in this app already wires up), so it's
// a real navigation surface, not a decorative strip.
export default function RecentCheckinsWidget({ guests, onViewProfile }: RecentCheckinsWidgetProps) {
  const recentCheckins = useMemo(
    () =>
      guests
        .filter((g): g is Guest & { checkedInAt: string } => Boolean(g.checkedInAt))
        .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime())
        .slice(0, MAX_SHOWN),
    [guests]
  )

  // Which guests arrived after this widget's first render — same
  // "seen-keys" tracking RecentActivityFeed's own liveKeys uses, so a
  // brand-new check-in (not just a plain remount/scroll-back) is what
  // earns the entrance flourish below, not every avatar on every render.
  const [liveIds, setLiveIds] = useState<Set<string>>(() => new Set())
  const seenIdsRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    const currentIds = new Set(recentCheckins.map((g) => g.id))
    const seen = seenIdsRef.current
    if (seen) {
      const freshlyArrived = [...currentIds].filter((id) => !seen.has(id))
      if (freshlyArrived.length > 0) {
        setLiveIds(new Set(freshlyArrived))
        const timer = setTimeout(() => setLiveIds(new Set()), LIVE_HIGHLIGHT_MS)
        seenIdsRef.current = currentIds
        return () => clearTimeout(timer)
      }
    }
    seenIdsRef.current = currentIds
    return undefined
  }, [recentCheckins])

  return (
    <WidgetCard title="Recent check-ins">
      {recentCheckins.length === 0 ? (
        <p className="text-sm text-muted">No one's checked in yet.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {recentCheckins.map((g, i) => {
            const isLive = liveIds.has(g.id)
            return (
              <Tooltip key={g.id} label={`${g.name} · ${timeAgo(g.checkedInAt)}`} hoverOnly>
                <button
                  type="button"
                  onClick={() => onViewProfile(g.id)}
                  aria-label={`View ${g.name}'s profile`}
                  className="relative shrink-0 rounded-full transition active:scale-[0.93]"
                  style={{ animation: `stagger-in 380ms ease-out ${Math.min(i, 8) * 40}ms both` }}
                >
                  {/* checkin-bob — the same finite (not looping) "just
                      happened" flourish CheckInResultCard already plays on
                      a successful scan, reused here instead of a
                      continuously-running float: this app's own stated
                      rule (see index.css's own check-in keyframe doc) is
                      that a perpetually-looping animation is a real,
                      ongoing cost, reserved for the couple of cases that
                      communicate a genuinely ongoing state — a fresh
                      check-in isn't one, it's a moment, so it gets a
                      moment's worth of motion and then rests. */}
                  <span
                    className="block"
                    style={isLive ? { animation: 'checkin-bob 700ms ease-in-out 2' } : undefined}
                  >
                    <GuestAvatar
                      name={g.name}
                      imageUrl={g.imageUrl}
                      avatarConfig={g.avatarConfig}
                      sizeClassName="h-14 w-14"
                      ringClassName={STAGE_TONE.checked_in.ring}
                    />
                  </span>
                  {isLive && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-status-confirmed"
                      style={{ animation: 'checkin-ring 900ms ease-out' }}
                    />
                  )}
                </button>
              </Tooltip>
            )
          })}
        </div>
      )}
    </WidgetCard>
  )
}
