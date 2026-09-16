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

  // Idle liveliness — one random avatar wiggles at a time, on a random
  // interval, so the row isn't perfectly still between real check-ins.
  // Deliberately not "all of them" and not on a fixed beat: a synchronized
  // or metronomic loop reads as a UI glitch, one avatar taking its turn at
  // an irregular pace reads as alive. Off entirely under
  // prefers-reduced-motion, and paused whenever the tab isn't visible so
  // it isn't burning cycles in a background tab.
  const [wigglingId, setWigglingId] = useState<string | null>(null)
  useEffect(() => {
    if (recentCheckins.length === 0) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    let cancelled = false
    let clearTimer: ReturnType<typeof window.setTimeout> | undefined
    let nextTimer: ReturnType<typeof window.setTimeout> | undefined

    function scheduleNext() {
      const delay = 2200 + Math.random() * 3600
      nextTimer = window.setTimeout(() => {
        if (cancelled || document.hidden) {
          scheduleNext()
          return
        }
        const guest = recentCheckins[Math.floor(Math.random() * recentCheckins.length)]
        setWigglingId(guest.id)
        clearTimer = window.setTimeout(() => {
          if (!cancelled) setWigglingId(null)
        }, 600)
        scheduleNext()
      }, delay)
    }

    scheduleNext()
    return () => {
      cancelled = true
      window.clearTimeout(nextTimer)
      window.clearTimeout(clearTimer)
    }
  }, [recentCheckins])

  return (
    <WidgetCard title="Recent check-ins">
      {recentCheckins.length === 0 ? (
        <p className="text-sm text-muted">No one's checked in yet.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {recentCheckins.map((g, i) => {
            const isLive = liveIds.has(g.id)
            const isWiggling = !isLive && wigglingId === g.id
            return (
              <Tooltip key={g.id} label={`${g.name} · ${timeAgo(g.checkedInAt)}`} hoverOnly>
                <button
                  type="button"
                  onClick={() => onViewProfile(g.id)}
                  aria-label={`View ${g.name}'s profile`}
                  className="relative block h-14 w-14 shrink-0 rounded-full transition active:scale-[0.93]"
                  style={{ animation: `stagger-in 380ms ease-out ${Math.min(i, 8) * 40}ms both` }}
                >
                  {/* The photo/illustration is the only layer that ever
                      moves — clipped to the circle (overflow-hidden) so a
                      bounce or wiggle never visually pokes past its own
                      frame — while the status ring below lives on its own
                      static layer, outside this clip, that never carries an
                      animation itself. Two separate elements instead of one
                      (GuestAvatar's own ringClassName, which paints the ring
                      on the same element that moves) is what keeps the ring
                      reading as a fixed frame while the photo inside it
                      does something.
                      checkin-bob — the same finite (not looping) "just
                      happened" flourish CheckInResultCard already plays on
                      a successful scan, reused here instead of a
                      continuously-running float: this app's own stated
                      rule (see index.css's own check-in keyframe doc) is
                      that a perpetually-looping animation is a real,
                      ongoing cost, reserved for the couple of cases that
                      communicate a genuinely ongoing state — a fresh
                      check-in isn't one, it's a moment, so it gets a
                      moment's worth of motion and then rests. */}
                  <span className="absolute inset-0 block overflow-hidden rounded-full">
                    <span
                      className="block h-full w-full"
                      style={
                        isLive
                          ? { animation: 'checkin-bob 700ms ease-in-out 2' }
                          : isWiggling
                            ? { animation: 'idle-avatar-wiggle 600ms ease-in-out' }
                            : undefined
                      }
                    >
                      <GuestAvatar name={g.name} imageUrl={g.imageUrl} avatarConfig={g.avatarConfig} sizeClassName="h-14 w-14" />
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-0 rounded-full ring-2 ring-inset ${STAGE_TONE.checked_in.ring}`}
                  />
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
