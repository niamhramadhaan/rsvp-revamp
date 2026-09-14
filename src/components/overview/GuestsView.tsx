import { memo, useEffect, useMemo, useRef, useState } from 'react'
import Avatar, { genConfig } from 'react-nice-avatar'
import type { Guest, RsvpStatus, Seat, SeatGroup } from '../../data/types'
import { getGuestGroupLabel, getGuestStage, isGuestInvited, distinctSorted, type GuestStage } from '../../data/selectors'
import { deleteGuest } from '../../data/guests'
import { buildCsv, downloadCsv } from '../../utils/csv'
import { GLASS_CARD, STAGE_TONE } from './cardChrome'
import GuestAvatar from './GuestAvatar'
import Button from '../Button'
import ConfirmModal from '../ConfirmModal'
import { GridIcon, UserIcon } from '../icons/NavIcons'
import {
  SearchIcon,
  PlusIcon,
  TableIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  DotsVerticalIcon,
  CheckmarkIcon,
  MinusIcon,
  DownloadIcon,
  CloseIcon,
} from '../icons/UiIcons'
import GuestFilterPopover, {
  type InviteFilter,
  type SeatFilter,
  type CheckinFilter,
  type GroupFilter,
  type RoleFilter,
  type OrganizationFilter,
  type RsvpFilter,
} from './GuestFilterPopover'
import SegmentedToggle from '../SegmentedToggle'
import FloatingMenu, { MenuItem } from '../FloatingMenu'
import type { ToastTone } from '../Toast'

// Card view's own page size scales with however many columns are actually
// rendering (3/4/5/6 — see the grid's own sm:/lg:/xl: breakpoints below) so
// "2 rows" means 2 rows at ANY width, not a fixed count that reflows into a
// different number of rows depending on the screen. These thresholds
// mirror Tailwind's own default sm/lg/xl breakpoints (640/1024/1280px) —
// media-query-driven, like the grid classes themselves, not the width of
// whatever container happens to hold this (a drawer open elsewhere pushing
// <main> narrower doesn't change how many columns the grid itself uses,
// since sm:/lg:/xl: are viewport queries).
//
// Was 3 — dropped to 2 (again) after briefly trying 3: with the drawer back
// to push/reflow (see DrawerPanel's own doc), up to 18 cards at once
// (3 rows × 6 columns) repainting through that 300ms transition measured as
// notably slow even after removing the per-card frosted-photo blur and
// adding content-visibility. Fewer simultaneous cards (12 at that same
// width) is the direct lever left once the per-card cost itself is already
// as cheap as this design gets and the push animation itself is staying.
const CARD_ROWS_PER_PAGE = 2
const TABLE_ROWS_PER_PAGE = 10
const COLUMN_BREAKPOINTS = [
  { minWidth: 1280, columns: 6 },
  { minWidth: 1024, columns: 5 },
  { minWidth: 640, columns: 4 },
  { minWidth: 0, columns: 3 },
]

function getColumnsForWidth(width: number): number {
  return COLUMN_BREAKPOINTS.find((bp) => width >= bp.minWidth)?.columns ?? 3
}

// Table view's own column sort — card view has no equivalent (there's no
// shared row order to hang a header control off), same asymmetry the
// checkbox-select state above already has. The leading checkbox and
// trailing actions column aren't data, so there's nothing meaningful to
// sort by there.
type SortKey = 'name' | 'group' | 'status' | 'seat' | 'checkedIn' | 'rsvp' | 'added'
type SortDirection = 'asc' | 'desc'
interface SortState {
  key: SortKey
  direction: SortDirection
}

// A guest's stage is a three-rung ladder (see selectors.ts's GuestStage doc)
// — sorting by "Status" walks that same ladder rather than alphabetizing
// the display labels, so "Not invited" always lands before "Invited" before
// "Checked in" regardless of what each tier happens to be called.
const STAGE_ORDER: Record<GuestStage, number> = { not_invited: 0, invited: 1, checked_in: 2 }
// Same idea for RSVP — undefined ("Pending") sits between the two real
// answers rather than at either extreme, since it's neither a yes nor a no.
const RSVP_ORDER: Record<RsvpStatus | 'pending', number> = { declined: 0, pending: 1, unsure: 2, accepted: 3 }

const RSVP_TONE: Record<RsvpStatus | 'pending', { wash: string; text: string; label: string }> = {
  accepted: { wash: 'bg-status-confirmed/10', text: 'text-status-confirmed', label: 'Accepted' },
  unsure: { wash: 'bg-status-pending/10', text: 'text-status-pending', label: 'Unsure' },
  declined: { wash: 'bg-status-declined/10', text: 'text-status-declined', label: 'Declined' },
  pending: { wash: 'bg-black/5', text: 'text-muted', label: 'Pending' },
}

// Blank values (no group yet, no seat yet, never checked in) always sort to
// the bottom of the page regardless of direction — flipping them to the top
// on a descending sort would bury every guest who actually has a value
// underneath a wall of dashes, which is never what an admin scanning this
// table wants.
function compareGuests(a: Guest, b: Guest, key: SortKey, seatById: Map<string, Seat>, groupById: Map<string, SeatGroup>): number {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name)
    case 'group': {
      const ga = getGuestGroupLabel(a, seatById, groupById)
      const gb = getGuestGroupLabel(b, seatById, groupById)
      if (!ga && !gb) return 0
      if (!ga) return 1
      if (!gb) return -1
      return ga.localeCompare(gb)
    }
    case 'status':
      return STAGE_ORDER[getGuestStage(a)] - STAGE_ORDER[getGuestStage(b)]
    case 'seat': {
      const sa = a.seatId ? seatById.get(a.seatId)?.label : undefined
      const sb = b.seatId ? seatById.get(b.seatId)?.label : undefined
      if (!sa && !sb) return 0
      if (!sa) return 1
      if (!sb) return -1
      return sa.localeCompare(sb, undefined, { numeric: true })
    }
    case 'checkedIn': {
      if (!a.checkedInAt && !b.checkedInAt) return 0
      if (!a.checkedInAt) return 1
      if (!b.checkedInAt) return -1
      return new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime()
    }
    case 'rsvp':
      return RSVP_ORDER[a.rsvpStatus ?? 'pending'] - RSVP_ORDER[b.rsvpStatus ?? 'pending']
    case 'added': {
      if (!a.createdAt && !b.createdAt) return 0
      if (!a.createdAt) return 1
      if (!b.createdAt) return -1
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    }
  }
}

// One clickable column header — label plus a chevron that stays hidden
// until this is the active sort column (flipped to point up for 'asc'),
// same "icon only appears once it means something" restraint the filter
// popover's own active-dot uses.
function SortableHeader({ label, sortKey, sort, onSort, className }: { label: string; sortKey: SortKey; sort: SortState | null; onSort: (key: SortKey) => void; className?: string }) {
  const active = sort?.key === sortKey
  return (
    <th className={`px-4 py-3 font-semibold ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`group inline-flex items-center gap-1 transition hover:text-ink-900 ${active ? 'text-ink-900' : ''}`}
      >
        {label}
        <ChevronDownIcon
          className={`h-3 w-3 transition ${active ? 'text-ink-900' : 'text-icon-gray/50 opacity-0 group-hover:opacity-100'} ${
            active && sort?.direction === 'asc' ? 'rotate-180' : ''
          }`}
        />
      </button>
    </th>
  )
}

export interface GuestsViewProps {
  eventId: string | null
  guests: Guest[]
  seatById: Map<string, Seat>
  groups: SeatGroup[]
  onToast: (message: string, tone?: ToastTone) => void
  onViewProfile: (guestId: string) => void
  /** Opens AddGuestDrawer — owned by OverviewContent now (not this view),
   * since QuickActionsPanel's own "Add Guests" button needs the same shared
   * instance/state (see OverviewContent's own addGuestOpen doc). */
  onAddGuest: () => void
}

type ViewMode = 'card' | 'table'

function formatCheckedIn(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatAdded(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// The full roster, on its own tab now — split out of the old combined
// "Guests & Seating" tab (see EventTabs' own doc) so browsing/managing
// guests has the whole page to itself instead of sharing it with the seat
// map. Assigning a seat is no longer something this view does at all — that
// moved entirely to the Seating tab's own floating guest dock (drag a card
// onto a seat, or tap to select then tap a seat); a card here just opens the
// guest's profile, the one purpose this view has now.
export default function GuestsView({ eventId, guests, seatById, groups, onToast, onViewProfile, onAddGuest }: GuestsViewProps) {
  const [query, setQuery] = useState('')
  // Collapsed search — a round button at rest, the full field only once
  // opened. Collapsing always clears the query with it, so a hidden filter
  // can never silently narrow the list behind an innocent-looking roster.
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Autofocus the moment it expands — one tap to start typing, not
  // tap-then-tap.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  function closeSearch() {
    setQuery('')
    setSearchOpen(false)
  }
  const [inviteFilter, setInviteFilter] = useState<InviteFilter>('all')
  const [seatFilter, setSeatFilter] = useState<SeatFilter>('all')
  const [checkinFilter, setCheckinFilter] = useState<CheckinFilter>('all')
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [organizationFilter, setOrganizationFilter] = useState<OrganizationFilter>('all')
  const [rsvpFilter, setRsvpFilter] = useState<RsvpFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  // No sort applied until an admin actually clicks a column header — the
  // default table order (whatever `guests` itself arrives in) is left alone
  // rather than defaulting to e.g. name A-Z, so this is purely additive.
  const [sort, setSort] = useState<SortState | null>(null)
  const [page, setPage] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth))
  // Table view's own bulk-select — a header checkbox (current page) plus a
  // running set of every row checked across pages/filters, so switching a
  // page (or narrowing a filter) doesn't silently drop who was already
  // picked. Card view has no equivalent selection UI (see the view toggle
  // below), so this stays empty/inert whenever viewMode is 'card'.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Which row's kebab menu is open — only one at a time, same pattern
  // EventSwitcher/GuestFilterPopover's own single-open-popover state uses.
  const [openMenuGuestId, setOpenMenuGuestId] = useState<string | null>(null)
  // A guest id when a single row's "Remove guest" is confirmed, or the
  // literal string 'bulk' when the toolbar's own "Delete selected" is —
  // one ConfirmModal instance covers both, distinguished only by its own
  // title/body copy.
  const [deleteTarget, setDeleteTarget] = useState<string | 'bulk' | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])

  // Same distinctSorted source AddGuestDrawer's own Role/Organization
  // ComboFields already suggest from — every value already typed onto a
  // guest's own profile, not a separately maintained option list.
  const roleOptions = useMemo(() => distinctSorted(guests.map((g) => g.role)), [guests])
  const organizationOptions = useMemo(() => distinctSorted(guests.map((g) => g.organization)), [guests])

  const filteredGuests = useMemo(() => {
    const q = query.trim().toLowerCase()
    return guests.filter((g) => {
      if (q) {
        const matches =
          g.name.toLowerCase().includes(q) ||
          g.contact?.wa?.toLowerCase().includes(q) ||
          g.contact?.email?.toLowerCase().includes(q)
        if (!matches) return false
      }
      if (inviteFilter !== 'all' && isGuestInvited(g) !== (inviteFilter === 'invited')) return false
      if (seatFilter === 'assigned' && !g.seatId) return false
      if (seatFilter === 'unassigned' && g.seatId) return false
      if (checkinFilter === 'checked_in' && !g.checkedInAt) return false
      if (checkinFilter === 'not_checked_in' && g.checkedInAt) return false
      if (groupFilter !== 'all') {
        const seat = g.seatId ? seatById.get(g.seatId) : undefined
        if (seat?.groupId !== groupFilter) return false
      }
      if (roleFilter !== 'all' && g.role !== roleFilter) return false
      if (organizationFilter !== 'all' && g.organization !== organizationFilter) return false
      if (rsvpFilter !== 'all' && (g.rsvpStatus ?? 'pending') !== rsvpFilter) return false
      return true
    })
  }, [guests, query, inviteFilter, seatFilter, checkinFilter, groupFilter, roleFilter, organizationFilter, rsvpFilter, seatById])

  // Sorting runs after filtering, before pagination — a column sort applies
  // across the whole filtered set, not just whatever happens to be on the
  // current page.
  const sortedGuests = useMemo(() => {
    if (!sort) return filteredGuests
    const dir = sort.direction === 'asc' ? 1 : -1
    return [...filteredGuests].sort((a, b) => compareGuests(a, b, sort.key, seatById, groupById) * dir)
  }, [filteredGuests, sort, seatById, groupById])

  function handleSort(key: SortKey) {
    setSort((prev) => (prev?.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }))
    setPage(0)
  }

  // Back to page 1 whenever the filtered set, the sort, or the page size
  // itself changes — otherwise narrowing a filter (or switching view mode,
  // which changes the page size) could strand the admin on a now
  // out-of-range page showing nothing.
  useEffect(() => {
    setPage(0)
  }, [query, inviteFilter, seatFilter, checkinFilter, groupFilter, roleFilter, organizationFilter, rsvpFilter, viewMode])

  const pageSize = viewMode === 'card' ? getColumnsForWidth(viewportWidth) * CARD_ROWS_PER_PAGE : TABLE_ROWS_PER_PAGE
  const totalPages = Math.max(1, Math.ceil(filteredGuests.length / pageSize))
  const currentPage = Math.min(page, totalPages - 1)
  const pageGuests = sortedGuests.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  const pageGuestIds = pageGuests.map((g) => g.id)
  const allPageSelected = pageGuestIds.length > 0 && pageGuestIds.every((id) => selected.has(id))
  const somePageSelected = pageGuestIds.some((id) => selected.has(id))

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) pageGuestIds.forEach((id) => next.delete(id))
      else pageGuestIds.forEach((id) => next.add(id))
      return next
    })
  }

  function handleExportSelected() {
    const rows = sortedGuests.filter((g) => selected.has(g.id))
    const header = ['Name', 'Group', 'Invite status', 'Seat', 'Checked in', 'RSVP', 'Added']
    const csv = buildCsv(
      header,
      rows.map((g) => {
        const seat = g.seatId ? seatById.get(g.seatId) : undefined
        return [
          g.name,
          getGuestGroupLabel(g, seatById, groupById) ?? '',
          isGuestInvited(g) ? 'Invited' : 'Not invited',
          seat?.label ?? '',
          formatCheckedIn(g.checkedInAt),
          RSVP_TONE[g.rsvpStatus ?? 'pending'].label,
          formatAdded(g.createdAt),
        ]
      })
    )
    downloadCsv(`guests-export-${rows.length}.csv`, csv)
    onToast(`Exported ${rows.length} guest${rows.length === 1 ? '' : 's'}`)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const ids = deleteTarget === 'bulk' ? [...selected] : [deleteTarget]
    let removed = 0
    for (const id of ids) {
      const result = await deleteGuest(id)
      if (result.ok) removed += 1
    }
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.delete(id))
      return next
    })
    setDeleting(false)
    setDeleteTarget(null)
    onToast(removed === 1 ? 'Guest deleted' : `${removed} guests deleted`)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-ink-900">Guests</h3>
          <p className="text-xs text-muted">
            {filteredGuests.length} of {guests.length}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <GuestFilterPopover
            inviteFilter={inviteFilter}
            onInviteFilterChange={setInviteFilter}
            seatFilter={seatFilter}
            onSeatFilterChange={setSeatFilter}
            checkinFilter={checkinFilter}
            onCheckinFilterChange={setCheckinFilter}
            groups={groups}
            groupFilter={groupFilter}
            onGroupFilterChange={setGroupFilter}
            roleOptions={roleOptions}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            organizationOptions={organizationOptions}
            organizationFilter={organizationFilter}
            onOrganizationFilterChange={setOrganizationFilter}
            rsvpFilter={rsvpFilter}
            onRsvpFilterChange={setRsvpFilter}
          />
          <Button
            variant="primary"
            onClick={() => {
              if (!eventId) {
                onToast('Select an event first', 'warning')
                return
              }
              onAddGuest()
            }}
            className="flex items-center gap-1.5"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add guest
          </Button>
        </div>
      </div>

      {/* Expanding search — a round glass button at rest (the same
          white/20 + white/40-border glass the filter trigger already uses,
          not the old permanently-wide white bar) that stretches into the
          full field on click via a max-width transition. The card/table
          toggle moved out alongside as its own box rather than riding
          inside the expanding field. */}
      <div className="mb-3 flex items-center gap-2">
        <div
          onClick={() => {
            if (!searchOpen) setSearchOpen(true)
          }}
          onKeyDown={(e) => {
            if (!searchOpen && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              setSearchOpen(true)
            }
          }}
          role={searchOpen ? undefined : 'button'}
          tabIndex={searchOpen ? -1 : 0}
          aria-label={searchOpen ? undefined : 'Search guests'}
          className={`flex h-10 min-w-0 items-center overflow-hidden rounded-full border border-white/40 bg-white/20 shadow-sm transition-[max-width,background-color] duration-300 ease-out ${
            searchOpen ? 'max-w-full flex-1 hover:bg-white/30' : 'max-w-10 flex-none cursor-pointer hover:bg-white/40'
          }`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center text-icon-gray">
            <SearchIcon className="h-4 w-4" />
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => {
              if (!query.trim()) setSearchOpen(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeSearch()
            }}
            placeholder="Search guests"
            aria-label="Search guests"
            tabIndex={searchOpen ? 0 : -1}
            className={`min-w-0 flex-1 bg-transparent text-sm text-ink-900 outline-none transition-opacity duration-200 placeholder:text-muted ${
              searchOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          />
          {searchOpen && query && (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={closeSearch}
              className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-icon-gray transition hover:bg-black/5 hover:text-ink-900"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Card/table view — the shared segmented toggle (sliding pill),
            icon-only so it stays compact beside the search. */}
        <div className="shrink-0">
          <SegmentedToggle<ViewMode>
            ariaLabel="Guest list layout"
            options={[
              { key: 'card', label: 'Card view', icon: GridIcon, hideLabel: true },
              { key: 'table', label: 'Table view', icon: TableIcon, hideLabel: true },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
        </div>
      </div>

      {viewMode === 'card' ? (
        <div className={`rounded-2xl p-3 ${GLASS_CARD}`}>
          {/* contain: layout — opening ANY drawer (Add guest, Edit event
              details, this same view's own Guest profile) shrinks <main>'s
              own width to make room for it (see DashboardLayout's own
              push-reflow grid), which is a genuine LAYOUT change animated
              over 300ms, not just a repaint — every frame of that
              transition reflows everything under <main>, including this
              grid. A table row is cheap to re-layout; a card with several
              absolutely/percentage-positioned children (photo, blurred
              duplicate, scrim, pills) times up to 100+ guests is not — this
              is what "laggy, but only in grid view, and even when opening
              unrelated drawers" actually was. `contain: layout` tells the
              browser this subtree's own internal geometry doesn't need to
              be recomputed as part of an ancestor's reflow beyond this
              container's own box, letting it isolate/defer the expensive
              part instead of redoing it inline on every animation frame. */}
          <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" style={{ contain: 'layout' }}>
            {pageGuests.map((g) => (
              <GuestRosterCard key={g.id} guest={g} seat={g.seatId ? seatById.get(g.seatId) : undefined} onViewProfile={onViewProfile} />
            ))}
          </ul>
          {filteredGuests.length === 0 && guests.length === 0 && <p className="p-3 text-sm text-muted">No guests yet for this event.</p>}
          {filteredGuests.length === 0 && guests.length > 0 && <p className="p-3 text-sm text-muted">No guests match these filters.</p>}
        </div>
      ) : (
        <>
          {/* Bulk toolbar — only ever shows what's actually selected right
              now (this page or any other, see `selected`'s own doc), so it
              stays out of the way entirely until a checkbox is actually
              ticked, rather than a permanent empty-state row. */}
          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink-900 px-4 py-2.5 text-white">
              <p className="text-sm font-medium">
                {selected.size} guest{selected.size === 1 ? '' : 's'} selected
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExportSelected}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-white/10 active:scale-[0.97]"
                >
                  <DownloadIcon className="h-3.5 w-3.5" />
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget('bulk')}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-status-declined transition hover:bg-status-declined/20 active:scale-[0.97]"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white active:scale-[0.97]"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className={`overflow-hidden rounded-2xl ${GLASS_CARD}`}>
            <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <th className="w-10 px-4 py-3">
                      <RowCheckbox checked={allPageSelected} indeterminate={!allPageSelected && somePageSelected} onClick={togglePage} ariaLabel="Select all guests on this page" />
                    </th>
                    <SortableHeader label="Guest" sortKey="name" sort={sort} onSort={handleSort} />
                    <SortableHeader label="Group" sortKey="group" sort={sort} onSort={handleSort} />
                    <SortableHeader label="Status" sortKey="status" sort={sort} onSort={handleSort} />
                    <SortableHeader label="Seat" sortKey="seat" sort={sort} onSort={handleSort} />
                    <SortableHeader label="Checked in" sortKey="checkedIn" sort={sort} onSort={handleSort} />
                    <SortableHeader label="RSVP" sortKey="rsvp" sort={sort} onSort={handleSort} />
                    <SortableHeader label="Added" sortKey="added" sort={sort} onSort={handleSort} />
                    <th className="px-4 py-3 text-right font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {pageGuests.map((g) => {
                    const tone = STAGE_TONE[getGuestStage(g)]
                    const seat = g.seatId ? seatById.get(g.seatId) : undefined
                    return (
                      <tr key={g.id} className="transition-colors hover:bg-black/5">
                        <td className="px-4 py-3">
                          <RowCheckbox checked={selected.has(g.id)} onClick={() => toggleRow(g.id)} ariaLabel={`Select ${g.name}`} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <GuestAvatar name={g.name} imageUrl={g.imageUrl} avatarConfig={g.avatarConfig} sizeClassName="h-9 w-9" ringClassName={tone.ring} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-ink-900">{g.name}</p>
                              <p className="truncate text-xs text-muted">{g.organization || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-900/80">{getGuestGroupLabel(g, seatById, groupById) ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${tone.wash} ${tone.text}`}>
                            {tone.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium tabular-nums text-ink-900">{seat?.label ?? '—'}</td>
                        <td className="px-4 py-3 text-sm tabular-nums text-ink-900/80">{formatCheckedIn(g.checkedInAt)}</td>
                        <td className="px-4 py-3">
                          {(() => {
                            const rsvpTone = RSVP_TONE[g.rsvpStatus ?? 'pending']
                            return (
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${rsvpTone.wash} ${rsvpTone.text}`}>
                                {rsvpTone.label}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums text-ink-900/80">{formatAdded(g.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <RowActionsMenu
                            guest={g}
                            open={openMenuGuestId === g.id}
                            onOpenChange={(open) => setOpenMenuGuestId(open ? g.id : null)}
                            onViewProfile={() => onViewProfile(g.id)}
                            onRemove={() => setDeleteTarget(g.id)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                  {filteredGuests.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-10 text-center text-sm text-muted">
                        {guests.length === 0 ? 'No guests yet for this event.' : 'No guests match these filters.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {filteredGuests.length > 0 && totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink-900 transition hover:bg-black/5 active:scale-[0.97] disabled:opacity-40"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            Prev
          </button>
          <p className="text-xs text-muted">
            Page {currentPage + 1} of {totalPages}
          </p>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage >= totalPages - 1}
            className="flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink-900 transition hover:bg-black/5 active:scale-[0.97] disabled:opacity-40"
          >
            Next
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget === 'bulk' ? `Delete ${selected.size} guests?` : 'Delete this guest?'}
        body="Their invite and check-in history can't be recovered."
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        confirmDisabled={deleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

interface RowCheckboxProps {
  checked: boolean
  indeterminate?: boolean
  onClick: () => void
  ariaLabel: string
}

// The bulk-select checkbox recipe — same rounded-square/border-2/checkmark
// shape AutoAssignDrawer's own guest-picker checkboxes already use, plus a
// dash glyph (MinusIcon) for "some but not all of this page," the header
// checkbox's own third state.
function RowCheckbox({ checked, indeterminate, onClick, ariaLabel }: RowCheckboxProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={ariaLabel}
      aria-checked={indeterminate ? 'mixed' : checked}
      role="checkbox"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
        checked || indeterminate ? 'border-accent-700 bg-accent-700' : 'border-black/15 bg-white hover:border-accent-700/40'
      }`}
    >
      {checked && <CheckmarkIcon className="h-3 w-3 text-white" />}
      {!checked && indeterminate && <MinusIcon className="h-3 w-3 text-white" />}
    </button>
  )
}

interface RowActionsMenuProps {
  guest: Guest
  open: boolean
  onOpenChange: (open: boolean) => void
  onViewProfile: () => void
  onRemove: () => void
}

// A row's own kebab menu. Used to expand as a plain `absolute` panel
// anchored to this same cell, but that cell lives inside the table's own
// rounded `overflow-hidden` card (see this view's own GLASS_CARD wrapper
// around the table) plus an `overflow-x-auto` scroll wrapper for narrow
// screens — either one clips a panel that opens past its edge, which is
// exactly what happened for rows near the bottom or right edge of the
// table. FloatingMenu (see its own doc) portals this out to the real page
// root instead, positioned off the trigger's own measured rect, so it never
// gets sliced by either ancestor. Click-away/Escape-to-close matches every
// other popover in this app (GuestFilterPopover, EventSwitcher's desktop
// dropdown).
function RowActionsMenu({ guest, open, onOpenChange, onViewProfile, onRemove }: RowActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  return (
    <div className="inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={`Actions for ${guest.name}`}
        aria-expanded={open}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition ${open ? 'bg-black/10 text-ink-900' : 'text-icon-gray hover:bg-black/5 hover:text-ink-900'}`}
      >
        <DotsVerticalIcon className="h-4 w-4" />
      </button>

      <FloatingMenu
        open={open}
        onClose={() => onOpenChange(false)}
        anchorRef={triggerRef}
        className="w-48 overflow-hidden rounded-2xl border border-white/60 bg-cream/90 p-1.5 shadow-[0_16px_40px_-12px_rgba(16,30,51,0.35)] backdrop-blur-xl"
      >
        <MenuItem
          icon={UserIcon}
          label="View profile"
          onClick={() => {
            onOpenChange(false)
            onViewProfile()
          }}
        />
        <MenuItem
          icon={CloseIcon}
          label="Remove guest"
          tone="danger"
          onClick={() => {
            onOpenChange(false)
            onRemove()
          }}
        />
      </FloatingMenu>
    </div>
  )
}

interface GuestRosterCardProps {
  guest: Guest
  seat: Seat | undefined
  onViewProfile: (guestId: string) => void
}

// A photo-forward card whose whole body opens the profile (this view has no
// second, competing click meaning the way the old combined tab's seat-
// assignment click did) — plus an explicit "View profile" button back on
// top of it too, the same visible affordance the original card had. No
// inline unassign control (unassigning a seat is a Seating-tab/profile-
// drawer action, not a roster-browsing one).
//
// Wrapped in memo with a value-based comparator (not the default shallow-
// prop one) — `seat` is looked up fresh from a Map on every parent render,
// and `guest` itself is a new object reference on every store read even
// when nothing about it changed, so the default comparator would never
// actually skip a re-render; this compares the fields that matter instead.
// Combined with memoizing genConfig below (react-nice-avatar's own config
// generation, not free), this is what keeps clicking one guest to open
// their profile from re-rendering and regenerating every OTHER card in the
// grid too — the actual cause of "laggy" here, since opening the profile
// drawer re-renders this whole view's parent.
const GuestRosterCard = memo(function GuestRosterCard({ guest, seat, onViewProfile }: GuestRosterCardProps) {
  // Keyed on the two primitive fields that actually affect it — guest.name/
  // imageUrl — rather than the whole guest object, so this only regenerates
  // when a guest's own name or photo actually changes, not on every render.
  const generated = useMemo(
    () => (guest.imageUrl ? null : (guest.avatarConfig ?? genConfig(guest.name))),
    [guest.imageUrl, guest.avatarConfig, guest.name]
  )
  const statusTone = STAGE_TONE[getGuestStage(guest)]

  function handleViewProfile() {
    onViewProfile(guest.id)
  }

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={handleViewProfile}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleViewProfile()
        }
      }}
      // contain: layout paint — see the grid's own doc for why (every card
      // is a fully self-contained visual subtree; nothing outside it reads
      // any child's exact position, so its own internal geometry never
      // needs to be part of an ancestor's reflow). contentVisibility: auto
      // goes further for whichever cards are actually off-screen at the
      // moment (the rows below the fold on a tall grid): the browser skips
      // laying out and painting their INSIDE entirely until they'd scroll
      // into view, rather than repainting all of them (up to 18 at
      // CARD_ROWS_PER_PAGE's own 3-rows-per-page) on every single frame of
      // a drawer's own 300ms push-reflow — see that constant's own doc for
      // why raising it back to 3 reopened exactly this cost.
      style={{ backgroundColor: generated?.bgColor ?? 'var(--color-rail)', contain: 'layout paint', contentVisibility: 'auto' }}
      className="group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-2xl text-left transition active:scale-[0.98]"
    >
      {guest.imageUrl ? (
        <img src={guest.imageUrl} alt={guest.name} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <Avatar {...generated!} shape="circle" className="absolute left-1/2 top-[14%] h-[52%] w-[52%] -translate-x-1/2" />
      )}

      <span className={`absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[9.5px] font-semibold text-white shadow-sm ${statusTone.solid}`}>
        {statusTone.label}
      </span>

      {/* Used to be a duplicated, blurred (blur-lg + FROST_MASK) copy of the
          photo underneath this same gradient, for a "frosted glass" fade
          instead of a flat one — dropped: up to 18 of these rendered at once
          (3 rows × up to 6 columns), a real per-card GPU blur cost that
          showed up as lag during the drawer's own 300ms push-reflow (see the
          grid's own `contain: layout` doc above for that animation). This
          gradient alone still darkens enough for the name/seat pill below to
          read clearly over any photo. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
        style={{ backgroundImage: 'linear-gradient(0deg, rgba(16,30,51,0.68) 0%, rgba(16,30,51,0.08) 62%, transparent 100%)' }}
      />

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-2.5">
        <div>
          <p className="truncate text-xs font-bold text-white">{guest.name}</p>
          {seat ? (
            <span className="mt-1 inline-flex w-fit rounded-full bg-white/20 px-2 py-0.5 text-[9.5px] font-medium text-white">{seat.label}</span>
          ) : (
            <span className="mt-1 inline-flex w-fit rounded-full border border-dashed border-white/40 px-2 py-0.5 text-[9.5px] font-medium text-white/70">
              Unassigned
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleViewProfile()
          }}
          // Glass, not solid — a translucent fill + border rather than
          // backdrop-blur (this app avoids backdrop-blur specifically for
          // scroll/render cost — see cardChrome.ts's FROST_MASK doc for the
          // same reasoning elsewhere): the "frosted" read comes from the
          // border + partial opacity alone, no per-frame resample. Tinted
          // ink-900 (the same dark tone the scrim right above it already
          // darkens every card down to), not white — a bright white pill
          // read as its own disconnected chip floating on top of whatever
          // photo/avatar color happens to be underneath it; tying its color
          // to the one thing every card already shares (that bottom scrim)
          // makes the button read as part of the card's own surface instead
          // of a separate overlay.
          className="flex min-h-[36px] w-full items-center justify-center rounded-full border border-white/10 bg-ink-900/40 text-[11px] font-bold text-white transition active:scale-[0.97] hover:bg-ink-900/55"
        >
          View profile
        </button>
      </div>
    </li>
  )
}, (prev, next) =>
  prev.guest.id === next.guest.id &&
  prev.guest.name === next.guest.name &&
  prev.guest.imageUrl === next.guest.imageUrl &&
  prev.guest.avatarConfig === next.guest.avatarConfig &&
  prev.guest.checkedInAt === next.guest.checkedInAt &&
  prev.guest.invites.wa.status === next.guest.invites.wa.status &&
  prev.guest.invites.email.status === next.guest.invites.email.status &&
  prev.seat?.id === next.seat?.id &&
  prev.seat?.label === next.seat?.label &&
  prev.onViewProfile === next.onViewProfile
)
