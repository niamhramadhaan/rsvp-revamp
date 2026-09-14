import type { ComponentType, SVGProps } from 'react'
import { UploadIcon, SendIcon, QrCheckIcon } from '../icons/UiIcons'
import { GLASS_CARD } from './cardChrome'
import { useCanAccess } from '../../data/hooks'

interface QuickAction {
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  onClick: () => void
  // Fixed per-action color, never cycled by index — a 4th action later gets
  // its own slot, not a repeat of one of these.
  chipClass: string
}

export interface QuickActionsPanelProps {
  onOpenCheckIn: () => void
  onOpenAddGuest: () => void
  onOpenSendInvites: () => void
}

// Purely event-scoped actions — everything here operates on whichever event
// is currently selected. Creating a *new* event is a cross-event concern, so
// that action lives in the TopHeader event switcher instead, not here.
// Sized to its own content (no forced height-match with EventBanner) so it
// doesn't stretch its buttons into a lot of empty vertical padding.
export default function QuickActionsPanel({ onOpenCheckIn, onOpenAddGuest, onOpenSendInvites }: QuickActionsPanelProps) {
  const canGuests = useCanAccess('guests')
  const canCheckIn = useCanAccess('checkIn')

  const actions: (QuickAction & { visible: boolean })[] = [
    {
      // Opens the same AddGuestDrawer the Guests tab's own "Add guest"
      // button does (its bulk-import mode covers what this used to stub
      // out as "coming soon") — one add flow, reached from two places.
      label: 'Add Guests',
      icon: UploadIcon,
      onClick: onOpenAddGuest,
      // Data-in / intake action — cyan reads as "input".
      chipClass: 'bg-accent-cyan/15 text-accent-cyan',
      visible: canGuests,
    },
    {
      label: 'Send Invites',
      icon: SendIcon,
      onClick: onOpenSendInvites,
      // Primary brand-blue — this is the primary outbound CTA.
      chipClass: 'bg-accent-700/15 text-accent-700',
      visible: canGuests,
    },
    {
      label: 'Open Check-in',
      icon: QrCheckIcon,
      // Opens CheckInDrawer's scan flow directly as a modal — this used to
      // be a "coming soon" toast, then briefly switched to a dedicated
      // Check-in tab first; that tab's own log duplicated Overview's Recent
      // Activity feed, so it was removed and this button is the one launcher.
      onClick: onOpenCheckIn,
      // Ties to arrival/success semantics, same hue family as CheckInProgressRing.
      chipClass: 'bg-status-confirmed/15 text-status-confirmed',
      visible: canCheckIn,
    },
  ].filter((a) => a.visible)

  if (actions.length === 0) return null

  return (
    <div>
      <h3 className="mb-3 font-display text-sm font-semibold text-ink-900">Quick actions</h3>

      <div className={`rounded-3xl p-3 ${GLASS_CARD}`}>
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-3 py-3.5 text-center transition hover:border-accent-700/30 hover:bg-white/30 active:scale-[0.97] lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-2.5"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.chipClass}`}>
                <a.icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-medium text-ink-900 lg:text-sm">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
