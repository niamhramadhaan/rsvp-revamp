import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import DrawerPanelPortal from './DrawerPanelPortal'
import { LabeledField, FieldGroup } from './GroupedField'
import { InfoTooltip } from './Tooltip'
import Button, { type ButtonProgress } from './Button'
import { UsersIcon, UserIcon } from './icons/NavIcons'
import { CheckmarkIcon, MailIcon, LockIcon, ImageIcon } from './icons/UiIcons'
import { createUser, updateUser } from '../data/users'
import { useEvents } from '../data/hooks'
import { compressImage, DEFAULT_MAX_DIMENSION } from '../utils/imageCompression'
import type { AppRole, AppUser } from '../data/types'

export interface UserDrawerProps {
  open: boolean
  onClose: () => void
  /** Present when editing an existing user — prefills the form, and
   * submitting saves in place and closes (no "keep going" run the way a
   * fresh add gets — see this file's own doc). */
  editingUser?: AppUser
  /** Fired once per successful add — same "one toast per row landed" shape
   * OverviewContent's own AddGuestDrawer onCreated already uses, not one
   * summary at the end, since this drawer (like that one) can stay open
   * across several adds in a row. */
  onCreated?: (user: AppUser) => void
  /** Fired once after a successful edit. */
  onUpdated?: (user: AppUser) => void
}

const ROLE_CARDS: { key: AppRole; label: string; description: string; icon: typeof LockIcon }[] = [
  { key: 'admin', label: 'Admin', description: 'Full access to everything', icon: LockIcon },
  { key: 'staff', label: 'Staff', description: 'Scoped access — set in Permissions', icon: UserIcon },
]

function eventInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Add/edit a dashboard account — same "one flat form, stays open across a
// run of adds" shape AddGuestDrawer already established (see that file's
// own top doc for why: a single wizard-y multi-step wasn't worth the
// overhead for one entity). Photo goes through the shared ImageField
// (upload/change/remove all built in) rather than a hand-rolled upload
// block — there's no "generated avatar" concept for a user the way
// GuestAvatarPicker gives guests, so the plain shared field is the right
// equivalent here, not a copy of that guest-specific picker.
export default function UserDrawer({ open, onClose, editingUser, onCreated, onUpdated }: UserDrawerProps) {
  const formId = useId()
  const events = useEvents()
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(editingUser?.name ?? '')
  const [email, setEmail] = useState(editingUser?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AppRole>(editingUser?.role ?? 'staff')
  const [eventIds, setEventIds] = useState<string[]>(editingUser?.eventIds ?? [])
  const [imageUrl, setImageUrl] = useState(editingUser?.imageUrl)
  const [photoProcessing, setPhotoProcessing] = useState(false)
  const [progress, setProgress] = useState<ButtonProgress>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)

  // "Add user" stays open across a whole run of adds (see handleSubmit) —
  // these back the inline confirmation + the footer's "Done" relabel, same
  // pair AddGuestDrawer's own addedCount/lastAddedGuest already are.
  const [addedCount, setAddedCount] = useState(0)
  const [lastAddedUser, setLastAddedUser] = useState<AppUser | null>(null)

  // Re-seeded whenever a *different* editingUser opens (or Add is reopened
  // after being closed) — id-keyed so switching from editing one user
  // straight to another (without this ever unmounting) still resets to
  // that user's own values instead of the previous one's stale state.
  const editingKey = editingUser?.id ?? null
  useEffect(() => {
    if (!open) return
    setName(editingUser?.name ?? '')
    setEmail(editingUser?.email ?? '')
    setPassword('')
    setRole(editingUser?.role ?? 'staff')
    setEventIds(editingUser?.eventIds ?? [])
    setImageUrl(editingUser?.imageUrl)
    setSubmitError(null)
    setProgress('idle')
    setAddedCount(0)
    setLastAddedUser(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingKey])

  const emailValid = /\S+@\S+\.\S+/.test(email)
  const passwordValid = editingUser ? password.length === 0 || password.length >= 6 : password.length >= 6
  const canSubmit = name.trim().length > 0 && emailValid && passwordValid

  function toggleEvent(id: string) {
    setEventIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handlePhotoPick(file: File | undefined) {
    if (!file?.type.startsWith('image/')) return
    setPhotoProcessing(true)
    try {
      setImageUrl(await compressImage(file, DEFAULT_MAX_DIMENSION))
    } finally {
      setPhotoProcessing(false)
    }
  }

  // Clears just the per-user identity fields after a successful add — Role
  // and Events deliberately carry over (adding a run of staff for the same
  // event is the common case), then refocuses Name, same "resetForNextGuest"
  // shape AddGuestDrawer already uses for its own Role/Organization.
  function resetForNextUser() {
    setName('')
    setEmail('')
    setPassword('')
    setImageUrl(undefined)
    nameInputRef.current?.focus()
  }

  function handleClose() {
    onClose()
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitError(null)
    setProgress('loading')
    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          name: name.trim(),
          email: email.trim(),
          role,
          eventIds,
          imageUrl,
          ...(password ? { password } : {}),
        })
        setProgress('success')
        onUpdated?.({ ...editingUser, name: name.trim(), email: email.trim(), role, eventIds, imageUrl })
        onClose()
        return
      }

      const user = await createUser({ name: name.trim(), email: email.trim(), password, role, eventIds, imageUrl })
      onCreated?.(user)
      // Stays open — see resetForNextUser's own doc. addedCount/
      // lastAddedUser back the footer's "Done" relabel and the inline
      // confirmation below the form, same pair-of-signals AddGuestDrawer's
      // own multi-add flow already uses.
      setAddedCount((c) => c + 1)
      setLastAddedUser(user)
      setProgress('success')
      resetForNextUser()
    } catch {
      setSubmitError('Could not save — your browser storage may be full.')
      setProgress('idle')
    }
  }

  return (
    <DrawerPanelPortal
      open={open}
      onClose={handleClose}
      title={editingUser ? 'Edit user' : 'Add user'}
      icon={UsersIcon}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            {addedCount > 0 ? 'Done' : 'Cancel'}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            disabled={!canSubmit}
            progress={progress}
            onProgressSettle={() => setProgress('idle')}
          >
            {progress === 'loading' ? 'Saving…' : editingUser ? 'Save changes' : 'Add user'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* The "you can keep going" feedback the seamless multi-add flow
            needs — same reasoning as AddGuestDrawer's own lastAddedGuest
            banner: without this, a newly added account gave no visible sign
            beyond an easy-to-miss bottom-right Toast. */}
        {lastAddedUser && (
          <div className="flex items-center gap-3 rounded-xl border border-status-confirmed/20 bg-status-confirmed/10 px-3.5 py-2.5">
            {lastAddedUser.imageUrl ? (
              <img src={lastAddedUser.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-status-confirmed/15 text-status-confirmed">
                <UserIcon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-900">{lastAddedUser.name}</p>
              <p className="text-xs font-medium text-status-confirmed">Added{addedCount > 1 ? ` · ${addedCount} users this session` : ''}</p>
            </div>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-status-confirmed text-white">
              <CheckmarkIcon className="h-3.5 w-3.5" />
            </span>
          </div>
        )}

        {/* Avatar beside Name — same composition AddGuestDrawer's own
            GuestAvatarPicker+Name row uses; a plain upload circle here
            instead (no "generated avatar" concept for a user account the
            way a guest gets one). */}
        <div className="flex items-start gap-3">
          <label className="relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-full bg-black/5 text-icon-gray">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-5 w-5" />
              </span>
            )}
            <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-white ring-2 ring-cream">
              <ImageIcon className="h-3 w-3" />
            </span>
            <input type="file" accept="image/*" className="hidden" disabled={photoProcessing} onChange={(e) => handlePhotoPick(e.target.files?.[0])} />
          </label>
          <div className="min-w-0 flex-1 pt-0.5">
            <LabeledField ref={nameInputRef} label="Name" value={name} onChange={setName} icon={UserIcon} required autoFocus />
          </div>
        </div>

        <FieldGroup label="Account">
          <div className="flex flex-col gap-4">
            <LabeledField label="Email" type="email" value={email} onChange={setEmail} icon={MailIcon} />
            <LabeledField
              label={editingUser ? 'New password (leave blank to keep current)' : 'Password'}
              type="password"
              value={password}
              onChange={setPassword}
              icon={LockIcon}
            />
            {password.length > 0 && password.length < 6 && <p className="-mt-2 text-[11px] text-status-declined">At least 6 characters.</p>}
          </div>
        </FieldGroup>

        <FieldGroup label="Role" labelExtra={<InfoTooltip label="Staff's own access to Guests/Seating/Check-in/Reports is fine-tuned in the Permissions tab — this only picks Admin vs Staff." />}>
          <div className="flex gap-2.5">
            {ROLE_CARDS.map((r) => {
              const selected = role === r.key
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRole(r.key)}
                  className={`flex flex-1 flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition ${
                    selected ? 'border-accent-700 bg-accent-700/5' : 'border-black/10 hover:border-black/20'
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${selected ? 'bg-accent-700 text-white' : 'bg-black/5 text-ink-900/60'}`}>
                    <r.icon className="h-4 w-4" />
                  </span>
                  <span className={`text-sm font-semibold ${selected ? 'text-accent-700' : 'text-ink-900'}`}>{r.label}</span>
                  <span className="text-xs text-muted">{r.description}</span>
                </button>
              )
            })}
          </div>
        </FieldGroup>

        <FieldGroup label="Events" labelExtra={<InfoTooltip label="Which events this account can see — leave all unchecked for none yet." />}>
          <div className="combo-scrollbar flex max-h-48 flex-col gap-1 overflow-y-auto">
            {events.length === 0 && <p className="px-1 text-xs text-muted">No events yet.</p>}
            {events.map((ev) => {
              const selected = eventIds.includes(ev.id)
              return (
                <label
                  key={ev.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition ${
                    selected ? 'bg-accent-700/10' : 'hover:bg-black/5'
                  }`}
                >
                  <input type="checkbox" className="hidden" checked={selected} onChange={() => toggleEvent(ev.id)} />
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                      selected ? 'bg-accent-700 text-white' : 'bg-black/5 text-ink-900/60'
                    }`}
                  >
                    {eventInitials(ev.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{ev.name}</p>
                    <p className="truncate text-xs text-muted">{formatEventDate(ev.date)}</p>
                  </div>
                  {selected && <CheckmarkIcon className="h-4 w-4 shrink-0 text-accent-700" />}
                </label>
              )
            })}
          </div>
        </FieldGroup>

        {submitError && <p className="text-xs font-medium text-status-declined">{submitError}</p>}
      </form>
    </DrawerPanelPortal>
  )
}
