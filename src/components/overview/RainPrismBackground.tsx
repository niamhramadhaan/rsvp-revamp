import type { ReactNode } from 'react'

export interface RainPrismBackgroundProps {
  children?: ReactNode
  className?: string
}

// TicketDrawer's own backdrop — adapted from a shared "Rain Prism
// Background" reference (opensourceui.in/components/rain-prism-background):
// the same layered-gradient technique (a soft vertical base wash, two
// repeating-diagonal hairline "rain streak" textures at different angles
// and densities, one wide soft color band drawn over the top), but
// recolored to this app's own two-hue rule instead of the reference's
// generic teal/rose/sky — see DashboardLayout.tsx's own
// SHELL_BACKGROUND_STYLE doc for why this app never mixes in a third
// accent hue on a background wash. Every layer here is a static
// `background-image`, not an animation: the source itself doesn't animate
// either, and this app has its own hard-won reason not to add one anyway
// (rounds 7-9 of this project's own history — a backdrop that's merely
// decorative, redrawn every frame for no visual gain, is exactly the kind
// of thing that reads as "laggy" on a mid-range phone).
export default function RainPrismBackground({ children, className = '' }: RainPrismBackgroundProps) {
  return (
    <div className={`relative isolate overflow-hidden bg-[#eef2f7] ${className}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,#f4f7fa_0%,#dde6ee_58%,#c8d5e0_100%)]"
      />
      {/* Two "rain streak" layers — thin diagonal hairlines at slightly
          different angles/spacing/opacity so they read as one irregular
          texture rather than an obvious repeating tile. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-25 [background-image:repeating-linear-gradient(108deg,rgba(255,255,255,0.55)_0px,rgba(255,255,255,0.55)_1px,transparent_1px,transparent_14px)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-20 [background-image:repeating-linear-gradient(102deg,rgba(148,163,184,0.35)_0px,rgba(148,163,184,0.35)_1px,transparent_1px,transparent_9px)]"
      />
      {/* The "prism" band — Gamefinity's own brand wash (blue + cyan,
          color-mix over transparent, same tokens DashboardLayout's shell
          background already uses) in place of the reference's
          teal/rose/sky, so this reads as this app's own effect rather
          than a generic demo palette. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--color-accent-cyan) 22%, transparent) 30%, color-mix(in srgb, var(--color-accent-700) 20%, transparent) 62%, transparent 100%)',
        }}
      />
      {children}
    </div>
  )
}
