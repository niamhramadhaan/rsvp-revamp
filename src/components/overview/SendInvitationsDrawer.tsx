import { useEffect, useMemo, useState } from 'react'
import DrawerPanelPortal from '../DrawerPanelPortal'
import Button from '../Button'
import { InfoTooltip } from '../Tooltip'
import { markInvitesSent } from '../../data/guests'
import { getGuestStage } from '../../data/selectors'
import { STAGE_TONE } from './cardChrome'
import GuestAvatar from './GuestAvatar'
import { SendIcon, ChatBubbleIcon, MailIcon, CheckmarkIcon } from '../icons/UiIcons'
import type { Guest } from '../../data/types'
import type { ToastTone } from '../Toast'

export interface SendInvitationsDrawerProps {
  open: boolean
  onClose: () => void
  guests: Guest[]
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
// go out through NetMessage (a third-party send, not something this app
// talks to directly), and a third party is naturally a batch job, not a
// per-guest button on a profile you happen to have open. This app has no
// live NetMessage connection, so Send here only updates each guest's own
// invite status (see markInvitesSent) — the same honest placeholder every
// other not-yet-integrated action in this app already is.
export default function SendInvitationsDrawer({ open, onClose, guests, onToast }: SendInvitationsDrawerProps) {
  const [channel, setChannel] = useState<Channel>('wa')
  const [sentFilter, setSentFilter] = useState<SentFilter>('not_sent')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<'setup' | 'sending' | 'done'>('setup')
  const [sentCount, setSentCount] = useState(0)

  // Only guests who actually have that contact method on file — nowhere for
  // a WhatsApp invite to go without a WhatsApp number, regardless of filter.
  const eligible = useMemo(() => guests.filter((g) => Boolean(g.contact[channel]?.trim())), [guests, channel])

  const filtered = useMemo(() => {
    if (sentFilter === 'all') return eligible
    return eligible.filter((g) => (g.invites[channel].status === 'sent') === (sentFilter === 'sent'))
  }, [eligible, sentFilter, channel])

  // Fresh setup every time this opens, or the channel switches — defaults to
  // every not-yet-sent, eligible guest checked (the common case: "send to
  // whoever hasn't gotten one yet"), same default AutoAssignDrawer's own
  // "assign everyone confirmed" uses for the same reason.
  useEffect(() => {
    if (!open) return
    setPhase('setup')
    setSentCount(0)
    setSentFilter('not_sent')
    setChecked(new Set(eligible.filter((g) => g.invites[channel].status !== 'sent').map((g) => g.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channel])

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
    if (checked.size === 0) return
    setPhase('sending')
    const ids = [...checked]
    await markInvitesSent(ids, channel)
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
  const channelLabel = channel === 'wa' ? 'WhatsApp' : 'email'

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
            <Button variant="primary" onClick={handleSend} disabled={checked.size === 0}>
              Send {checked.size > 0 ? checked.size : ''} invitation{checked.size === 1 ? '' : 's'}
            </Button>
          </>
        ) : (
          <Button variant="dark" onClick={handleClose} disabled={phase !== 'done'}>
            {phase === 'done' ? 'Done' : 'Sending…'}
          </Button>
        )
      }
    >
      {phase === 'setup' ? (
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Channel</p>
              <InfoTooltip label="Sends through NetMessage. Not connected yet — Send here just marks each guest's invite as sent." />
            </div>
            <div className="inline-flex rounded-xl border border-black/10 bg-white p-1">
              <button
                type="button"
                onClick={() => setChannel('wa')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  channel === 'wa' ? 'bg-ink-900 text-white' : 'text-ink-900/70 hover:bg-black/5'
                }`}
              >
                <ChatBubbleIcon className="h-3.5 w-3.5" />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setChannel('email')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  channel === 'email' ? 'bg-ink-900 text-white' : 'text-ink-900/70 hover:bg-black/5'
                }`}
              >
                <MailIcon className="h-3.5 w-3.5" />
                Email
              </button>
            </div>
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
            <div className="mb-2 inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-black/10 bg-white p-1">
              {SENT_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setSentFilter(f.key)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    sentFilter === f.key ? 'bg-ink-900 text-white' : 'text-ink-900/70 hover:bg-black/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-sm text-muted">
                No guests with a {channelLabel} {channel === 'wa' ? 'number' : 'address'} on file{sentFilter !== 'all' ? ' match this filter' : ''}.
              </p>
            ) : (
              <ul className="no-scrollbar flex max-h-[360px] flex-col gap-1 overflow-y-auto rounded-xl border border-black/5 p-1.5">
                {filtered.map((g) => {
                  const isChecked = checked.has(g.id)
                  const alreadySent = g.invites[channel].status === 'sent'
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
                          <p className="truncate text-xs text-muted">{g.contact[channel]}</p>
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
