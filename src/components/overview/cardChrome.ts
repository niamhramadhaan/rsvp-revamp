import type { GuestStage } from '../../data/selectors'

// Shared visual primitives for the overview cards — a values module, not a
// component wrapper. Most cards below still use the plain glass shell
// (they're lists/containers, not single-identity stat cards), so this just
// centralizes the literal that used to be copy-pasted across 7 files.
export const GLASS_SHADOW = 'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_30px_-12px_rgba(16,30,51,0.3)]'
// Deliberately no rounding class here — callers use different radii
// (rounded-2xl for most cards, rounded-3xl for a couple of larger ones), so
// each call site appends its own rounded-* alongside this.
//
// border-cream/bg-cream (not white) — every glass card in the app shares
// this one recipe, so this is the single edit that carries the "warm card
// on cool page" fix to all of them at once, rather than re-tinting each
// call site by hand.
export const GLASS_CARD = `border border-cream/40 bg-cream/20 ${GLASS_SHADOW}`

// The "frosted photo strip" mask — EventBanner blurs a cropped duplicate of
// its own photo (never backdrop-blur — see its own doc for the per-frame
// resample cost that avoids) and reveals it only from about halfway down,
// ramping to fully opaque near the bottom text, instead of a hard-edged crop
// window. GuestsView's own roster cards used to do the same thing (repeated
// per card, up to 18 at once) but dropped it in favor of a plain gradient —
// see GuestRosterCard's own doc for why that per-card blur cost, not this
// mask itself, was the actual problem.
//
// Four stops, not two — the original's linear 45%→75% ramp read as a
// visible straight-line seam where the blur "starts," rather than a true
// gradual reveal. A slow easing curve (an almost-flat start, steepening
// through the middle, easing back out near full opacity — the same
// "S-curve," not linear" idea any eased CSS transition already uses)
// approximated with two extra midpoint stops instead of relying on a plain
// two-stop linear-gradient, which can only ever ramp at a constant rate.
export const FROST_MASK =
  'linear-gradient(to bottom, transparent 0%, transparent 40%, rgba(0,0,0,0.15) 52%, rgba(0,0,0,0.55) 66%, black 82%)'

// One source of truth for "what does this guest's stage look like" — every
// status pill and (via `ring`) every guest avatar's status ring reads this,
// so they always agree. Replaces the old RSVP-status-keyed STATUS_TONE
// (confirmed/declined/pending) — there's no guest-facing reply anywhere in
// this app, so that status never actually changed after creation; see
// selectors.ts's GuestStage doc for what replaced it.
export const STAGE_TONE: Record<GuestStage, { wash: string; text: string; solid: string; ring: string; label: string }> = {
  not_invited: { wash: 'bg-black/5', text: 'text-muted', solid: 'bg-icon-gray', ring: 'ring-black/15', label: 'Not invited' },
  invited: { wash: 'bg-accent-700/10', text: 'text-accent-700', solid: 'bg-accent-700', ring: 'ring-accent-700', label: 'Invited' },
  checked_in: { wash: 'bg-status-confirmed/10', text: 'text-status-confirmed', solid: 'bg-status-confirmed', ring: 'ring-status-confirmed', label: 'Checked in' },
}

// Guest avatars used to be a djb2-hash-of-name color + initials (an
// "identicon"), defined here as getAvatarTone/initials — replaced by
// GuestAvatar.tsx (a real photo when the guest has one, a react-nice-avatar
// generated face otherwise), so both are gone now rather than left as dead
// exports. STATUS_TONE above is unaffected — GuestAvatar still takes a
// ringClassName the same way every old avatar span did.

// Shared by KpiTile and StatTiles' own MiniStat — both render a "solid
// gradient" card variant (see KpiTile's own `solid` prop doc for why every
// Key-metrics tile uses this now, not just one hero tile). Takes the exact
// same `text-{token}` string each already carries as `iconText` and turns
// it into a two-stop diagonal gradient — the same color mixed toward black
// for the second stop, so every tile's gradient direction/contrast reads
// consistently regardless of which specific color it's built from, without
// either caller having to also hand-pick and maintain a matching "darker
// sibling" token pair for every metric.
//
// Built as an inline `style` object, not a Tailwind class: a class name
// assembled from a runtime `.replace()` (e.g. 'bg-accent-700') never
// appears as literal text anywhere in this file, so Tailwind's build-time
// scanner could never generate CSS for it — unlike `iconText` itself, which
// always arrives as a whole literal string at each call site. Inline
// `style` is never subject to that static scan, so it's the one part of
// this recipe that's actually safe to compute at runtime.
export function gradientFromIconText(iconText: string): { backgroundImage: string } {
  const colorVar = iconText.replace('text-', '--color-')
  return { backgroundImage: `linear-gradient(135deg, var(${colorVar}), color-mix(in srgb, var(${colorVar}) 68%, black))` }
}
