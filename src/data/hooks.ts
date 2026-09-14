import { useEffect, useState } from 'react'
import { subscribe, readValue, writeValue } from './store'
import { getActiveEvent, listEvents } from './events'
import { listGuests, listAllGuests } from './guests'
import { getSeatMapByEvent, listSeats, listSeatGroups } from './seatmaps'
import { listLayoutBlocks } from './layoutBlocks'
import { getProfile, updateProfile, PROFILE_KEY } from './profile'
import {
  listUsers,
  getStaffPermissions,
  updateStaffPermissions,
  canAccessSection,
  STAFF_PERMISSIONS_KEY,
  getStaffActionPermissions,
  updateStaffActionPermissions,
  STAFF_ACTION_PERMISSIONS_KEY,
} from './users'
import type { AppUser, DashboardSection, Event, Guest, LayoutBlock, Profile, Seat, SeatGroup, SeatMap, StaffActionPermissions, StaffPermissions } from './types'

const CURRENT_EVENT_KEY = 'currentEventId'

// Thin useState/useEffect wrappers around the entity modules — matches the
// existing per-component-state convention, but subscribing to store changes
// means every mounted consumer re-reads after any write, without Redux/Zustand.

export function useEvents(): Event[] {
  const [events, setEvents] = useState<Event[]>([])

  useEffect(() => {
    let alive = true
    const load = () => listEvents().then((rows) => alive && setEvents(rows))
    load()
    const unsub = subscribe('events', load)
    return () => {
      alive = false
      unsub()
    }
  }, [])

  return events
}

// The event every event-scoped page/widget is actually about — an explicit,
// persisted selection (not just "whichever is soonest"). Falls back to the
// soonest upcoming event the first time there's no selection yet, then
// remembers whatever the user picks via the second element of the returned
// tuple. Any component can read *and* change it — e.g. the TopHeader event
// switcher calls the setter, and every widget reading this hook re-renders.
export function useCurrentEvent(): [Event | null, (id: string) => void] {
  const [event, setEvent] = useState<Event | null>(null)

  useEffect(() => {
    let alive = true
    let unsubEvents: (() => void) | undefined
    let unsubCurrent: (() => void) | undefined

    async function load() {
      const events = await listEvents()
      const selectedId = readValue<string>(CURRENT_EVENT_KEY)
      let current = events.find((e) => e.id === selectedId) ?? null

      if (!current) {
        current = await getActiveEvent()
        if (current) writeValue(CURRENT_EVENT_KEY, current.id)
      }

      if (alive) setEvent(current)
    }

    // Subscribe only after the first load settles — otherwise the fallback
    // writeValue() above (picking a default when nothing's selected yet)
    // would notify a subscription registered moments earlier and trigger a
    // redundant second load() on mount.
    load().then(() => {
      if (!alive) return
      unsubEvents = subscribe('events', load)
      unsubCurrent = subscribe(CURRENT_EVENT_KEY, load)
    })

    return () => {
      alive = false
      unsubEvents?.()
      unsubCurrent?.()
    }
  }, [])

  function selectEvent(id: string) {
    writeValue(CURRENT_EVENT_KEY, id)
  }

  return [event, selectEvent]
}

export function useGuests(eventId?: string | null): Guest[] {
  const [guests, setGuests] = useState<Guest[]>([])

  useEffect(() => {
    if (!eventId) return undefined

    let alive = true
    const load = () => listGuests(eventId).then((rows) => alive && setGuests(rows))
    load()
    const unsub = subscribe('guests', load)
    return () => {
      alive = false
      unsub()
    }
  }, [eventId])

  return guests
}

export function useAllGuests(): Guest[] {
  const [guests, setGuests] = useState<Guest[]>([])

  useEffect(() => {
    let alive = true
    const load = () => listAllGuests().then((rows) => alive && setGuests(rows))
    load()
    const unsub = subscribe('guests', load)
    return () => {
      alive = false
      unsub()
    }
  }, [])

  return guests
}

// The one local Profile record (see that type's own doc) — reads
// synchronously off localStorage via readValue (same as currentEventId
// above), so there's no loading flash the way the Promise-wrapped entity
// tables get; the lazy useState initializer just starts correct. Every
// mounted consumer (TopHeader's avatar button, UserIdCardModal, IconRail's
// own future reads, SettingsPage) re-renders after any `patch` call —
// including ones from a DIFFERENT mounted instance, e.g. saving in
// SettingsPage updates what TopHeader's avatar button shows immediately.
export function useProfile(): [Profile, (patch: Partial<Profile>) => void] {
  const [profile, setProfile] = useState<Profile>(() => getProfile())

  useEffect(() => {
    const load = () => setProfile(getProfile())
    return subscribe(PROFILE_KEY, load)
  }, [])

  function patch(update: Partial<Profile>) {
    setProfile(updateProfile(update))
  }

  return [profile, patch]
}

export function useUsers(): AppUser[] {
  const [users, setUsers] = useState<AppUser[]>([])

  useEffect(() => {
    let alive = true
    const load = () => listUsers().then((rows) => alive && setUsers(rows))
    load()
    const unsub = subscribe('users', load)
    return () => {
      alive = false
      unsub()
    }
  }, [])

  return users
}

// Only Staff's permissions are ever read/written here — Admin's own access
// is a hardcoded invariant (see users.ts's own doc on why storing it was
// the actual bug).
export function useStaffPermissions(): [StaffPermissions, (next: StaffPermissions) => void] {
  const [perms, setPerms] = useState<StaffPermissions>(() => getStaffPermissions())

  useEffect(() => {
    const load = () => setPerms(getStaffPermissions())
    return subscribe(STAFF_PERMISSIONS_KEY, load)
  }, [])

  function patch(next: StaffPermissions) {
    updateStaffPermissions(next)
    setPerms(next)
  }

  return [perms, patch]
}

// The Permissions tab's own per-action detail rows (SECTION_ACTIONS) — a
// second, independent persisted blob alongside useStaffPermissions above,
// same subscribe/patch shape. See StaffActionPermissions' own doc: nothing
// outside SettingsPage reads this yet.
export function useStaffActionPermissions(): [StaffActionPermissions, (next: StaffActionPermissions) => void] {
  const [perms, setPerms] = useState<StaffActionPermissions>(() => getStaffActionPermissions())

  useEffect(() => {
    const load = () => setPerms(getStaffActionPermissions())
    return subscribe(STAFF_ACTION_PERMISSIONS_KEY, load)
  }, [])

  function patch(next: StaffActionPermissions) {
    updateStaffActionPermissions(next)
    setPerms(next)
  }

  return [perms, patch]
}

// The current Profile's own role, checked against Staff's permissions
// (Admin is always true — see users.ts's canAccessSection) — what
// IconRail/EventTabs/QuickActionsPanel/SettingsPage actually gate on.
// There's no login associating a specific AppUser with this browser
// session, so Profile.role (not any AppUser record) is what "the current
// session can do" means here.
export function useCanAccess(section: DashboardSection): boolean {
  const [profile] = useProfile()
  const [staffPerms] = useStaffPermissions()
  return canAccessSection(profile.role, section, staffPerms)
}

export interface SeatMapState {
  seatMap: SeatMap | null
  seats: Seat[]
  groups: SeatGroup[]
  layoutBlocks: LayoutBlock[]
}

export function useSeatMap(eventId?: string | null): SeatMapState {
  const [state, setState] = useState<SeatMapState>({ seatMap: null, seats: [], groups: [], layoutBlocks: [] })

  useEffect(() => {
    if (!eventId) return undefined
    let alive = true

    async function load() {
      const seatMap = await getSeatMapByEvent(eventId as string)
      if (!seatMap) {
        if (alive) setState({ seatMap: null, seats: [], groups: [], layoutBlocks: [] })
        return
      }
      const [seats, groups, layoutBlocks] = await Promise.all([
        listSeats(seatMap.id),
        listSeatGroups(seatMap.id),
        listLayoutBlocks(seatMap.id),
      ])
      if (alive) setState({ seatMap, seats, groups, layoutBlocks })
    }

    load()
    const unsubSeats = subscribe('seats', load)
    const unsubMaps = subscribe('seatmaps', load)
    const unsubGroups = subscribe('seatGroups', load)
    const unsubBlocks = subscribe('layoutBlocks', load)
    return () => {
      alive = false
      unsubSeats()
      unsubMaps()
      unsubGroups()
      unsubBlocks()
    }
  }, [eventId])

  return state
}
