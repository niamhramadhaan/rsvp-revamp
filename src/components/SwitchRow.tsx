import type { ComponentType, SVGProps } from 'react'
import Switch from './Switch'

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

// A setting that is really on/off — provider identity on the left (icon
// tile + name + one-line description), the design system's own Switch on
// the right. Reads as on/off at a glance without needing to read which
// side of a segmented pair is highlighted, which is exactly why it exists
// alongside SegmentedToggle: two-or-more choices is a segmented job, a
// single enable is a switch job. The tile tints up when enabled and falls
// back to neutral when off, so the state reads twice (tile + switch).
export default function SwitchRow({
  icon: Icon,
  iconTone,
  title,
  description,
  checked,
  onChange,
  ariaLabel,
}: {
  icon: IconComponent
  /** Tinted tile classes while enabled, e.g. 'bg-accent-700/10 text-accent-700'. */
  iconTone: string
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-150 ${
          checked ? iconTone : 'bg-black/5 text-muted'
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink-900">{title}</span>
        <span className="block truncate text-xs text-muted">{description}</span>
      </span>
      <Switch checked={checked} onChange={onChange} label={ariaLabel ?? title} />
    </div>
  )
}
