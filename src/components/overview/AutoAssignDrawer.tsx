import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from 'react'
import DrawerPanelPortal from '../DrawerPanelPortal'
import Button from '../Button'
import { autoAssignSeats, type AutoAssignment } from '../../data/seating'
import { getGuestStage, isGuestInvited } from '../../data/selectors'
import { useEnterTransition } from '../../hooks/useEnterTransition'
import { STAGE_TONE } from './cardChrome'
import GuestAvatar from './GuestAvatar'
import { AlertTriangleIcon, AutoAssignIcon, ChairIcon, CheckmarkIcon, FilterIcon, SearchIcon } from '../icons/UiIcons'
import type { Guest, Seat, SeatGroup } from '../../data/types'
import type { ToastTone } from '../Toast'

type GuestInviteFilter = 'all' | 'invited' | 'not_invited'

export interface AutoAssignDrawerProps {
  open: boolean
  onClose: () => void
  eventId: string | null
  guests: Guest[]
  seats: Seat[]
  groups: SeatGroup[]
  onToast: (message: string, tone?: ToastTone) => void
}

// How long each already-committed pairing stays "pending" before its own
// reveal — the write itself is instant and atomic (see autoAssignSeats'
// own doc); this is purely a presentation pace, not real progress.
const REVEAL_INTERVAL_MS = 380

// Replaces the old one-click "Auto assign" (which silently filled every
// empty seat with every eligible guest, no way to say "just these people" or
// "only into VIP") — a real two-step setup (WHO first, then WHICH seats) plus
// a visible payoff (watching each pairing land) instead of an instant, opaque
// bulk write. Split into two steps rather than one screen with both pickers
// stacked — picking guests and picking a seat category are two genuinely
// different decisions, and putting the category step second (once the
// guest count is already locked in) is what lets it show something the old
// single-screen version couldn't: whether that many guests actually FIT the
// category being considered (see shortfall below), not just how many empty
// seats exist in isolation. The write itself is still one atomic call
// (autoAssignSeats) same as before; everything after that is a replay of
// what already happened, not a staged/partial commit — closing this drawer
// mid-reveal can't leave anything half-done.
export default function AutoAssignDrawer({ open, onClose, eventId, guests, seats, groups, onToast }: AutoAssignDrawerProps) {
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<'guests' | 'category' | 'revealing' | 'done'>('guests')
  const [assignments, setAssignments] = useState<AutoAssignment[]>([])
  const [revealedCount, setRevealedCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  // Step 1's own search/filter — scoped to just this drawer's session, same
  // as everything else here (see the reset-on-open effect below). No "Seat"
  // dimension the way GuestsView's own GuestFilterPopover has one — every
  // guest in `eligible` is already unseated by definition, so a seat filter
  // would only ever have one meaningful value here.
  const [guestQuery, setGuestQuery] = useState('')
  const [inviteFilter, setInviteFilter] = useState<GuestInviteFilter>('all')
  const [filterOpen, setFilterOpen] = useState(false)

  // Every unseated guest, invited or not — the checkbox below is the actual
  // consent to seat someone now, not their invite status, so a guest who
  // hasn't been invited yet can still be picked here (their own status pill
  // below makes that visible, not hidden).
  const eligible = useMemo(() => guests.filter((g) => !g.seatId), [guests])

  // What step 1's list actually shows — search + invite filter narrow this
  // down from `eligible`, but `checked` itself is never pruned by it, so
  // switching the filter around (or clearing the search) never silently
  // drops an already-picked guest that's just scrolled out of view for the
  // moment.
  const filteredEligible = useMemo(() => {
    const q = guestQuery.trim().toLowerCase()
    return eligible.filter((g) => {
      if (inviteFilter !== 'all' && isGuestInvited(g) !== (inviteFilter === 'invited')) return false
      if (q && !g.name.toLowerCase().includes(q) && !(g.organization ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [eligible, guestQuery, inviteFilter])
  const isFiltered = guestQuery.trim() !== '' || inviteFilter !== 'all'

  // How many empty seats each group actually has right now — shown next to
  // the group picker below so picking "VIP seats" isn't a guess about
  // whether there's room; recomputed from the live seats prop, not cached,
  // so it stays right if a seat gets freed up while this is open.
  const emptyCountByGroup = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of seats) {
      if (s.kind === 'seat' && s.status === 'empty') counts.set(s.groupId, (counts.get(s.groupId) ?? 0) + 1)
    }
    return counts
  }, [seats])
  const totalEmpty = useMemo(() => seats.filter((s) => s.kind === 'seat' && s.status === 'empty').length, [seats])

  // Fresh setup screen every time this opens — not remembered from a
  // previous session, which could otherwise show a stale selection against
  // a guest list that's since changed. Defaults to already-invited guests
  // checked (the closest real signal to "we expect them," see selectors.ts's
  // isGuestInvited doc) — not-yet-invited guests are still listed (see
  // eligible's own doc), just not pre-checked, so including one is a
  // deliberate opt-in rather than something that happens by default.
  useEffect(() => {
    if (!open) return
    setGroupFilter('all')
    setChecked(new Set(eligible.filter(isGuestInvited).map((g) => g.id)))
    setPhase('guests')
    setAssignments([])
    setRevealedCount(0)
    setGuestQuery('')
    setInviteFilter('all')
    setFilterOpen(false)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // How many empty seats the CURRENTLY-considered category actually has —
  // 'all' means "anywhere," so that's every empty seat; a specific group
  // means just that group's own. Compared against how many guests are
  // actually checked to surface the one thing the old single-screen picker
  // never could: whether this pairing is even going to fit, before
  // committing to it (see the warning banner on the category step below).
  const availableInFilter = groupFilter === 'all' ? totalEmpty : (emptyCountByGroup.get(groupFilter) ?? 0)
  const shortfall = Math.max(checked.size - availableInFilter, 0)

  // Plays back the assignment list one entry at a time — a toast per
  // pairing (reusing the app's one shared toast slot; a fast run of these
  // just replaces the previous one before it would've faded, reading as a
  // quick sequence rather than a queue) plus this drawer's own animated
  // checklist below, which is what advances revealedCount here.
  useEffect(() => {
    if (phase !== 'revealing') return
    if (revealedCount >= assignments.length) {
      setPhase('done')
      return
    }
    const timer = window.setTimeout(
      () => {
        const next = assignments[revealedCount]
        onToast(`${next.guestName} → ${next.seatLabel}`)
        setRevealedCount((c) => c + 1)
      },
      revealedCount === 0 ? 0 : REVEAL_INTERVAL_MS
    )
    return () => window.clearTimeout(timer)
  }, [phase, revealedCount, assignments, onToast])

  function toggleGuest(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Acts on whatever's currently VISIBLE (filteredEligible), not every
  // eligible guest overall — filter down to "Not invited," Select all,
  // adjust the filter, Select all again is the actual point of pairing a
  // filter with this button; scoping it to the full unfiltered pool instead
  // would make the filter useless for building up a selection this way.
  function toggleAllFiltered() {
    const ids = filteredEligible.map((g) => g.id)
    const allFilteredChecked = ids.length > 0 && ids.every((id) => checked.has(id))
    setChecked((prev) => {
      const next = new Set(prev)
      if (allFilteredChecked) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
  }

  async function handleAssign() {
    if (!eventId || checked.size === 0) return
    setSubmitting(true)
    const result = await autoAssignSeats(eventId, {
      guestIds: [...checked],
      groupId: groupFilter === 'all' ? null : groupFilter,
    })
    setSubmitting(false)
    if (result.length === 0) {
      onToast('No matching empty seats for that selection', 'warning')
      return
    }
    setAssignments(result)
    setRevealedCount(0)
    setPhase('revealing')
  }

  function handleClose() {
    onClose()
  }

  // Blocks the final Assign action outright — a shortfall (some, but not
  // all, selected guests will fit) is only ever a warning further down, not
  // a block, since autoAssignSeats already handles "fewer seats than
  // guests" gracefully (it just seats as many as fit); zero seats in the
  // chosen category is the one case actually worth refusing the click for,
  // rather than letting it submit into a guaranteed "no matching empty
  // seats" toast.
  const categoryHasNoRoom = availableInFilter === 0

  return (
    <DrawerPanelPortal
      open={open}
      onClose={handleClose}
      title="Auto assign"
      icon={AutoAssignIcon}
      footer={
        phase === 'guests' ? (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setPhase('category')} disabled={checked.size === 0}>
              Next · {checked.size} guest{checked.size === 1 ? '' : 's'}
            </Button>
          </>
        ) : phase === 'category' ? (
          <>
            <Button variant="ghost" onClick={() => setPhase('guests')}>
              Back
            </Button>
            <Button variant="primary" onClick={handleAssign} disabled={submitting || categoryHasNoRoom}>
              {submitting ? 'Assigning…' : `Assign ${checked.size} guest${checked.size === 1 ? '' : 's'}`}
            </Button>
          </>
        ) : (
          <Button variant="dark" onClick={handleClose} disabled={phase !== 'done'}>
            {phase === 'done' ? 'Done' : 'Assigning…'}
          </Button>
        )
      }
    >
      {phase === 'guests' ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Guests · {checked.size} of {eligible.length}
            </p>
            {filteredEligible.length > 0 && (
              <button type="button" onClick={toggleAllFiltered} className="text-xs font-semibold text-accent-700 hover:underline">
                {filteredEligible.every((g) => checked.has(g.id)) ? 'Deselect all' : 'Select all'}
                {isFiltered ? ` (${filteredEligible.length})` : ''}
              </button>
            )}
          </div>

          {eligible.length > 0 && (
            <div className="mb-2 flex items-center gap-2">
              {/* Same search-bar recipe GuestsView's own roster search uses
                  — a rounded-full white bar with an inline icon, no separate
                  label. */}
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3.5 py-2 shadow-sm">
                <SearchIcon className="h-4 w-4 shrink-0 text-icon-gray" />
                <input
                  type="text"
                  value={guestQuery}
                  onChange={(e) => setGuestQuery(e.target.value)}
                  placeholder="Search guests"
                  className="w-full min-w-0 bg-transparent text-sm text-ink-900 outline-none placeholder:text-muted"
                />
              </div>

              {/* Invite-status filter only — no "Seat" dimension the way
                  GuestsView's own GuestFilterPopover has one, since every
                  guest in this list is already unseated by definition (see
                  eligible's own doc); a seat filter here would only ever
                  have one real answer. */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterOpen((v) => !v)}
                  aria-label="Filter guests"
                  className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition ${
                    inviteFilter !== 'all'
                      ? 'border-accent-700/30 bg-accent-700/10 text-accent-700'
                      : 'border-black/10 bg-white text-ink-900 hover:bg-black/5'
                  }`}
                >
                  <FilterIcon className="h-4 w-4" />
                  {inviteFilter !== 'all' && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent-700" />}
                </button>
                <InviteFilterMenu open={filterOpen} onOpenChange={setFilterOpen} value={inviteFilter} onChange={setInviteFilter} />
              </div>
            </div>
          )}

          {eligible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-sm text-muted">
              No unseated guests to assign.
            </p>
          ) : filteredEligible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-sm text-muted">
              No guests match that search/filter.
            </p>
          ) : (
            // Taller than a plain "picker" list used to be (420px → 560px) —
            // step 1 now has the whole drawer body to itself (the category
            // step moved to its own screen), so there's room to actually
            // show more rows at once before scrolling kicks in.
            <ul className="no-scrollbar flex max-h-[560px] flex-col gap-1 overflow-y-auto rounded-xl border border-black/5 p-1.5">
              {filteredEligible.map((g) => {
                const isChecked = checked.has(g.id)
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
                        <p className="truncate text-xs text-muted">{g.organization || 'Guest'}</p>
                      </div>
                      {/* Not-yet-invited guests are listed too (see
                          eligible's own doc) — a visible pill, not just
                          the avatar's own ring, makes picking one of them
                          here a clearly seen choice. */}
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STAGE_TONE[getGuestStage(g)].wash} ${STAGE_TONE[getGuestStage(g)].text}`}
                      >
                        {STAGE_TONE[getGuestStage(g)].label}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : phase === 'category' ? (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-ink-900">
            Seating <span className="font-semibold">{checked.size}</span> guest{checked.size === 1 ? '' : 's'} — pick where they go.
          </p>

          {/* The "memorable" step — real cards (icon badge + label + open-
              seat count), not the old inline pill row. A big colored tile per
              category reads as a real decision worth pausing on, the way a
              row of small text pills tucked above the guest list (the old
              layout) didn't — easy to miss, easy to leave on its default. */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <CategoryCard
              active={groupFilter === 'all'}
              onClick={() => setGroupFilter('all')}
              icon={AutoAssignIcon}
              label="Any empty seat"
              count={totalEmpty}
            />
            {groups.map((g) => (
              <CategoryCard
                key={g.id}
                active={groupFilter === g.id}
                onClick={() => setGroupFilter(g.id)}
                icon={ChairIcon}
                label={g.label}
                count={emptyCountByGroup.get(g.id) ?? 0}
                colorHex={g.color}
              />
            ))}
          </div>

          <p className="-mt-2 text-xs text-muted">
            {groupFilter === 'all'
              ? "Fills whatever's empty first, in floor-plan order — same as before."
              : `Only fills empty ${groups.find((g) => g.id === groupFilter)?.label} seats.`}
          </p>

          {/* Validation feedback — the actual point of asking for a category
              AFTER guests are already locked in: this is the one place that
              can compare "how many did you pick" against "how many seats
              does THIS category actually have," and say so before the
              write happens rather than after. A shortfall is a warning, not
              a block (autoAssignSeats already seats as many as fit and
              leaves the rest); zero seats in the category is stronger —
              nothing at all would happen, so that one disables Assign
              outright (see categoryHasNoRoom, wired into the footer). */}
          {categoryHasNoRoom ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-status-declined/10 px-3.5 py-3 text-status-declined">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs font-medium">
                {groupFilter === 'all' ? 'There are no empty seats left at all.' : `There are no empty ${groups.find((g) => g.id === groupFilter)?.label} seats.`} Pick a different category, or seat fewer guests.
              </p>
            </div>
          ) : (
            shortfall > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl bg-status-pending/10 px-3.5 py-3 text-status-pending">
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-xs font-medium">
                  Only {availableInFilter} of your {checked.size} selected guests will get a seat this round — {shortfall} won’t fit into{' '}
                  {groupFilter === 'all' ? 'what’s empty' : groups.find((g) => g.id === groupFilter)?.label}. The rest stay unseated, ready to try again.
                </p>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            {phase === 'done'
              ? `Assigned ${assignments.length} guest${assignments.length === 1 ? '' : 's'} to a seat.`
              : 'Assigning each guest to a seat…'}
          </p>
          <ul className="flex flex-col gap-1.5">
            {assignments.map((a, i) => {
              const revealed = i < revealedCount
              return (
                <li
                  key={a.guestId}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${
                    revealed ? 'translate-x-0 bg-status-confirmed/10 opacity-100' : 'translate-x-1 opacity-40'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${
                      revealed ? 'bg-status-confirmed text-white' : 'border-2 border-dashed border-black/15'
                    }`}
                  >
                    {revealed && <CheckmarkIcon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">{a.guestName}</span>
                  <span className="shrink-0 rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-900">
                    {a.seatLabel}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </DrawerPanelPortal>
  )
}

// The category step's own selectable tile — a real icon badge (tinted by
// the group's own color via inline style, same `style={{ backgroundColor:
// g.color }}` convention SeatMapCanvas's seat tiles already use for this,
// since Tailwind can't express an arbitrary per-group hex at build time) in
// place of the old plain-text pill row, plus the open-seat count right on
// the card instead of buried in a trailing "· N" suffix. `colorHex` omitted
// (the "Any empty seat" option, which has no group of its own to tint by)
// falls back to this app's plain neutral ink tone rather than an arbitrary
// pick.
function CategoryCard({
  active,
  onClick,
  icon: Icon,
  label,
  count,
  colorHex,
}: {
  active: boolean
  onClick: () => void
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  count: number
  colorHex?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition active:scale-[0.97] ${
        active ? 'border-accent-700 bg-accent-700/5' : 'border-black/10 bg-white hover:bg-black/5'
      }`}
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-2xl"
        style={
          colorHex
            ? { backgroundColor: `color-mix(in srgb, ${colorHex} 16%, white)`, color: colorHex }
            : { backgroundColor: 'color-mix(in srgb, var(--color-ink-900) 8%, white)', color: 'var(--color-ink-900)' }
        }
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-ink-900">{label}</p>
        <p className="text-[11px] text-muted">
          {count} seat{count === 1 ? '' : 's'} open
        </p>
      </div>
    </button>
  )
}

// Step 1's own invite-status filter — the same segmented-pill dropdown
// GuestFilterPopover already uses elsewhere in this app, minus that
// component's "Seat" section (meaningless here — see this drawer's own
// filteredEligible doc). Kept local to this file rather than a shared
// component since it's this one drawer's own smaller subset of that
// pattern, not a second general-purpose filter widget.
function InviteFilterMenu({
  open,
  onOpenChange,
  value,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: GuestInviteFilter
  onChange: (value: GuestInviteFilter) => void
}) {
  const entered = useEnterTransition(open)
  const options: { value: GuestInviteFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'invited', label: 'Invited' },
    { value: 'not_invited', label: 'Not invited' },
  ]

  return (
    <>
      {open && <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />}
      <div
        inert={!open}
        className={`absolute right-0 top-[calc(100%+8px)] z-50 w-48 origin-top-right rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/5 transition duration-150 ease-out ${
          entered ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Invite status</p>
        <div className="mt-1.5 inline-flex max-w-full divide-x divide-black/10 overflow-hidden rounded-lg border border-black/10">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              // Auto-closes on pick — unlike GuestFilterPopover (which
              // leaves its own popover open so a second facet, Seat, can
              // still be picked in the same visit), this menu has exactly
              // one mutually-exclusive choice to make, so there's nothing
              // left to do here once one's picked.
              onClick={() => {
                onChange(opt.value)
                onOpenChange(false)
              }}
              className={`whitespace-nowrap px-2.5 py-1.5 text-xs font-medium transition ${
                opt.value === value ? 'bg-ink-900 text-white' : 'bg-white text-ink-900/70 hover:bg-black/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
