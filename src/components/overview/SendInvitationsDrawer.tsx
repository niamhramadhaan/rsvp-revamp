import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from 'react'
import DrawerPanelPortal from '../DrawerPanelPortal'
import Button from '../Button'
import { InfoTooltip } from '../Tooltip'
import { FieldGroup } from '../GroupedField'
import { markInvitesSent } from '../../data/guests'
import { getGuestStage } from '../../data/selectors'
import { useIntegrationSettings } from '../../data/hooks'
import { EMAIL_PROVIDER_LABELS, MESSAGE_PROVIDER_LABELS, isEmailConfigured, isMessageConfigured } from '../../data/integrations'
import { STAGE_TONE } from './cardChrome'
import GuestAvatar from './GuestAvatar'
import InviteBarcode from './InviteBarcode'
import { playSound } from '../../utils/sound'
import { SendIcon, ChatBubbleIcon, MailIcon, CheckmarkIcon, AlertTriangleIcon } from '../icons/UiIcons'
import type { Event, Guest } from '../../data/types'
import type { ToastTone } from '../Toast'

export interface SendInvitationsDrawerProps {
  open: boolean
  onClose: () => void
  guests: Guest[]
  /** The event being invited to — owns the invitation template this drawer
   * previews below (see TemplatePreview). Null when no event is selected;
   * the guest list is empty then anyway, so the preview just says so. */
  event: Event | null
  /** Opens the invitation template drawer for the same event — the caller
   * closes this drawer first (same shared-single-slot hand-off every other
   * OverviewContent opener already does), since the template is written
   * there, never here. */
  onEditTemplate: () => void
  onToast: (message: string, tone?: ToastTone) => void
}

type Channel = 'wa' | 'email'
type SentFilter = 'not_sent' | 'sent' | 'all'

const SENT_FILTERS: { key: SentFilter; label: string }[] = [
  { key: 'not_sent', label: 'Not sent' },
  { key: 'sent', label: 'Already sent' },
  { key: 'all', label: 'All' },
]

// A short artificial pace, not an instant flip — reads as a real batch send
// going out rather than a local write nobody can see happen. See the
// component doc below for why there's nothing to actually wait on.
const SEND_DELAY_MS = 700

// One bulk drawer for every guest at once, replacing the per-guest "Send via
// WhatsApp/Email" buttons GuestProfileDrawer used to stub out — invitations
// go out through a third-party sender (see Settings → Integrations), and a
// third party is naturally a batch job, not a per-guest button on a profile
// you happen to have open. This app has no live sender connection, so Send
// here only updates each guest's own invite status (see markInvitesSent) —
// the same honest placeholder every other not-yet-integrated action in this
// app already is.
//
// Reworked around the invitation template (InvitationTemplateDrawer): the
// first thing this drawer shows is exactly what each guest on the picked
// channel is about to receive — the event's own template, previewed, with a
// way to go fix it — and only then the who-gets-it list. Sending without
// ever seeing the content was the old flow's actual gap: an empty template
// meant blank invites going out with no warning.
export default function SendInvitationsDrawer({ open, onClose, guests, event, onEditTemplate, onToast }: SendInvitationsDrawerProps) {
  const [channel, setChannel] = useState<Channel>('wa')
  const [sentFilter, setSentFilter] = useState<SentFilter>('not_sent')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<'setup' | 'sending' | 'done'>('setup')
  const [sentCount, setSentCount] = useState(0)
  const [integrations] = useIntegrationSettings()

  // What's actually usable right now — only a channel with a connected
  // sender (see Settings → Integrations) can be picked here at all. A
  // channel this app can't really send through has no business being an
  // option, not just a greyed-out one — see activeChannel's own doc below
  // for how the rest of this drawer folds back to just this list.
  const messageConfigured = isMessageConfigured(integrations.message)
  const emailConfigured = isEmailConfigured(integrations.email)
  const availableChannels = useMemo(() => {
    const list: Channel[] = []
    if (messageConfigured) list.push('wa')
    if (emailConfigured) list.push('email')
    return list
  }, [messageConfigured, emailConfigured])

  // The channel this drawer actually operates on — `channel` state only
  // matters when there's a real choice between two connected senders; the
  // moment only one is connected (or the previously-picked one drops off),
  // this falls back to whichever IS connected instead of quietly operating
  // on a sender that doesn't exist. Null means neither is connected, which
  // the render below treats as a hard blocked state, not just an empty list.
  const activeChannel: Channel | null = availableChannels.includes(channel) ? channel : (availableChannels[0] ?? null)

  // Per-channel reach — shown right on the picker cards below, so picking
  // a channel is never a guess about how many guests it can actually reach.
  const waReachable = useMemo(() => guests.filter((g) => Boolean(g.contact.wa?.trim())).length, [guests])
  const emailReachable = useMemo(() => guests.filter((g) => Boolean(g.contact.email?.trim())).length, [guests])

  // Only guests who actually have that contact method on file — nowhere for
  // a NetMessage invite to go without a phone number, regardless of filter.
  const eligible = useMemo(
    () => (activeChannel ? guests.filter((g) => Boolean(g.contact[activeChannel]?.trim())) : []),
    [guests, activeChannel]
  )

  // Per-status counts for the filter rows below — same "show the number
  // on the control" reasoning as the channel cards above.
  const sentCountFor = useMemo(() => {
    if (!activeChannel) return { sent: 0, notSent: 0, all: 0 }
    const sent = eligible.filter((g) => g.invites[activeChannel].status === 'sent').length
    return { sent, notSent: eligible.length - sent, all: eligible.length }
  }, [eligible, activeChannel])

  const filtered = useMemo(() => {
    if (!activeChannel) return []
    if (sentFilter === 'all') return eligible
    return eligible.filter((g) => (g.invites[activeChannel].status === 'sent') === (sentFilter === 'sent'))
  }, [eligible, sentFilter, activeChannel])

  // Fresh setup every time this opens, or the channel switches — defaults to
  // every not-yet-sent, eligible guest checked (the common case: "send to
  // whoever hasn't gotten one yet"), same default AutoAssignDrawer's own
  // "assign everyone confirmed" uses for the same reason.
  useEffect(() => {
    if (!open) return
    setPhase('setup')
    setSentCount(0)
    setSentFilter('not_sent')
    setChecked(new Set(activeChannel ? eligible.filter((g) => g.invites[activeChannel].status !== 'sent').map((g) => g.id) : []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeChannel])

  function toggleGuest(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setChecked((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((g) => g.id))))
  }

  async function handleSend() {
    if (checked.size === 0 || !activeChannel) return
    playSound('send')
    setPhase('sending')
    const ids = [...checked]
    await markInvitesSent(ids, activeChannel)
    window.setTimeout(() => {
      setSentCount(ids.length)
      setPhase('done')
    }, SEND_DELAY_MS)
  }

  function handleClose() {
    const shouldToast = phase === 'done'
    onClose()
    if (shouldToast) onToast(`Sent ${sentCount} invitation${sentCount === 1 ? '' : 's'}`)
  }

  const allChecked = filtered.length > 0 && checked.size === filtered.length
  const channelLabel = activeChannel === 'wa' ? 'NetMessage' : 'email'
  // Which third party this channel would actually go out through (see
  // Settings → Integrations) — always a real, connected sender now (never
  // "Not connected"): a channel with nothing behind it never becomes
  // activeChannel in the first place, see that value's own doc above.
  const providerLabel =
    activeChannel === 'wa'
      ? MESSAGE_PROVIDER_LABELS[integrations.message.provider]
      : activeChannel === 'email'
        ? EMAIL_PROVIDER_LABELS[integrations.email.provider]
        : null

  return (
    <DrawerPanelPortal
      open={open}
      onClose={handleClose}
      title="Send invitations"
      icon={SendIcon}
      footer={
        phase === 'setup' ? (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            {activeChannel && (
              <Button variant="primary" onClick={handleSend} disabled={checked.size === 0}>
                Send {checked.size > 0 ? checked.size : ''} invitation{checked.size === 1 ? '' : 's'}
              </Button>
            )}
          </>
        ) : (
          <Button variant="dark" onClick={handleClose} disabled={phase !== 'done'}>
            {phase === 'done' ? 'Done' : 'Sending…'}
          </Button>
        )
      }
    >
      {phase === 'setup' ? (
        !activeChannel ? (
          <NoChannelConnected />
        ) : (
        <div className="flex flex-col gap-5">
          <FieldGroup
            label="What goes out"
            labelExtra={<InfoTooltip label="What each guest receives — set in the template." />}
          >
            <TemplatePreview event={event} channel={activeChannel} sampleGuest={filtered[0] ?? eligible[0]} onEditTemplate={onEditTemplate} />
          </FieldGroup>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Channel</p>
              <InfoTooltip label={`Goes out through ${providerLabel}. Sending here only marks as sent.`} />
            </div>
            {/* Provider cards — icon tile + reach count each, the same
                selectable-card language UserDrawer's own role cards and
                AutoAssignDrawer's category cards already use, instead of a
                flat segmented row. Only shown when there's an actual choice
                to make — one connected sender doesn't need a picker, see
                the else-branch below. */}
            {availableChannels.length > 1 ? (
              <div className="grid grid-cols-2 gap-2.5">
                <ChannelCard
                  active={activeChannel === 'wa'}
                  onClick={() => setChannel('wa')}
                  icon={ChatBubbleIcon}
                  iconTint="bg-accent-cyan/15 text-accent-cyan"
                  label="NetMessage"
                  count={waReachable}
                  countLabel="numbers"
                />
                <ChannelCard
                  active={activeChannel === 'email'}
                  onClick={() => setChannel('email')}
                  icon={MailIcon}
                  iconTint="bg-accent-700/10 text-accent-700"
                  label="Email"
                  count={emailReachable}
                  countLabel="addresses"
                />
              </div>
            ) : (
              // Nothing to pick between — the other channel isn't connected
              // at all (see availableChannels), so this reads as a fact
              // ("sending via X"), not a dead selectable card for a sender
              // that doesn't exist.
              <div className="flex items-center gap-2.5 rounded-2xl border-2 border-accent-700 bg-accent-700/5 p-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-700 text-white">
                  {activeChannel === 'wa' ? <ChatBubbleIcon className="h-5 w-5" /> : <MailIcon className="h-5 w-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-accent-700">Sending via {channelLabel}</span>
                  <span className="block text-[11px] text-muted">
                    {(activeChannel === 'wa' ? waReachable : emailReachable)} {activeChannel === 'wa' ? 'numbers' : 'addresses'} reachable
                    {' · '}the only channel connected right now
                  </span>
                </span>
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                Guests · {checked.size} of {filtered.length}
              </p>
              {filtered.length > 0 && (
                <button type="button" onClick={toggleAll} className="text-xs font-semibold text-accent-700 hover:underline">
                  {allChecked ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>
            {/* Sent-status rows — full-width checkmarked rows (the drawer
                list-row language UserDrawer's own event list uses) with a
                live count each, instead of a segmented trio. */}
            <div className="mb-2 flex flex-col gap-1.5">
              {SENT_FILTERS.map((f) => {
                const active = sentFilter === f.key
                const count = f.key === 'sent' ? sentCountFor.sent : f.key === 'not_sent' ? sentCountFor.notSent : sentCountFor.all
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setSentFilter(f.key)}
                    aria-pressed={active}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 text-left text-xs font-semibold transition active:scale-[0.99] ${
                      active ? 'border-accent-700 bg-accent-700/5 text-accent-700' : 'border-black/10 text-ink-900 hover:border-black/20'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className={`tabular-nums ${active ? 'text-accent-700/70' : 'text-muted'}`}>{count}</span>
                      {active && <CheckmarkIcon className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                )
              })}
            </div>

            {filtered.length === 0 ? (
              <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-sm text-muted">
                No guests with a {channelLabel} {activeChannel === 'wa' ? 'number' : 'address'} on file{sentFilter !== 'all' ? ' match this filter' : ''}.
              </p>
            ) : (
              <ul className="no-scrollbar flex max-h-[360px] flex-col gap-1 overflow-y-auto rounded-xl border border-black/5 p-1.5">
                {filtered.map((g) => {
                  const isChecked = checked.has(g.id)
                  const alreadySent = g.invites[activeChannel].status === 'sent'
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => toggleGuest(g.id)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition active:scale-[0.99] ${
                          isChecked ? 'bg-accent-700/10' : 'hover:bg-black/5'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                            isChecked ? 'border-accent-700 bg-accent-700' : 'border-black/15 bg-white'
                          }`}
                        >
                          {isChecked && <CheckmarkIcon className="h-3 w-3 text-white" />}
                        </span>
                        <GuestAvatar name={g.name} imageUrl={g.imageUrl} avatarConfig={g.avatarConfig} sizeClassName="h-8 w-8" ringClassName={STAGE_TONE[getGuestStage(g)].ring} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-900">{g.name}</p>
                          <p className="truncate text-xs text-muted">{g.contact[activeChannel]}</p>
                        </div>
                        {alreadySent && (
                          <span className="shrink-0 rounded-full bg-status-confirmed/10 px-2 py-0.5 text-[10px] font-medium text-status-confirmed">
                            Sent
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            {phase === 'done' ? `Sent ${sentCount} invitation${sentCount === 1 ? '' : 's'}.` : `Sending to ${checked.size} guest${checked.size === 1 ? '' : 's'}…`}
          </p>
          <ul className="flex flex-col gap-1.5">
            {[...checked].map((id) => {
              const guest = guests.find((g) => g.id === id)
              if (!guest) return null
              return (
                <li
                  key={id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-opacity duration-300 ${
                    phase === 'done' ? 'bg-status-confirmed/10 opacity-100' : 'opacity-50'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${
                      phase === 'done' ? 'bg-status-confirmed text-white' : 'border-2 border-dashed border-black/15'
                    }`}
                  >
                    {phase === 'done' && <CheckmarkIcon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">{guest.name}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </DrawerPanelPortal>
  )
}

// The event's own invitation template for one channel, previewed — banner,
// text, and attachment for a message; readiness + size for an email. Empty
// states name the gap ("no text yet", "blank invite") instead of showing a
// hollow card, and every state carries the one action that fixes it in the
// template drawer. Read-only throughout: nothing here writes the template.
//
// `sampleGuest` renders their actual code + barcode alongside the template
// — there's no separate redemption step any more (see docs/rsvp-flow.md):
// the code and barcode ARE the ticket, embedded straight in this message,
// so what staff sees here is exactly what every guest's own invite carries,
// not just the shared banner/text they all have in common.
function TemplatePreview({ event, channel, sampleGuest, onEditTemplate }: { event: Event | null; channel: Channel; sampleGuest?: Guest; onEditTemplate: () => void }) {
  if (!event) {
    return <p className="text-xs text-muted">Select an event first — the template lives on the event.</p>
  }

  if (channel === 'email') {
    const html = event.invitationTemplate?.email?.html?.trim() ?? ''
    if (!html) {
      return (
        <TemplateEmpty
          title="No email template for this event yet"
          body="Guests on this channel would get a blank invite."
          actionLabel="Set up template"
          onAction={onEditTemplate}
        />
      )
    }
    const text = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-ink-900">
          HTML email <span className="font-normal text-muted">· {html.length} characters</span>
        </p>
        {text ? (
          <p className="line-clamp-2 text-xs text-muted">{text.slice(0, 140)}</p>
        ) : (
          <p className="text-xs text-muted">No readable text in the HTML yet — check what it renders.</p>
        )}
        <InviteCodeSample guest={sampleGuest} />
        <TemplateEditButton label="Edit template" onAction={onEditTemplate} />
      </div>
    )
  }

  const message = event.invitationTemplate?.message
  const body = message?.bodyText?.trim() ?? ''
  if (!message?.bannerImageUrl && !body && !message?.pdfDataUrl) {
    return (
      <TemplateEmpty
        title="No NetMessage template for this event yet"
        body="Guests on this channel would get a blank invite."
        actionLabel="Set up template"
        onAction={onEditTemplate}
      />
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        {message?.bannerImageUrl && <img src={message.bannerImageUrl} alt="" className="h-14 w-24 shrink-0 rounded-lg object-cover" />}
        <div className="min-w-0 flex-1">
          {body ? (
            <p className="line-clamp-3 text-xs leading-relaxed text-ink-900">{body}</p>
          ) : (
            <p className="text-xs text-muted">No message text yet — just the banner{message?.pdfDataUrl ? ' and attachment' : ''}.</p>
          )}
          {message?.pdfFileName && (
            <p className="mt-1.5 inline-block max-w-full truncate rounded-lg bg-black/5 px-2 py-1 text-[11px] font-medium text-ink-900">
              {message.pdfFileName}
            </p>
          )}
        </div>
      </div>
      <InviteCodeSample guest={sampleGuest} />
      <TemplateEditButton label="Edit template" onAction={onEditTemplate} />
    </div>
  )
}

// Every invite carries its own code + barcode automatically — not a
// template field an operator toggles, so this is never editable here, just
// shown for the first guest in the current list as a concrete example of
// what gets appended under the template content above.
function InviteCodeSample({ guest }: { guest?: Guest }) {
  if (!guest) return null
  return (
    <div className="flex items-center gap-3 rounded-xl bg-black/5 p-2.5">
      <InviteBarcode value={guest.token} ariaLabel={`Invitation barcode for ${guest.name}`} className="h-9 w-28 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Their own code, added automatically</p>
        <p className="truncate font-mono text-xs font-bold text-ink-900">{guest.token}</p>
      </div>
    </div>
  )
}

// One channel's own selectable card — icon tile + reach count, the same
// selectable-card language UserDrawer's own role cards and AutoAssignDrawer's
// category cards already use. The count is the point: picking NetMessage vs
// Email stops being a guess about how many guests each one can reach.
function ChannelCard({
  active,
  onClick,
  icon: Icon,
  iconTint,
  label,
  count,
  countLabel,
}: {
  active: boolean
  onClick: () => void
  icon: ComponentType<SVGProps<SVGSVGElement>>
  iconTint: string
  label: string
  count: number
  countLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition active:scale-[0.97] ${
        active ? 'border-accent-700 bg-accent-700/5' : 'border-black/10 bg-white hover:border-black/20'
      }`}
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${active ? 'bg-accent-700 text-white' : iconTint}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className={`block truncate text-xs font-semibold ${active ? 'text-accent-700' : 'text-ink-900'}`}>{label}</span>
        <span className="block text-[11px] tabular-nums text-muted">
          {count} {countLabel}
        </span>
      </span>
    </button>
  )
}

// Neither NetMessage nor Email has a connected sender (see Settings →
// Integrations) — there's nothing to actually pick a channel FOR, so this
// replaces the whole setup body (template preview, channel picker, guest
// list) rather than showing an empty picker with two disabled cards nobody
// can do anything with. Send itself is hidden in the footer for this same
// state (see the footer's own activeChannel check).
function NoChannelConnected() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-black/15 p-6 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-status-pending/10 text-status-pending">
        <AlertTriangleIcon className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-ink-900">No sending channel connected</p>
      <p className="max-w-xs text-xs text-muted">
        Connect NetMessage or Email in Settings → Integrations before sending invitations from here.
      </p>
    </div>
  )
}

function TemplateEmpty({ title, body, actionLabel, onAction }: { title: string; body: string; actionLabel: string; onAction: () => void }) {  return (
    <div className="flex flex-col items-start gap-1.5 rounded-xl border border-dashed border-black/15 p-3.5">
      <p className="text-xs font-semibold text-ink-900">{title}</p>
      <p className="text-xs text-muted">{body}</p>
      <button type="button" onClick={onAction} className="mt-1 text-xs font-semibold text-accent-700 transition hover:underline">
        {actionLabel}
      </button>
    </div>
  )
}

function TemplateEditButton({ label, onAction }: { label: string; onAction: () => void }) {
  return (
    <button type="button" onClick={onAction} className="w-fit text-xs font-semibold text-accent-700 transition hover:underline">
      {label}
    </button>
  )
}
