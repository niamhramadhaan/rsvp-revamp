import { useEffect, useState } from 'react'
import { GLASS_CARD } from './cardChrome'
import { ClockIcon } from '../icons/UiIcons'
import type { Event } from '../../data/types'

export interface EventCountdownWidgetProps {
  event: Event | null
}

interface Countdown {
  days: number
  hours: number
  minutes: number
  isPast: boolean
}

function getCountdown(dateIso: string): Countdown {
  const diffMs = new Date(dateIso).getTime() - Date.now()
  if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0, isPast: true }
  const totalMinutes = Math.floor(diffMs / 60_000)
  return {
    days: Math.floor(totalMinutes / (60 * 24)),
    hours: Math.floor((totalMinutes % (60 * 24)) / 60),
    minutes: totalMinutes % 60,
    isPast: false,
  }
}

// A live, ticking countdown — complements EventBanner's own compact "In N
// days" pill and runway ring (see that file) with something that actually
// keeps counting down minute by minute while this page is open, rather than
// a label computed once per render. Editorial numerals, no ticker/odometer
// animation gimmick — the reference this was picked from ("Live countdown to
// an event... no ticker gimmicks") explicitly steers away from that.
//
// Paired side by side with CheckInProgressRing (see OverviewContent) — both
// are "where things stand right now" gauges, read as one glance together.
// Label/icon on the left, the three numeral groups on the right; flex-wrap
// lets that pair drop to its own line if the card ever gets too narrow for
// both at once.
export default function EventCountdownWidget({ event }: EventCountdownWidgetProps) {
  // Only exists to force a re-render once a minute — getCountdown itself
  // always reads a fresh Date.now(), so the state's actual value is never
  // read, just its identity changing.
  const [, setTick] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  if (!event) return null

  const countdown = getCountdown(event.date)

  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Countdown</h3>
      {/* flex-1 — this card and CheckInProgressRing's own sit in the same
          grid row (see OverviewContent), which stretches both columns to
          the taller one's height; without this, the card itself would still
          size to its own content and leave a mismatched gap below whichever
          one is shorter. */}
      <div className={`flex flex-1 flex-wrap items-center justify-between gap-4 rounded-2xl p-5 ${GLASS_CARD}`}>
        {/* min-w-0 flex-1 — without it this group's own box refuses to
            shrink (flex items default to min-width: auto), so a long event
            name pushes the numerals clean off narrow cards instead of
            truncating. The numerals get shrink-0 for the same reason in
            reverse: digits must never compress. */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-700/10 text-accent-700">
            <ClockIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">{event.name}</p>
            <p className="text-xs text-muted">{countdown.isPast ? 'Already happened' : 'Time until the event'}</p>
          </div>
        </div>

        {!countdown.isPast && (
          <div className="flex shrink-0 items-baseline gap-2.5">
            <CountdownUnit value={countdown.days} label="days" />
            <span className="pb-3.5 font-display text-lg font-bold text-muted/40">:</span>
            <CountdownUnit value={countdown.hours} label="hrs" />
            <span className="pb-3.5 font-display text-lg font-bold text-muted/40">:</span>
            <CountdownUnit value={countdown.minutes} label="min" />
          </div>
        )}
      </div>
    </div>
  )
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-display text-2xl font-bold tabular-nums text-ink-900">{String(value).padStart(2, '0')}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</span>
    </div>
  )
}
