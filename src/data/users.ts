import { readTable, writeTable, genId, readValue, writeValue } from './store'
import type { AppUser, DashboardSection, PermissionActionGroup, StaffActionPermissions, StaffPermissions } from './types'

const TABLE = 'users'
export const STAFF_PERMISSIONS_KEY = 'staffPermissions'

// Admin's own access is a hardcoded invariant (full access is the point of
// the role — plan.md's own definition), never read from storage: an admin
// row here would only ever be one schema change away from going stale
// (exactly what happened the first time DashboardSection's own keys
// changed — the old stored blob kept its old keys, so `admin.guests` read
// back `undefined`/falsy even for an actual admin). Only Staff's
// permissions are genuinely configurable, so only Staff's are persisted.
export const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  guests: false,
  seating: false,
  checkIn: true,
  reports: false,
  roles: false,
}

export async function listUsers(): Promise<AppUser[]> {
  return readTable<AppUser>(TABLE)
}

export async function createUser(data: Omit<AppUser, 'id'>): Promise<AppUser> {
  const rows = readTable<AppUser>(TABLE)
  const user: AppUser = { id: genId('usr'), ...data }
  writeTable(TABLE, [...rows, user])
  return user
}

export async function updateUser(id: string, patch: Partial<Omit<AppUser, 'id'>>): Promise<void> {
  const rows = readTable<AppUser>(TABLE)
  writeTable(
    TABLE,
    rows.map((u) => (u.id === id ? { ...u, ...patch } : u))
  )
}

export async function removeUser(id: string): Promise<void> {
  writeTable(
    TABLE,
    readTable<AppUser>(TABLE).filter((u) => u.id !== id)
  )
}

// Merges over the defaults (rather than trusting the stored blob's own
// shape completely) so a future new DashboardSection still reads as its
// own sensible default instead of `undefined` for anyone who already has a
// stored value from before that section existed — the same class of bug
// this whole admin/staff split above was written to avoid, applied here
// too since Staff's own permissions ARE genuinely persisted.
export function getStaffPermissions(): StaffPermissions {
  const stored = readValue<Partial<StaffPermissions>>(STAFF_PERMISSIONS_KEY, DEFAULT_STAFF_PERMISSIONS)
  return { ...DEFAULT_STAFF_PERMISSIONS, ...stored }
}

export function updateStaffPermissions(next: StaffPermissions): void {
  writeValue(STAFF_PERMISSIONS_KEY, next)
}

export function canAccessSection(role: 'admin' | 'staff', section: DashboardSection, staffPerms: StaffPermissions): boolean {
  return role === 'admin' ? true : staffPerms[section]
}

// The Permissions tab's own "more detail on the actions" rows — one named
// action per PermissionActionGroup, shown once its parent group is expanded.
// Deliberately just labels + a persisted boolean each, same shape as
// DEFAULT_STAFF_PERMISSIONS above: nothing outside SettingsPage reads these
// yet (AddGuestDrawer's trigger, GuestProfileDrawer's delete button, etc.
// still only check the coarser section-level permission), so toggling one
// off here doesn't yet block anything — this is the configuration surface,
// ready for those call sites to start reading it action-by-action.
export const SECTION_ACTIONS: Record<PermissionActionGroup, { key: string; label: string }[]> = {
  guests: [
    { key: 'add', label: 'Add guest' },
    { key: 'edit', label: 'Edit guest' },
    { key: 'delete', label: 'Delete guest' },
    { key: 'import', label: 'Import guests (CSV)' },
    { key: 'sendInvites', label: 'Send invitations' },
  ],
  seating: [
    { key: 'edit', label: 'Edit seat map' },
    { key: 'assign', label: 'Assign guest to seat' },
    { key: 'autoAssign', label: 'Auto-assign seats' },
  ],
  checkIn: [
    { key: 'scan', label: 'Scan check-in' },
    { key: 'manual', label: 'Manual check-in' },
    { key: 'undo', label: 'Undo check-in' },
  ],
  reports: [{ key: 'export', label: 'Export report' }],
  roles: [
    { key: 'add', label: 'Add user' },
    { key: 'edit', label: 'Edit user' },
    { key: 'delete', label: 'Remove user' },
    { key: 'editPermissions', label: 'Edit permissions' },
  ],
  events: [
    { key: 'add', label: 'Add event' },
    { key: 'edit', label: 'Edit event' },
    { key: 'archive', label: 'Archive event' },
  ],
}

export const STAFF_ACTION_PERMISSIONS_KEY = 'staffActionPermissions'

// Mirrors the parent section's own DEFAULT_STAFF_PERMISSIONS value where one
// exists (every checkIn action defaults on, same as the section itself) —
// 'events' has no parent boolean to mirror (see PermissionActionGroup's own
// doc), so its actions start off, the same cautious default every other
// non-checkIn section already uses.
function defaultActionsFor(group: PermissionActionGroup): Record<string, boolean> {
  const sectionDefault = group in DEFAULT_STAFF_PERMISSIONS ? DEFAULT_STAFF_PERMISSIONS[group as DashboardSection] : false
  return Object.fromEntries(SECTION_ACTIONS[group].map((a) => [a.key, sectionDefault]))
}

export const DEFAULT_STAFF_ACTION_PERMISSIONS: StaffActionPermissions = {
  guests: defaultActionsFor('guests'),
  seating: defaultActionsFor('seating'),
  checkIn: defaultActionsFor('checkIn'),
  reports: defaultActionsFor('reports'),
  roles: defaultActionsFor('roles'),
  events: defaultActionsFor('events'),
}

// Merges per-group (not just over the top-level object) so a newly added
// action still reads as its own sensible default instead of `undefined` for
// anyone with an already-stored blob from before that action existed — same
// reasoning as getStaffPermissions above.
export function getStaffActionPermissions(): StaffActionPermissions {
  const stored = readValue<Partial<StaffActionPermissions>>(STAFF_ACTION_PERMISSIONS_KEY, DEFAULT_STAFF_ACTION_PERMISSIONS)
  const merged = {} as StaffActionPermissions
  for (const group of Object.keys(SECTION_ACTIONS) as PermissionActionGroup[]) {
    merged[group] = { ...DEFAULT_STAFF_ACTION_PERMISSIONS[group], ...stored[group] }
  }
  return merged
}

export function updateStaffActionPermissions(next: StaffActionPermissions): void {
  writeValue(STAFF_ACTION_PERMISSIONS_KEY, next)
}
