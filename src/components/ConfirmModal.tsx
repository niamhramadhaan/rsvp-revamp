import type { ReactNode } from 'react'
import Modal from './Modal'
import Button from './Button'
import { AlertTriangleIcon, InfoIcon } from './icons/UiIcons'

export type ConfirmTone = 'destructive' | 'neutral'

export interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  /** Always phrased as a question — "Delete this guest?", not "Confirm
   * deletion" — so the title alone is a complete yes/no prompt and the body
   * only has to add whatever the title + buttons don't already say. */
  title: string
  /** One short clause: the single non-obvious consequence, nothing the
   * buttons already communicate (never "Cancel keeps it, Delete removes
   * it" — Cancel/Delete already say that). ReactNode, not string, so a
   * caller can bold a guest's name or a count without reaching for its own
   * <p> wrapper. */
  body: ReactNode
  /** 'destructive' (red AlertTriangleIcon badge, matches the Button
   * destructive variant's own status-declined token) for anything
   * unrecoverable — deleting a guest, logging out. 'neutral' (blue
   * InfoIcon badge, matches Button primary's accent-700) for a confirm
   * whose recommended path is the bold/primary action, not the red one —
   * e.g. "Save these changes?", where Save is primary and Discard is the
   * quiet destructive-ghost option. Icon tone always mirrors whichever
   * button in the footer is the bold, filled one, so the badge and the
   * button never disagree about how serious this is. */
  tone?: ConfirmTone
  cancelLabel?: string
  /** Overrides what the left button actually does — defaults to `onClose`
   * (a plain "never mind, keep whatever state I was already in" back-out,
   * what X/Escape/backdrop-click already do too). Only needed when the
   * left option is its own real action rather than just closing the
   * dialog — SeatMapCanvas's "Save these changes?" pairs cancelLabel
   * "Discard" with an onCancel that actually reverts the edit, which is
   * NOT the same as onClose (closing that dialog by X/Escape instead just
   * returns to the editor with the pending changes still intact). */
  onCancel?: () => void
  /** 'ghost' (default) for a plain back-out. 'destructive-ghost' for a
   * cancelLabel that's a real destructive action of its own (Discard) —
   * same status-declined-ghost token Button's own variant table already
   * reserves for that, so it doesn't read as equally safe as a plain
   * Cancel. */
  cancelVariant?: 'ghost' | 'destructive-ghost'
  confirmLabel: ReactNode
  onConfirm: () => void
  /** Disables the confirm button — an in-flight delete, say. The caller
   * still owns the label swap (e.g. `deleting ? 'Deleting…' : 'Delete'`
   * passed straight into confirmLabel) since only it knows the right
   * wording for its own async action. */
  confirmDisabled?: boolean
}

const TONE_STYLE: Record<ConfirmTone, { icon: typeof AlertTriangleIcon; badgeClassName: string; confirmVariant: 'destructive' | 'primary' }> = {
  destructive: { icon: AlertTriangleIcon, badgeClassName: 'bg-status-declined/10 text-status-declined', confirmVariant: 'destructive' },
  neutral: { icon: InfoIcon, badgeClassName: 'bg-accent-700/10 text-accent-700', confirmVariant: 'primary' },
}

// The one shared "are you sure?" dialog for the whole dashboard — every
// confirm used to be a one-off Modal call with its own multi-sentence
// paragraph explaining what Cancel/Delete/Save already say for themselves
// (SeatMapCanvas's old "Reset to default?" ran three clauses; "Delete this
// guest?" restated what a freed-up seat means). This is the terser
// replacement: a tone-colored icon badge gives the instant read, the body
// is contractually one short clause, and the footer is always Cancel (or a
// custom cancelLabel) on the left, the one bold action on the right —
// LogoutModal, GuestsView's single/bulk delete, GuestProfileDrawer's
// delete, and SeatMapCanvas's Reset/Save-and-exit all route through this
// now rather than hand-rolling their own Modal footer.
export default function ConfirmModal({
  open,
  onClose,
  title,
  body,
  tone = 'destructive',
  cancelLabel = 'Cancel',
  onCancel,
  cancelVariant = 'ghost',
  confirmLabel,
  onConfirm,
  confirmDisabled,
}: ConfirmModalProps) {
  const { icon, badgeClassName, confirmVariant } = TONE_STYLE[tone]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      titleIcon={icon}
      titleIconClassName={badgeClassName}
      footer={
        <>
          <Button variant={cancelVariant} onClick={onCancel ?? onClose}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{body}</p>
    </Modal>
  )
}
