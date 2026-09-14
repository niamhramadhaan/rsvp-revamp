import { memo, type CSSProperties, type ReactNode } from 'react'

export interface AuroraTextProps {
  children: ReactNode
  className?: string
  colors?: string[]
  /** Higher = faster sweep. */
  speed?: number
}

// AuroraText — a "gradient text sweep" recipe in the same family as
// magicui's own AuroraText: a multi-stop gradient clipped to the text,
// animated via background-position so the colors continuously drift across
// it. Recolored from the reference's rainbow (magenta/purple/blue/cyan) to
// this app's own brand blue/cyan family instead — same "two brand hues, no
// generic demo palette" rule SparklesText/RainPrismBackground already state.
// Replaces SparklesText on the event switcher per request — deliberately
// continuous (not a burst), see index.css's own aurora-sweep doc.
export const AuroraText = memo(function AuroraText({
  children,
  className = '',
  colors = ['var(--color-accent-cyan-light)', 'var(--color-accent-700)', 'var(--color-accent-cyan)', 'var(--color-accent-700)'],
  speed = 1,
}: AuroraTextProps) {
  return (
    <span className={`relative inline-block ${className}`}>
      {/* Real text for anything that reads it (a11y tree, copy/paste,
          find-in-page) — the gradient layer below is aria-hidden and purely
          visual. */}
      <span className="sr-only">{children}</span>
      <span
        aria-hidden="true"
        className="relative bg-clip-text text-transparent [animation:aurora-sweep_var(--aurora-duration)_linear_infinite] [background-size:200%_auto]"
        style={
          {
            backgroundImage: `linear-gradient(135deg, ${colors.join(', ')}, ${colors[0]})`,
            '--aurora-duration': `${10 / speed}s`,
          } as CSSProperties
        }
      >
        {children}
      </span>
    </span>
  )
})
