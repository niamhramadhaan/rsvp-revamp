import { GLASS_CARD } from './cardChrome'

export interface CheckInProgressRingProps {
  checkedIn: number
  total: number
}

// A 270° gauge, not a plain full ring — the gap at the bottom is the
// standard speedometer opening (rotate(135deg) around the circle's center,
// combined with a dasharray that only draws 75% of the circumference — the
// usual SVG trick for a "3/4 gauge," not a bespoke arc-path computation).
// One solid brand-blue arc on a neutral rail (the same accent-700 +
// tabular display numerals StatTiles' own hero tile uses for this exact
// concept at a different zoom level) — deliberately NOT the old
// declined-red → pending-amber → confirmed-green sweep along its length:
// those hues mean settled outcomes elsewhere in this app, and painting all
// three onto one arc claimed three meanings for a single number. A small
// pulsing head marker sits at the current value's angle, like a live
// needle tip.
//
// Three separate top-level groups (ring, count, remaining), not the ring+
// count nested together they used to be — flex-wrap lets them spread evenly
// across whatever width this card actually gets (a full row on its own at
// one point, now paired side by side with EventCountdownWidget — see
// OverviewContent), wrapping to a second line rather than squeezing three
// groups edge to edge if that width ever gets tight.
export default function CheckInProgressRing({ checkedIn, total }: CheckInProgressRingProps) {
  const pct = total > 0 ? Math.round((checkedIn / total) * 100) : 0
  const remaining = Math.max(total - checkedIn, 0)
  const r = 42
  const circumference = 2 * Math.PI * r
  const sweep = 0.75 * circumference // the visible 270° of track; the other 90° is the gauge's open gap
  const trackDasharray = `${sweep} ${circumference}`
  const progressDasharray = `${sweep * (pct / 100)} ${circumference}`

  // Head marker position — parametrized the same way a <circle>'s own path
  // starts (angle 0 = 3 o'clock, sweeping clockwise as the dasharray
  // reveals it), so it lands correctly once the shared `rotate(135 50 50)`
  // group below carries both it and the arc to the gauge's real
  // orientation — no separate angle offset to keep in sync by hand.
  const headAngle = (pct / 100) * 270
  const headRad = (headAngle * Math.PI) / 180
  const headX = 50 + r * Math.cos(headRad)
  const headY = 50 + r * Math.sin(headRad)

  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Check-in progress</h3>

      {/* flex-1 — see EventCountdownWidget's own doc: both cards share a
          grid row that stretches to the taller one's height, so this one
          needs to grow into that height too instead of sizing to content. */}
      <div className={`flex flex-1 flex-wrap items-center justify-between gap-6 rounded-2xl p-5 ${GLASS_CARD}`}>
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
          <svg viewBox="0 0 100 100" className="h-28 w-28">
            <g transform="rotate(135 50 50)">
              <circle
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke="var(--color-rail)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={trackDasharray}
              />
              <circle
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke="var(--color-accent-700)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={progressDasharray}
                className="transition-[stroke-dasharray] duration-700 ease-out"
              />
              {pct > 0 && (
                <>
                  {/* A finite-looking but actually `infinite` pulse — same
                      exception QrScanner's own scan-line already carries
                      (see index.css): this communicates a real ongoing
                      state (check-in is still live) for as long as the
                      widget is on screen, not decoration on inert
                      content. prefers-reduced-motion's blanket override in
                      index.css still clamps this like everything else. */}
                  <circle cx={headX} cy={headY} r="6" fill="var(--color-accent-700)" opacity="0.35">
                    <animate attributeName="r" values="6;11;6" dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.35;0;0.35" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={headX} cy={headY} r="4.5" fill="white" stroke="var(--color-accent-700)" strokeWidth="2.5" />
                </>
              )}
            </g>
          </svg>
          <span className="absolute font-display text-xl font-bold text-ink-900">{pct}%</span>
        </div>

        <div className="min-w-0">
          <p className="font-display text-2xl font-bold text-ink-900">
            {checkedIn}
            <span className="text-muted"> / {total}</span>
          </p>
          <p className="text-xs text-muted">guests checked in so far</p>
        </div>

        {/* Dashed border, not a status color: "remaining" (total - checkedIn)
            includes confirmed guests who simply haven't arrived yet — a
            different concept from RSVP-status "pending" (never responded).
            Recoloring this status-pending would be a color-meaning
            collision, so it signals "open/incomplete" structurally instead.
            Always shown now (used to hide below sm: when it was squeezed
            next to the ring in a shared half-width column) — a full-width
            row has the room for all three groups at any width. */}
        <div className="shrink-0 rounded-xl border border-dashed border-cream/60 bg-cream/40 px-4 py-3 text-center">
          <p className="font-display text-xl font-bold text-ink-900">{remaining}</p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Remaining</p>
        </div>
      </div>
    </div>
  )
}
