import { useEffect, useState, type ButtonHTMLAttributes } from 'react'
import { CheckmarkIcon } from './icons/UiIcons'

export type ButtonVariant = 'primary' | 'dark' | 'ghost' | 'destructive' | 'destructive-ghost'

/** idle (default) — plain button, whatever `children` says.
 * loading — an indeterminate progress sweep plays behind `children` (still
 * whatever loading label the caller passed, e.g. "Adding…") and the button
 * disables itself; no caller-side disabled-while-submitting bookkeeping
 * needed.
 * success — Button takes over its own label ("Saved!") for exactly 1s, then
 * calls `onProgressSettle` and reverts — one owner for that timing instead
 * of every caller hand-rolling its own setTimeout. Callers that need to
 * defer a side effect (closing a drawer, navigating) until the user's
 * actually seen the confirmation do it from `onProgressSettle`, not
 * immediately after the save resolves. */
export type ButtonProgress = 'idle' | 'loading' | 'success'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  progress?: ButtonProgress
  /** Fires once, ~1s after `progress` becomes 'success' — see ButtonProgress's
   * own doc. Not called for 'idle'/'loading'. */
  onProgressSettle?: () => void
}

const SUCCESS_FLASH_MS = 1000

// The one shared "pill" action button — every drawer footer, every Modal
// footer, and every standalone CTA in the app used to hand-roll its own
// version of this: same rounded-full shape, active:scale-[0.97] press
// feedback, and disabled:opacity-60 everywhere, but drifting paddings,
// font-weights, and hover shades every time someone wrote a new one (five
// drawers agreed on px-5 py-2.5 text-sm font-semibold for their own
// submit button; the Guests-tab toolbar's own "Add guest", EventsPage's
// CTA, and every Modal-footer button each landed on a close-but-not-quite
// variant of the same thing). One definition now, five variants for the
// five semantic roles that actually recur — see VARIANT_CLASSES.
//
// Filled variants (primary/dark/destructive) get the wider px-5 padding;
// text-only variants (ghost/destructive-ghost — Cancel, Discard) get the
// narrower px-4 — same py/font-weight either way, so a Cancel+Submit pair
// always lines up at the same height, with the filled one reading as
// slightly more prominent by width alone, not a different size tier.
// destructive/destructive-ghost use the status-declined design token (this
// app's own "bad/negative" semantic color, already reused for RSVP-declined
// pills everywhere else), not a plain Tailwind red — three DIFFERENT reds
// (red-500, status-declined, and two different opacities of each) were in
// use across the app's own destructive buttons before this; token-based
// keeps every "irreversible action" button in sync with however this app's
// own danger color is themed, rather than a separate hard-coded value that
// can drift from it. hover:opacity-90 (not a darker shade) because there's
// no separate "status-declined-600"-equivalent step defined for it.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // nav-rail, not accent-700 — matches the sidebar's own blue (IconRail's
  // bg-nav-rail), same as EventTabs' sliding pill; brightness-110 stands in
  // for a hover shade since nav-rail has no lighter sibling token the way
  // accent-700/accent-600 do.
  primary: 'px-5 py-2.5 bg-nav-rail text-white hover:brightness-110',
  dark: 'px-5 py-2.5 bg-ink-900 text-white hover:bg-ink-800',
  ghost: 'px-4 py-2.5 text-ink-900 hover:bg-black/5',
  destructive: 'px-5 py-2.5 bg-status-declined text-white shadow-sm shadow-status-declined/30 hover:opacity-90',
  'destructive-ghost': 'px-4 py-2.5 text-status-declined hover:bg-status-declined/10',
}

export default function Button({
  variant = 'primary',
  type = 'button',
  className = '',
  progress = 'idle',
  onProgressSettle,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const [showSuccess, setShowSuccess] = useState(false)

  // Keyed on `progress` itself (not a ref-tracked "did it just change"
  // flag) — this only re-runs when the prop value actually changes, so it
  // fires exactly once per idle→success transition, which is what a
  // one-shot 1s flash needs.
  useEffect(() => {
    if (progress !== 'success') return
    setShowSuccess(true)
    const timer = window.setTimeout(() => {
      setShowSuccess(false)
      onProgressSettle?.()
    }, SUCCESS_FLASH_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  const isLoading = progress === 'loading'

  return (
    <button
      type={type}
      disabled={disabled || isLoading || showSuccess}
      className={`relative overflow-hidden rounded-full text-sm font-semibold transition active:scale-[0.97] disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {/* The progress sweep — a lighter band drifting across the button's
          own fill color, not a separate loading spinner, so it reads as
          "this exact button is working" rather than a generic overlay.
          aria-hidden: purely decorative, the disabled state + loading label
          already carry the real "busy" semantics. */}
      {isLoading && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute inset-y-0 left-0 w-1/3 bg-white/30 [animation:button-progress-sweep_1.1s_ease-in-out_infinite]" />
        </span>
      )}
      <span className="relative inline-flex items-center justify-center gap-1.5">
        {showSuccess ? (
          <>
            <CheckmarkIcon className="h-4 w-4" />
            Saved!
          </>
        ) : (
          children
        )}
      </span>
    </button>
  )
}
