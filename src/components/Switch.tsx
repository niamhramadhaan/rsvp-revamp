import { playSound } from '../utils/sound'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Required when this switch has no adjacent visible label of its own
   * (rare — SettingsPage's own rows all pair this with a visible label,
   * so `aria-labelledby` there is more accurate than duplicating the text
   * here, but a standalone use still needs a real accessible name). */
  label?: string
  disabled?: boolean
}

// This app's first boolean on/off control — nothing like it existed before
// (every prior "pick one of two" surface, e.g. GuestFilterPopover's own
// Invite/Seat filters, is a segmented two-button pill, not a true switch).
// The iOS-style pill-track-plus-sliding-knob idiom: reads as on/off at a
// glance without needing to read which side is highlighted the way a
// segmented control does. transform-only sliding (no left/width tweening),
// matching every other motion in this app's own compositor-cheap-first
// convention.
export default function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        playSound(checked ? 'toggle-off' : 'toggle-on')
        onChange(!checked)
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? 'bg-accent-700' : 'bg-black/15'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-150 ease-out ${
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  )
}
