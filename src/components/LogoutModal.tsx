import ConfirmModal from './ConfirmModal'

export interface LogoutModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function LogoutModal({ open, onClose, onConfirm }: LogoutModalProps) {
  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title="Log out"
      body="You'll need to sign back in next time."
      confirmLabel="Log out"
      onConfirm={onConfirm}
    />
  )
}
