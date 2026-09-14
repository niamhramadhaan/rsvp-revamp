import { useMemo, useState, type ComponentType, type SVGProps } from 'react'
import type { RsvpStatus, SeatGroup } from '../../data/types'
import { SendIcon, FilterIcon, ChairIcon, QrCheckIcon, TagIcon, BuildingIcon, CheckmarkIcon } from '../icons/UiIcons'
import { BriefcaseIcon } from '../icons/NavIcons'
import { useEnterTransition } from '../../hooks/useEnterTransition'

export type SeatFilter = 'all' | 'assigned' | 'unassigned'
// Replaces the old RSVP-status filter (confirmed/pending/declined) — there's
// no guest-facing reply anywhere in this app (see selectors.ts's
// isGuestInvited doc), so "invited or not" is the real signal to filter by.
export type InviteFilter = 'all' | 'invited' | 'not_invited'
// 'all' | 'checked_in' | 'not_checked_in' — checked-in is its own axis from
// invite status (see selectors.ts's GuestStage doc: a walk-in can be checked
// in without ever having been invited), so it gets its own control rather
// than being folded into InviteFilter's three values.
export type CheckinFilter = 'all' | 'checked_in' | 'not_checked_in'
// 'all', or a SeatGroup id — a guest's group is derived from whichever seat
// they're assigned to (see selectors.ts's getGuestGroupLabel), so this
// filters by the same SeatGroup records the seat map itself uses rather
// than a free-text label that could drift out of sync with them.
export type GroupFilter = 'all' | string
// 'all', or a distinct Guest.role/organization value already on the roster —
// same "filter by whatever's actually there, not a fixed enum" shape
// GroupFilter uses, just sourced from plain guest fields instead of SeatGroup
// records.
export type RoleFilter = 'all' | string
export type OrganizationFilter = 'all' | string
// Guest.rsvpStatus is genuinely optional (no response yet) — 'pending' here
// is this filter's own stand-in for "rsvpStatus is undefined", not a fourth
// stored value.
export type RsvpFilter = 'all' | RsvpStatus | 'pending'

export interface GuestFilterPopoverProps {
  inviteFilter: InviteFilter
  onInviteFilterChange: (value: InviteFilter) => void
  seatFilter: SeatFilter
  onSeatFilterChange: (value: SeatFilter) => void
  checkinFilter: CheckinFilter
  onCheckinFilterChange: (value: CheckinFilter) => void
  groups: SeatGroup[]
  groupFilter: GroupFilter
  onGroupFilterChange: (value: GroupFilter) => void
  roleOptions: string[]
  roleFilter: RoleFilter
  onRoleFilterChange: (value: RoleFilter) => void
  /** Every distinct Guest.organization already on this roster — the same
   * "picked from what's already on guest profiles" list AddGuestDrawer's own
   * Organization ComboField suggests from (distinctSorted), not a separate
   * maintained list of its own. */
  organizationOptions: string[]
  organizationFilter: OrganizationFilter
  onOrganizationFilterChange: (value: OrganizationFilter) => void
  rsvpFilter: RsvpFilter
  onRsvpFilterChange: (value: RsvpFilter) => void
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>
type CategoryKey = 'invite' | 'rsvp' | 'seat' | 'checkin' | 'group' | 'role' | 'organization'

interface Option {
  value: string
  label: string
}

const INVITE_OPTIONS: Option[] = [
  { value: 'all', label: 'All' },
  { value: 'invited', label: 'Invited' },
  { value: 'not_invited', label: 'Not invited' },
]
const SEAT_OPTIONS: Option[] = [
  { value: 'all', label: 'All' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'unassigned', label: 'Unassigned' },
]
const CHECKIN_OPTIONS: Option[] = [
  { value: 'all', label: 'All' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'not_checked_in', label: 'Not yet' },
]
const RSVP_OPTIONS: Option[] = [
  { value: 'all', label: 'All' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'unsure', label: 'Unsure' },
  { value: 'declined', label: 'Declined' },
  { value: 'pending', label: 'Pending' },
]

// One option row on the right-hand panel — a full-width vertical row (not a
// wrapped pill), with a trailing checkmark once it's the active pick, same
// "solid fill = selected" language every other filter control in this app
// already uses.
function OptionRow({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
        active ? 'bg-ink-900 text-white' : 'text-ink-900/80 hover:bg-black/5'
      }`}
    >
      <span className="truncate capitalize">{children}</span>
      {active && <CheckmarkIcon className="h-3.5 w-3.5 shrink-0" />}
    </button>
  )
}

// A category on the left — icon + label, same "icon in its own round chip"
// language the options-row/IconRail language elsewhere in this app uses.
// The small dot mirrors the trigger button's own "a filter is active" dot,
// just per-category instead of for the popover as a whole.
function CategoryButton({ icon: Icon, label, active, hasFilter, onClick }: { icon: IconComponent; label: string; active: boolean; hasFilter: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-medium transition ${
        active ? 'bg-black/5 text-ink-900' : 'text-ink-900/60 hover:bg-black/5'
      }`}
    >
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/5 text-ink-900/60">
        <Icon className="h-3.5 w-3.5" />
        {hasFilter && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent-700" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

// Master/detail popover: categories in a narrow left column (icon + label,
// like a small sidebar), that category's own options as a neat vertical
// list on the right — scrolled internally once there are too many to fit,
// rather than every category's own options all showing/wrapping at once.
// Replaces an earlier pass that stacked every category's own wrapped-pill
// row underneath the last — this is the actual layout requested, not a
// cosmetic tweak of that one.
export default function GuestFilterPopover({
  inviteFilter,
  onInviteFilterChange,
  seatFilter,
  onSeatFilterChange,
  checkinFilter,
  onCheckinFilterChange,
  groups,
  groupFilter,
  onGroupFilterChange,
  roleOptions,
  roleFilter,
  onRoleFilterChange,
  organizationOptions,
  organizationFilter,
  onOrganizationFilterChange,
  rsvpFilter,
  onRsvpFilterChange,
}: GuestFilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('invite')
  const entered = useEnterTransition(open)

  const isActive =
    inviteFilter !== 'all' ||
    seatFilter !== 'all' ||
    checkinFilter !== 'all' ||
    groupFilter !== 'all' ||
    roleFilter !== 'all' ||
    organizationFilter !== 'all' ||
    rsvpFilter !== 'all'

  // Group/Role/Organization are only real categories once this roster
  // actually has some — same "hidden entirely, not an empty useless
  // section" rule the old Group-only version of this popover already used.
  const categories = useMemo(() => {
    const list: { key: CategoryKey; label: string; icon: IconComponent; hasFilter: boolean }[] = [
      { key: 'invite', label: 'Invite status', icon: SendIcon, hasFilter: inviteFilter !== 'all' },
      { key: 'rsvp', label: 'RSVP', icon: CheckmarkIcon, hasFilter: rsvpFilter !== 'all' },
      { key: 'seat', label: 'Seat', icon: ChairIcon, hasFilter: seatFilter !== 'all' },
      { key: 'checkin', label: 'Checked in', icon: QrCheckIcon, hasFilter: checkinFilter !== 'all' },
    ]
    if (groups.length > 0) list.push({ key: 'group', label: 'Group', icon: TagIcon, hasFilter: groupFilter !== 'all' })
    if (roleOptions.length > 0) list.push({ key: 'role', label: 'Role', icon: BriefcaseIcon, hasFilter: roleFilter !== 'all' })
    if (organizationOptions.length > 0)
      list.push({ key: 'organization', label: 'Organization', icon: BuildingIcon, hasFilter: organizationFilter !== 'all' })
    return list
  }, [groups, roleOptions, organizationOptions, inviteFilter, rsvpFilter, seatFilter, checkinFilter, groupFilter, roleFilter, organizationFilter])

  // Falls back to the first still-visible category if whichever one was
  // active just disappeared (e.g. the last guest with an Organization value
  // got filtered/edited away) — never renders an options panel for a
  // category no longer in the list.
  const effectiveCategory = categories.some((c) => c.key === activeCategory) ? activeCategory : (categories[0]?.key ?? 'invite')

  function clearAll() {
    onInviteFilterChange('all')
    onSeatFilterChange('all')
    onCheckinFilterChange('all')
    onGroupFilterChange('all')
    onRoleFilterChange('all')
    onOrganizationFilterChange('all')
    onRsvpFilterChange('all')
  }

  function renderOptions() {
    switch (effectiveCategory) {
      case 'invite':
        return INVITE_OPTIONS.map((opt) => (
          <OptionRow key={opt.value} active={opt.value === inviteFilter} onClick={() => onInviteFilterChange(opt.value as InviteFilter)}>
            {opt.label}
          </OptionRow>
        ))
      case 'rsvp':
        return RSVP_OPTIONS.map((opt) => (
          <OptionRow key={opt.value} active={opt.value === rsvpFilter} onClick={() => onRsvpFilterChange(opt.value as RsvpFilter)}>
            {opt.label}
          </OptionRow>
        ))
      case 'seat':
        return SEAT_OPTIONS.map((opt) => (
          <OptionRow key={opt.value} active={opt.value === seatFilter} onClick={() => onSeatFilterChange(opt.value as SeatFilter)}>
            {opt.label}
          </OptionRow>
        ))
      case 'checkin':
        return CHECKIN_OPTIONS.map((opt) => (
          <OptionRow key={opt.value} active={opt.value === checkinFilter} onClick={() => onCheckinFilterChange(opt.value as CheckinFilter)}>
            {opt.label}
          </OptionRow>
        ))
      case 'group':
        return (
          <>
            <OptionRow active={groupFilter === 'all'} onClick={() => onGroupFilterChange('all')}>
              All
            </OptionRow>
            {groups.map((g) => (
              <OptionRow key={g.id} active={groupFilter === g.id} onClick={() => onGroupFilterChange(g.id)}>
                {g.label}
              </OptionRow>
            ))}
          </>
        )
      case 'role':
        return (
          <>
            <OptionRow active={roleFilter === 'all'} onClick={() => onRoleFilterChange('all')}>
              All
            </OptionRow>
            {roleOptions.map((r) => (
              <OptionRow key={r} active={roleFilter === r} onClick={() => onRoleFilterChange(r)}>
                {r}
              </OptionRow>
            ))}
          </>
        )
      case 'organization':
        return (
          <>
            <OptionRow active={organizationFilter === 'all'} onClick={() => onOrganizationFilterChange('all')}>
              All
            </OptionRow>
            {organizationOptions.map((o) => (
              <OptionRow key={o} active={organizationFilter === o} onClick={() => onOrganizationFilterChange(o)}>
                {o}
              </OptionRow>
            ))}
          </>
        )
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Filter guests"
        className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition ${
          isActive ? 'border-accent-700/30 bg-accent-700/10 text-accent-700' : 'border-white/40 bg-white/20 text-ink-900 hover:bg-white/40'
        }`}
      >
        <FilterIcon className="h-4 w-4" />
        {isActive && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent-700" />}
      </button>

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      <div
        inert={!open}
        className={`absolute right-0 top-[calc(100%+8px)] z-50 w-[22rem] origin-top-right rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/5 transition duration-150 ease-out ${
          entered ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <div className="flex gap-2">
          <div className="flex w-32 shrink-0 flex-col gap-0.5 border-r border-black/5 pr-2">
            {categories.map((cat) => (
              <CategoryButton
                key={cat.key}
                icon={cat.icon}
                label={cat.label}
                active={cat.key === effectiveCategory}
                hasFilter={cat.hasFilter}
                onClick={() => setActiveCategory(cat.key)}
              />
            ))}
          </div>

          {/* combo-scrollbar — same themed thin scrollbar ComboField's own
              suggestion list already uses for "a short popup that
              genuinely needs a real scroll affordance." */}
          <div className="combo-scrollbar flex max-h-64 min-w-0 flex-1 flex-col gap-0.5 overflow-y-auto">{renderOptions()}</div>
        </div>

        {isActive && (
          <button
            type="button"
            onClick={clearAll}
            className="mt-2 w-full rounded-lg border-t border-black/5 px-2.5 py-2 text-center text-xs font-semibold text-accent-700 transition hover:bg-accent-700/10"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  )
}
