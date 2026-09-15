import { useEffect, useMemo, useState } from 'react'
import type { AvatarFullConfig } from 'react-nice-avatar'
import DrawerPanelPortal from '../DrawerPanelPortal'
import InviteBarcode from './InviteBarcode'
import ConfirmModal from '../ConfirmModal'
import Button, { type ButtonProgress } from '../Button'
import { LabeledField, ComboField } from '../GroupedField'
import { InfoTooltip } from '../Tooltip'
import { deleteGuest, updateGuest } from '../../data/guests'
import { useAllGuests } from '../../data/hooks'
import type { Guest, InviteChannelStatus } from '../../data/types'
import { getGuestStage, distinctSorted } from '../../data/selectors'
import { playSound } from '../../utils/sound'
import { STAGE_TONE } from './cardChrome'
import GuestAvatar, { GuestAvatarPicker } from './GuestAvatar'
import { UserIcon, BriefcaseIcon } from '../icons/NavIcons'
import { ChatBubbleIcon, MailIcon, BuildingIcon } from '../icons/UiIcons'
import type { ToastTone } from '../Toast'

export interface GuestProfileDrawerProps {
  guest: Guest | null
  seatLabel: string | null
  /** The guest's own group, derived from whichever seat they're assigned to
   * (see selectors.ts's getGuestGroupLabel) — Guest itself carries no
   * groupLabel field any more (see types.ts's own doc), so there's nothing
   * to show here until they're actually seated. */
  groupLabel: string | null
  onClose: () => void
  onUnassignSeat: (guestId: string) => void
  onToast: (message: string, tone?: ToastTone) => void
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function InviteStatusPill({ status }: { status: InviteChannelStatus }) {
  return status === 'sent' ? (
    <span className="rounded-full bg-status-confirmed/10 px-2.5 py-1 text-[11px] font-medium text-status-confirmed">Sent</span>
  ) : (
    <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-medium text-muted">Not sent</span>
  )
}

// This guest's own invitation code — generated once at creation (see
// Guest.token's own doc), shown here view-only as the same Code128 barcode
// + text this app used to only ever render on a per-guest TicketCard. No
// flip, no "view ticket" hand-off to a second drawer any more — just what
// this section already was, plus the code itself.
//
// Tap-to-flip card: barcode on the front, the code itself big and readable
// on the back with a copy button (staff paste it into NetMessage or read it
// out for manual check-in). One flip, no auto-rotate — it rests wherever
// it was left.
function GuestInvitationCode({ guest }: { guest: Guest }) {
  const [flipped, setFlipped] = useState(false)
  const [copied, setCopied] = useState(false)

  // Fresh card per guest — flipping for one guest must not carry over to
  // the next profile opened in this same drawer instance.
  useEffect(() => {
    setFlipped(false)
    setCopied(false)
  }, [guest.id])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(guest.token)
    } catch {
      // Clipboard API unavailable (non-secure context, old browser) —
      // fall back to the classic hidden-textarea execCommand path.
      const area = document.createElement('textarea')
      area.value = guest.token
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      document.body.removeChild(area)
    }
    playSound('copy')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    // bg-black/[0.03], not plain white — the same transparent neutral tint
    // this app's own "block content" surfaces already use (FieldGroup,
    // PermissionGroupRow), not an off-theme blue tint.
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-black/5 bg-black/[0.03] p-3">
      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        aria-label={flipped ? 'Show barcode' : `Show invitation code for ${guest.name}`}
        className="w-full [perspective:800px]"
      >
        <span
          className={`relative block transition-transform duration-500 ease-out [transform-style:preserve-3d] ${
            flipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          <span className="flex flex-col items-center gap-1.5 [backface-visibility:hidden]">
            <InviteBarcode value={guest.token} ariaLabel={`Invitation barcode for ${guest.name}`} className="h-10 w-full max-w-[220px]" />
            <span className="text-[11px] font-medium text-muted">Tap to reveal code</span>
          </span>
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span className="font-mono text-lg font-bold tracking-[0.2em] text-ink-900">{guest.token}</span>
            <span className="text-[11px] font-medium text-muted">Tap to flip back</span>
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-lg bg-black/5 px-3 py-1.5 text-xs font-semibold text-ink-900 transition active:scale-[0.97] hover:bg-black/10"
      >
        {copied ? 'Copied!' : 'Copy code'}
      </button>
    </div>
  )
}

function DetailRow({ label, value, placeholder }: { label: string; value?: string | null; placeholder: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-muted">{label}</span>
      {value ? (
        <span className="truncate text-sm font-medium text-ink-900">{value}</span>
      ) : (
        <span className="text-sm text-muted/70">{placeholder}</span>
      )}
    </div>
  )
}

// "Who is this guest" — read-only by default, with a real inline "Edit"
// mode now (Details/Contact/name/photo all become one form in place,
// see the `editing` branches below) instead of a separate photo-only
// "second layer" modal (GuestPhotoModal, now gone — photo is just one more
// field this same edit mode covers, not its own flow). "Delete" removes the
// guest outright, after a confirm dialog — a real, irreversible action this
// app had no way to do at all before.
export default function GuestProfileDrawer({ guest, seatLabel, groupLabel, onClose, onUnassignSeat, onToast }: GuestProfileDrawerProps) {
  const [editing, setEditing] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [progress, setProgress] = useState<ButtonProgress>('idle')
  const [draftName, setDraftName] = useState('')
  const [draftRole, setDraftRole] = useState('')
  const [draftOrg, setDraftOrg] = useState('')
  const [draftWa, setDraftWa] = useState('')
  const [draftEmail, setDraftEmail] = useState('')
  const [draftImageUrl, setDraftImageUrl] = useState<string | undefined>(undefined)
  const [draftAvatarConfig, setDraftAvatarConfig] = useState<AvatarFullConfig | undefined>(undefined)

  // Resets whenever a DIFFERENT guest is shown, not just whenever this
  // drawer opens — the same instance can swap straight from one guest to
  // another without ever closing in between (picking a different guest
  // from GuestDock, say), and a stale edit draft carried over from the
  // previous guest would be a real bug, not just a cosmetic one.
  useEffect(() => {
    setEditing(false)
    setDeleteConfirmOpen(false)
    setProgress('idle')
    if (guest) {
      setDraftName(guest.name)
      setDraftRole(guest.role)
      setDraftOrg(guest.organization)
      setDraftWa(guest.contact.wa)
      setDraftEmail(guest.contact.email)
      setDraftImageUrl(guest.imageUrl)
      setDraftAvatarConfig(guest.avatarConfig)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guest?.id])

  const tone = guest ? STAGE_TONE[getGuestStage(guest)] : null

  // Same Role/Organization suggestion source AddGuestDrawer's own ComboFields
  // read from (distinctSorted, selectors.ts) — every value already used on
  // any guest, across every event.
  const allGuests = useAllGuests()
  const roleOptions = useMemo(() => distinctSorted(allGuests.map((g) => g.role)), [allGuests])
  const organizationOptions = useMemo(() => distinctSorted(allGuests.map((g) => g.organization)), [allGuests])

  async function handleSave() {
    if (!guest) return
    setProgress('loading')
    // See EditEventDrawer's handleSubmit for why this is wrapped — a
    // localStorage quota throw here used to leave this button reading
    // "Saving…" forever instead of failing visibly.
    try {
      await updateGuest(guest.id, {
        name: draftName,
        role: draftRole,
        organization: draftOrg,
        wa: draftWa,
        email: draftEmail,
        imageUrl: draftImageUrl,
        avatarConfig: draftAvatarConfig,
      })
      onToast(`${draftName.trim() || guest.name} updated`)
      // Collapsing back to the read-only view waits for the Button's own
      // "Saved!" flash (handleProgressSettle) — closing it the instant the
      // save resolves used to unmount the button before anyone could
      // actually see a confirmation on it.
      setProgress('success')
    } catch {
      onToast('Could not save — your browser storage may be full', 'warning')
      setProgress('idle')
    }
  }

  function handleProgressSettle() {
    setProgress('idle')
    setEditing(false)
  }

  async function handleDelete() {
    if (!guest) return
    const result = await deleteGuest(guest.id)
    setDeleteConfirmOpen(false)
    if (!result.ok) {
      onToast(result.reason ?? 'Could not delete', 'warning')
      return
    }
    onToast(`${guest.name} deleted`)
    onClose()
  }

  return (
    <DrawerPanelPortal
      open={Boolean(guest)}
      onClose={onClose}
      title="Guest profile"
      icon={UserIcon}
      footer={
        guest &&
        (editing ? (
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} progress={progress} onProgressSettle={handleProgressSettle}>
              {progress === 'loading' ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="destructive-ghost" onClick={() => setDeleteConfirmOpen(true)}>
              Delete
            </Button>
            <Button variant="primary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </>
        ))
      }
    >
      {guest && tone && (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-4">
            {/* GuestAvatarPicker while editing — same interface
                AddGuestDrawer's own header uses: the circle itself is the
                "generate a new look" button, a permanently-docked corner
                badge handles Upload, no hover-reveal step and no separate
                "Photo" field + Remove/Randomize buttons underneath any
                more. Read-only view keeps the plain GuestAvatar (nothing
                to click when there's nothing to edit). */}
            {editing ? (
              <GuestAvatarPicker
                name={draftName || guest.name}
                imageUrl={draftImageUrl}
                avatarConfig={draftAvatarConfig}
                onImageChange={setDraftImageUrl}
                onAvatarConfigChange={setDraftAvatarConfig}
                sizeClassName="h-16 w-16"
                ringClassName={tone.ring}
              />
            ) : (
              <GuestAvatar name={guest.name} imageUrl={guest.imageUrl} avatarConfig={guest.avatarConfig} sizeClassName="h-16 w-16" ringClassName={tone.ring} />
            )}
            {editing ? (
              <div className="min-w-0 flex-1 pt-0.5">
                <LabeledField label="Name" value={draftName} onChange={setDraftName} icon={UserIcon} required />
              </div>
            ) : (
              <div className="min-w-0 pt-0.5">
                <p className="truncate font-display text-lg font-bold text-ink-900">{guest.name}</p>
                <p className="truncate text-sm text-muted">{guest.organization || 'No organization on file'}</p>
              </div>
            )}
          </div>

          {!editing && (
            <div className="flex flex-wrap gap-2">
              {groupLabel && <span className="rounded-full bg-lavender-2 px-2.5 py-1 text-xs font-medium text-ink-900">{groupLabel}</span>}
              {/* One pill for the guest's whole stage (not invited/invited/
                  checked in — see selectors.ts's GuestStage doc), not a
                  separate "Checked in" pill alongside it: checked-in is
                  already the top of this same ladder, so a second pill would
                  just repeat it. */}
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone.wash} ${tone.text}`}>{tone.label}</span>
            </div>
          )}

          <section>
            <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Details
              <InfoTooltip label="How they appear on the roster." />
            </h4>
            {editing ? (
              <div className="flex flex-col gap-3 rounded-xl border border-black/5 p-3.5">
                {/* ComboField — same stylized "type or pick" dropdown
                    AddGuestDrawer's own Role/Organization fields use,
                    suggesting every value already used on any guest. */}
                <ComboField label="Role" value={draftRole} onChange={setDraftRole} options={roleOptions} placeholder="e.g. VIP, Speaker, Press" icon={BriefcaseIcon} />
                <ComboField
                  label="Organization"
                  value={draftOrg}
                  onChange={setDraftOrg}
                  options={organizationOptions}
                  placeholder="e.g. PT Gamefinity Nusantara"
                  icon={BuildingIcon}
                />
              </div>
            ) : (
              <div className="divide-y divide-black/5 rounded-xl border border-black/5 px-3.5">
                <DetailRow label="Role" value={guest.role} placeholder="Not set" />
                <DetailRow label="Organization" value={guest.organization} placeholder="Not set" />
              </div>
            )}
          </section>

          <section>
            <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Contact
              <InfoTooltip label="Where their invite can reach them." />
            </h4>
            {editing ? (
              <div className="flex flex-col gap-3 rounded-xl border border-black/5 p-3.5">
                <LabeledField label="NetMessage" value={draftWa} onChange={setDraftWa} />
                <LabeledField label="Email" type="email" value={draftEmail} onChange={setDraftEmail} />
              </div>
            ) : (
              <div className="divide-y divide-black/5 rounded-xl border border-black/5 px-3.5">
                <DetailRow label="NetMessage" value={guest.contact.wa} placeholder="Not provided" />
                <DetailRow label="Email" value={guest.contact.email} placeholder="Not provided" />
              </div>
            )}
          </section>

          {/* Seating/Check-in/Invitation stay out of edit mode entirely —
              those are separate flows (seat assignment lives on the
              Seating tab, check-in happens by scanning, sending is its own
              still-deferred piece), not part of "editing this guest's own
              info", so they'd just be inert clutter alongside an active
              edit form. */}
          {!editing && (
            <>
              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Seating</h4>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 px-3.5 py-2.5">
                  {seatLabel ? (
                    <>
                      <span className="text-sm font-medium text-ink-900">
                        Seat {seatLabel}
                        {groupLabel && <span className="ml-1.5 font-normal text-muted">· {groupLabel}</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUnassignSeat(guest.id)}
                        className="rounded-lg px-2 py-1.5 text-xs font-medium text-status-declined transition hover:bg-status-declined/10 active:scale-[0.97]"
                      >
                        Unassign
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-muted/70">Not assigned — pick a seat from Guests &amp; Seating</span>
                  )}
                </div>
              </section>

              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Check-in</h4>
                <div className="rounded-xl border border-black/5 px-3.5">
                  <DetailRow
                    label="Status"
                    value={guest.checkedInAt ? `${formatDateTime(guest.checkedInAt)}${guest.checkedInBy ? ` · ${guest.checkedInBy}` : ''}` : null}
                    placeholder="Not checked in yet"
                  />
                </div>
              </section>

              <section>
                <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  Invitation
                  <InfoTooltip label="Sent in bulk from Send Invitations — shown here only." />
                </h4>
                {/* Read-only here on purpose — sending is a bulk action
                    (Send Invitations, reached from Quick actions), not a
                    per-guest one, since it goes out through a third party
                    (NetMessage) that naturally works in batches. This
                    section just reports where each channel stands. */}
                <div className="flex flex-col gap-2 rounded-xl border border-black/5 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-sm text-ink-900">
                      <ChatBubbleIcon className="h-3.5 w-3.5 text-accent-cyan" />
                      NetMessage
                    </span>
                    <InviteStatusPill status={guest.invites.wa.status} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-sm text-ink-900">
                      <MailIcon className="h-3.5 w-3.5 text-accent-700" />
                      Email
                    </span>
                    <InviteStatusPill status={guest.invites.email.status} />
                  </div>
                </div>
              </section>

              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Invitation code</h4>
                {/* View-only — there's no per-guest ticket to send/view any
                    more (see Guest.token's own doc for what replaced that);
                    this is just the credential CheckInDrawer's own scanner
                    matches against, shown here so staff can read it out or
                    screenshot it by hand if they ever need to. */}
                <GuestInvitationCode guest={guest} />
              </section>
            </>
          )}
        </div>
      )}

      <ConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete this guest?"
        body="Their invite and check-in history can't be recovered."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </DrawerPanelPortal>
  )
}
