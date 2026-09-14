import type { ButtonHTMLAttributes, ComponentType, SVGProps } from 'react'

export type IconButtonSize = 'sm' | 'md'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  size?: IconButtonSize
  /** Required, not optional — an icon-only button with no accessible name
   * is exactly the kind of thing this component exists to stop happening
   * again by accident. */
  'aria-label': string
}

const SIZE_CLASSES: Record<IconButtonSize, { box: string; icon: string }> = {
  // 44px — this app's own stated touch-target minimum (see the comments
  // this replaces, e.g. SeatMapCanvas's zoom buttons: "well under the 44px
  // touch minimum this app holds everything else to"). The default: most
  // icon-only buttons across the app (header actions, undo/redo, close)
  // are a primary or equal-weight action, not a cramped afterthought.
  md: { box: 'h-11 w-11', icon: 'h-4 w-4' },
  // 36px — reserved for genuinely tight contexts where a 44px circle
  // wouldn't fit next to its siblings (a popover's own trigger, a small
  // floating dock) — same 8px step down every other size in this app
  // uses, not one of the five ad hoc sizes (h-7 through h-12) this
  // component replaces.
  sm: { box: 'h-9 w-9', icon: 'h-3.5 w-3.5' },
}

// The one shared "circular icon utility button" — close, filter, undo/
// redo, zoom, view-toggle, all the "one tap, one icon, no label" actions
// that used to each hand-roll their own size (five different heights were
// in use across the app for equally-important controls) and radius
// (rounded-full everywhere except a couple of stray rounded-lg/rounded-xl
// outliers). Two sizes now, tied to context crowding, not to whichever
// file happened to write it.
export default function IconButton({ icon: Icon, size = 'md', type = 'button', className = '', ...rest }: IconButtonProps) {
  const { box, icon } = SIZE_CLASSES[size]
  return (
    <button
      type={type}
      className={`flex shrink-0 items-center justify-center rounded-full text-ink-900 transition hover:bg-black/5 active:scale-[0.9] disabled:opacity-30 ${box} ${className}`}
      {...rest}
    >
      <Icon className={icon} />
    </button>
  )
}
