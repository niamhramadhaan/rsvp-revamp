import { useEffect, useRef, useState, type ComponentType, type SVGProps } from 'react'
import type { ActivityEntry, ActivityType } from '../../data/types'
import { ChairIcon, QrCheckIcon, SendIcon } from '../icons/UiIcons'
import WidgetCard from './WidgetCard'

function activityKey(a: ActivityEntry): string {
  return `${a.guest}-${a.type}-${a.at}`
}

// ACTIVITY_LABELS (selectors.ts) always composes `label` as `${guest} ...`
// — the guest's own name is guaranteed to be its literal prefix, so this
// splits the one precomposed sentence back into "who" (bold) and "what
// happened" (the de-emphasized rest) without a second, parallel copy of
// those four sentence templates living here too. Falls back to the whole
// label unstyled if that assumption ever stops holding for some reason,
// rather than silently mis-rendering.
function splitLabel(a: ActivityEntry): { name: string; rest: string } {
  if (a.label.startsWith(a.guest)) return { name: a.guest, rest: a.label.slice(a.guest.length).trim() }
  return { name: a.label, rest: '' }
}

// Fixed per-type lookup, never cycled by array index — avatar color carries
// real meaning instead of being arbitrary relative to what happened. No
// RSVP-response types here any more (there's no guest-facing reply anywhere
// in this app — see selectors.ts's isGuestInvited doc); every remaining type
// is a real, always-current process step in its own fixed categorical slot.
//
// Four genuinely different hues, not four shades of the same brand blue
// (the WA/email/seat-assigned/checked-in set used to be cyan, cyan-light,
// blue, and a slightly different blue — nearly indistinguishable at this
// badge's own small size, at a glance). Each pick still means something
// elsewhere in this app rather than being arbitrary: accent-cyan is
// WhatsApp's own established color here (AddGuestDrawer's WA field uses the
// same hue — this app deliberately avoids WhatsApp's real brand green, see
// ChatBubbleIcon's own doc); accent-700 is Email's own field color in that
// same form, and this app's main brand blue generally; status-pending
// (amber) reads as "placed," a distinct warm tone with nothing else fighting
// it for meaning in this feed; status-confirmed (green) is this app's own
// "success/done" hue everywhere else (STAGE_TONE's checked_in), so checked-in
// activity rows land on the same green a checked-in guest's own status pill
// already uses.
const TYPE_STYLE: Record<ActivityType, { wash: string; text: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  invited_wa: { wash: 'bg-accent-cyan/15', text: 'text-accent-cyan', icon: SendIcon },
  invited_email: { wash: 'bg-accent-700/15', text: 'text-accent-700', icon: SendIcon },
  seat_assigned: { wash: 'bg-status-pending/15', text: 'text-status-pending', icon: ChairIcon },
  checked_in: { wash: 'bg-status-confirmed/15', text: 'text-status-confirmed', icon: QrCheckIcon },
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export interface RecentActivityFeedProps {
  activity: ActivityEntry[]
  /** GuestListMiniWidget's own "View all" pattern, right next to this widget
   * — opens the full, unbounded feed in a side drawer (see OverviewContent's
   * activityDrawerOpen) rather than switching tabs, since there's no
   * dedicated "Activity" tab to switch to the way Guests has one. Omitted
   * (as when this same component is reused INSIDE that drawer, showing the
   * already-full list) simply skips rendering the button — there's nothing
   * further to view all of from in there. */
  onViewAll?: () => void
}

// How long a genuinely new row (arrived after this feed was already on
// screen — see the liveKeys effect below) keeps its "something just
// happened" tint before easing back to a plain row — long enough to catch
// the eye, short enough that it isn't still lit half a minute later.
const LIVE_HIGHLIGHT_MS = 2200

export default function RecentActivityFeed({ activity, onViewAll }: RecentActivityFeedProps) {
  // Which rows arrived after this feed's first render — a plain remount
  // (initial load, or scrolling back through history) doesn't count, only a
  // key this component hasn't seen before showing up in a later render does.
  // These get an extra highlight wash on top of the ordinary mount-in fade
  // every row already gets for free (each `li` below is keyed by its own
  // activity key, so a brand-new entry is a brand-new DOM node and plays
  // its `stagger-in` entrance the instant it mounts — no tracking needed
  // for that part).
  const [liveKeys, setLiveKeys] = useState<Set<string>>(() => new Set())
  const seenKeysRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    const currentKeys = new Set(activity.map(activityKey))
    const seen = seenKeysRef.current
    if (seen) {
      const freshlyArrived = [...currentKeys].filter((k) => !seen.has(k))
      if (freshlyArrived.length > 0) {
        setLiveKeys(new Set(freshlyArrived))
        const timer = setTimeout(() => setLiveKeys(new Set()), LIVE_HIGHLIGHT_MS)
        seenKeysRef.current = currentKeys
        return () => clearTimeout(timer)
      }
    }
    seenKeysRef.current = currentKeys
    return undefined
  }, [activity])

  return (
    <WidgetCard title="Recent activity" onViewAll={onViewAll}>
      {/* Capped height + internal scroll (matching GuestListMiniWidget
          right next to this one, and AutoAssignDrawer's own guest list)
          once activity's own limit was raised from 5 to 20 — otherwise a
          genuinely busy event would grow this card taller than the card
          it sits beside instead of scrolling inside a fixed frame. */}
      <ul className="no-scrollbar flex max-h-[360px] flex-col gap-2 overflow-y-auto">
        {activity.map((a, i) => {
          const style = TYPE_STYLE[a.type]
          const key = activityKey(a)
          const isLive = liveKeys.has(key)
          const { name, rest } = splitLabel(a)
          return (
            // Plain, not hover-highlighted — this row isn't a button and
            // has never had a click handler; a hover wash is exactly the
            // "looks interactive" signal a genuinely static row shouldn't
            // send. GuestSeatingList's rows earn that treatment because
            // tapping one really does select a guest; this one doesn't.
            //
            // transition-colors so isLive's highlight (set as an inline
            // background-color, not a bg-* class — animating a `color-mix`
            // custom value isn't something a static Tailwind class can
            // express) eases back out smoothly once it's cleared above,
            // rather than cutting off instantly.
            <li
              key={key}
              style={{
                animation: `stagger-in 380ms ease-out ${Math.min(i, 8) * 40}ms both`,
                backgroundColor: isLive ? 'color-mix(in srgb, var(--color-accent-700) 12%, transparent)' : 'transparent',
              }}
              className="flex items-center gap-3.5 rounded-xl px-3 py-2.5 transition-colors duration-[1200ms] ease-out"
            >
              {/* The big circle used to be this guest's own GuestAvatar
                  (an ActivityEntry only ever carries a bare name, not the
                  guest's imageUrl, so it always fell back to a generated
                  avatar rather than a real photo anyway) with the
                  activity type demoted to a small corner badge — this
                  row is a log of WHAT HAPPENED, not a guest roster (that's
                  GuestListMiniWidget's job, right next to this one), so
                  the type itself is what deserves the primary circle now;
                  the guest's own name still carries their identity in the
                  label below, same as before. */}
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.wash} ${style.text}`}>
                <style.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                {/* Bold is reserved for WHO — the guest's own name is the
                    one thing worth the eye catching on first scan of a
                    dense feed; the action itself (thin + italic, same
                    muted color the timestamp below already uses) reads
                    as connective/secondary, the way a notification's own
                    byline vs. body usually splits. */}
                <p className="truncate text-sm">
                  <span className="font-semibold text-ink-900">{name}</span>
                  {rest && <span className="font-normal italic text-muted"> {rest}</span>}
                </p>
                <p className="text-xs text-muted">{timeAgo(a.at)}</p>
              </div>
            </li>
          )
        })}
        {activity.length === 0 && <p className="text-sm text-muted">No activity yet.</p>}
      </ul>
    </WidgetCard>
  )
}

// The "View all" drawer's own full list — a real <table>, not this same
// card-of-rows recipe stretched taller. The mini-widget's own version needs
// a title (it's one card among several siblings on Overview) and a fixed
// scroll frame (so a busy event doesn't grow past the widget it's paired
// with) — neither applies once this is the ENTIRE content of its own
// drawer (DrawerPanelPortal's own chrome already titles it "Recent
// activity", and the drawer body scrolls on its own), so this is its own
// smaller component rather than RecentActivityFeed plus a bunch of props to
// suppress parts of it. table-fixed + a <colgroup> keeps the icon/time
// columns pinned to a fixed width regardless of row content, so the middle
// (name + action) column is the only one that ever actually grows/shrinks/
// truncates — load-bearing at a drawer's own narrow width, where an auto
// table layout would otherwise size columns off whichever row's text
// happens to be longest.
export function RecentActivityTable({ activity }: { activity: ActivityEntry[] }) {
  if (activity.length === 0) return <p className="text-sm text-muted">No activity yet.</p>

  return (
    <div className="overflow-hidden rounded-2xl border border-black/5">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col style={{ width: '52px' }} />
          <col />
          <col style={{ width: '64px' }} />
        </colgroup>
        <tbody className="divide-y divide-black/5">
          {activity.map((a, i) => {
            const style = TYPE_STYLE[a.type]
            const { name, rest } = splitLabel(a)
            return (
              <tr
                key={activityKey(a)}
                style={{ animation: `stagger-in 380ms ease-out ${Math.min(i, 8) * 40}ms both` }}
                className="transition-colors hover:bg-black/5"
              >
                <td className="py-2.5 pl-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${style.wash} ${style.text}`}>
                    <style.icon className="h-4 w-4" />
                  </span>
                </td>
                <td className="min-w-0 py-2.5 pr-2">
                  <p className="truncate text-sm">
                    <span className="font-semibold text-ink-900">{name}</span>
                    {rest && <span className="font-normal italic text-muted"> {rest}</span>}
                  </p>
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-right text-xs text-muted">{timeAgo(a.at)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
