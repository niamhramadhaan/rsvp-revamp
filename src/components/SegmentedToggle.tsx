import { useRef, type ComponentType, type SVGProps } from 'react'
import { useSlidingIndicator } from '../hooks/useSlidingIndicator'

export interface SegmentedOption<T extends string> {
  key: T
  label: string
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  /** Icon-only button — the label renders sr-only so the control keeps a
   * real accessible name (e.g. a card/table view switch with no room for
   * words). */
  hideLabel?: boolean
}

// Shared segmented toggle — one sliding pill travelling between options.
// EventsPage's own Live/Archived/All filter, AddGuestDrawer's single/bulk
// switch, and SettingsPage's provider pickers all hand-rolled this same
// rail + useSlidingIndicator pairing before this existed; reach for this
// before building another inline segmented row, so the rail, the pill, and
// the active/inactive treatments stay identical everywhere. Generic over
// any string key, with an optional leading icon per option.
export default function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const indicator = useSlidingIndicator(railRef, value)

  return (
    <div ref={railRef} role="group" aria-label={ariaLabel} className="relative inline-flex rounded-xl border border-black/10 bg-white p-1">
      {indicator && (
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 rounded-lg bg-ink-900 shadow-sm transition-[transform,width] duration-300 ease-out"
          style={{
            width: indicator.width,
            height: indicator.height,
            transform: `translate(${indicator.left}px, ${indicator.top}px)`,
          }}
        />
      )}
      {options.map((opt) => {
        const Icon = opt.icon
        const active = opt.key === value
        return (
          <button
            key={opt.key}
            type="button"
            data-tab-key={opt.key}
            onClick={() => onChange(opt.key)}
            aria-pressed={active}
            aria-label={opt.hideLabel ? opt.label : undefined}
            title={opt.hideLabel ? opt.label : undefined}
            className={`relative z-10 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              active ? 'text-white' : 'text-ink-900/70 hover:bg-black/5'
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {opt.hideLabel ? <span className="sr-only">{opt.label}</span> : opt.label}
          </button>
        )
      })}
    </div>
  )
}
