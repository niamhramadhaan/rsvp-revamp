import { useEffect, type ComponentType, type ReactNode, type SVGProps } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons/UiIcons'
import { useEnterTransition } from '../hooks/useEnterTransition'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  /** A small round icon badge to the left of the title — ConfirmModal's own
   * way of giving a confirm dialog an instant tone read (destructive red,
   * neutral blue) without anyone having to read the body copy first.
   * Optional and unused by every other Modal caller (plain informational
   * ones like ActivityFeed's "All Activity" list), so it's additive, not a
   * layout change for them. */
  titleIcon?: ComponentType<SVGProps<SVGSVGElement>>
  /** Background + icon color for the badge above — e.g.
   * `bg-status-declined/10 text-status-declined`. Ignored when titleIcon
   * isn't given. */
  titleIconClassName?: string
  children?: ReactNode
  footer?: ReactNode
  maxWidth?: string
}

export default function Modal({ open, onClose, title, titleIcon: TitleIcon, titleIconClassName = '', children, footer, maxWidth = 'max-w-md' }: ModalProps) {
  const entered = useEnterTransition(open)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  // Portaled straight to <body> rather than rendered inline — every caller
  // of this component that lives inside a drawer (GuestProfileDrawer's
  // delete confirm, say) sits inside DrawerPanel's own <aside>, which always
  // carries an active `transform` for its slide animation (translate-y-0 is
  // still a real transform value, not `none`, even fully open/at rest). Any
  // non-`none` transform on an ancestor creates a new containing block for a
  // `position: fixed` descendant, so this modal's `fixed inset-0` would
  // resolve against that <aside>'s own box instead of the true viewport —
  // centering over the drawer, not the screen. Portaling to `document.body`
  // (a true child of the root, no transformed ancestor in between) is what
  // actually fixes that, for every caller, not just the one that surfaced it.
  return createPortal(
    <div
      inert={!open}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ease-out ${
        entered ? 'bg-ink-900/40 opacity-100' : 'pointer-events-none opacity-0'
      }`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        // bg-cream/95 + backdrop-blur (not the old solid bg-white) — the one
        // remaining plain-white surface in the app's shared chrome; every
        // other card/panel already uses this "warm, slightly translucent"
        // recipe (PageStage, EventSwitcher's own dropdown) instead of a flat
        // white box, see --color-cream in index.css.
        className={`w-full ${maxWidth} rounded-2xl border border-cream/40 bg-cream/95 p-6 shadow-xl backdrop-blur-xl transition-transform duration-200 ease-out ${
          entered ? 'scale-100' : 'scale-95'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {TitleIcon && (
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${titleIconClassName}`}>
                <TitleIcon className="h-4 w-4" />
              </span>
            )}
            <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-icon-gray transition hover:bg-black/5 hover:text-ink-900 active:scale-[0.97]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">{children}</div>

        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
