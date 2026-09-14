import { memo, useRef, useState } from 'react'
import PageStage from './PageStage'
import Button from './Button'
import Switch from './Switch'
import ConfirmModal from './ConfirmModal'
import Toast, { type ToastState, type ToastTone } from './Toast'
import UserDrawer from './UserDrawer'
import { PlusIcon, CloseIcon, PencilIcon, ChevronDownIcon } from './icons/UiIcons'
import { useEvents, useStaffPermissions, useStaffActionPermissions, useUsers } from '../data/hooks'
import { useSlidingIndicator } from '../hooks/useSlidingIndicator'
import { removeUser, SECTION_ACTIONS } from '../data/users'
import type { AppUser, DashboardSection, PermissionActionGroup } from '../data/types'

type SettingsTab = 'users' | 'permissions'

// Real dashboard sections, not generic CRUD actions — matches EventTabs/
// QuickActionsPanel exactly, which is what useCanAccess actually gates.
const SECTIONS: { key: DashboardSection; label: string }[] = [
  { key: 'guests', label: 'Guests' },
  { key: 'seating', label: 'Seating' },
  { key: 'checkIn', label: 'Check-in' },
  { key: 'reports', label: 'Reports' },
  { key: 'roles', label: 'Roles' },
]

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

// One "group row" of the Permissions tab — the existing section-level
// Admin/Staff switch (unchanged, still what useCanAccess actually reads),
// plus a chevron that expands into that section's own SECTION_ACTIONS —
// the "more detail on the actions" rows. Those per-action switches are
// configuration only for now (see StaffActionPermissions' own doc): stored
// and toggleable, not yet read by AddGuestDrawer/GuestProfileDrawer/etc.
// themselves.
function PermissionGroupRow({
  group,
  label,
  sectionAccess,
}: {
  group: PermissionActionGroup
  label: string
  /** Omitted for 'events', which has no section-level on/off of its own —
   * see PermissionActionGroup's own doc. */
  sectionAccess?: { staffChecked: boolean; onStaffChange: (checked: boolean) => void }
}) {
  const [expanded, setExpanded] = useState(false)
  const [actionPerms, patchActionPerms] = useStaffActionPermissions()
  const actions = SECTION_ACTIONS[group]

  function setAction(key: string, checked: boolean) {
    patchActionPerms({ ...actionPerms, [group]: { ...actionPerms[group], [key]: checked } })
  }

  return (
    <div className="rounded-xl border border-black/5 bg-black/[0.015]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="grid w-full grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 px-2.5 py-2.5 text-left transition hover:bg-black/[0.03]"
      >
        <span className="flex items-center gap-1.5 text-sm text-ink-900">
          <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : '-rotate-90'}`} />
          {label}
        </span>
        {sectionAccess ? (
          <>
            <span className="flex justify-center" onClick={(e) => e.stopPropagation()}>
              <Switch checked onChange={() => {}} disabled label={`${label} for Admin`} />
            </span>
            <span className="flex justify-center" onClick={(e) => e.stopPropagation()}>
              <Switch checked={sectionAccess.staffChecked} onChange={sectionAccess.onStaffChange} label={`${label} for Staff`} />
            </span>
          </>
        ) : (
          <span className="col-span-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted">Per-action only</span>
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-0.5 border-t border-black/5 px-2.5 py-2 pl-8">
          {actions.map((action) => (
            <div key={action.key} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 py-1">
              <span className="text-xs text-muted">{action.label}</span>
              <span className="flex justify-center">
                <Switch checked onChange={() => {}} disabled label={`${action.label} for Admin`} />
              </span>
              <span className="flex justify-center">
                <Switch
                  checked={actionPerms[group][action.key]}
                  onChange={(checked) => setAction(action.key, checked)}
                  label={`${action.label} for Staff`}
                />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PermissionsPanel() {
  const [staffPerms, patchStaffPerms] = useStaffPermissions()

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 px-2.5 pb-1">
        <span />
        <span className="text-center text-[11px] font-bold uppercase tracking-wide text-muted">Admin</span>
        <span className="text-center text-[11px] font-bold uppercase tracking-wide text-muted">Staff</span>
      </div>

      {SECTIONS.map((s) => (
        <PermissionGroupRow
          key={s.key}
          group={s.key}
          label={s.label}
          sectionAccess={{
            staffChecked: staffPerms[s.key],
            onStaffChange: (checked) => patchStaffPerms({ ...staffPerms, [s.key]: checked }),
          }}
        />
      ))}

      <PermissionGroupRow group="events" label="Events" />
    </div>
  )
}

function UserCard({
  user,
  eventNameById,
  onEdit,
  onRemove,
}: {
  user: AppUser
  eventNameById: Map<string, string>
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    // bg-white/40 (not solid bg-white) — same translucent-card recipe
    // EventSwitcher's own trigger already used, reused here instead of
    // inventing a second "card on cream" treatment.
    <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/40 p-3.5 transition hover:bg-white/70">
      <div className="flex items-start gap-3">
        {user.imageUrl ? (
          <img src={user.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-700/10 text-sm font-semibold text-accent-700">
            {initials(user.name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Edit ${user.name}`}
            onClick={onEdit}
            className="flex h-7 w-7 items-center justify-center rounded-full text-icon-gray transition hover:bg-black/10 hover:text-ink-900"
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Remove ${user.name}`}
            onClick={onRemove}
            className="flex h-7 w-7 items-center justify-center rounded-full text-icon-gray transition hover:bg-status-declined/10 hover:text-status-declined"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            user.role === 'admin' ? 'bg-accent-700/10 text-accent-700' : 'bg-black/5 text-ink-900/70'
          }`}
        >
          {user.role}
        </span>
        {user.eventIds.map((id) => (
          <span key={id} className="truncate rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] text-muted">
            {eventNameById.get(id) ?? 'Unknown event'}
          </span>
        ))}
      </div>
    </div>
  )
}

function UsersPanel({ onToast }: { onToast: (message: string, tone?: ToastTone) => void }) {
  const users = useUsers()
  const events = useEvents()
  const eventNameById = new Map(events.map((e) => [e.id, e.name]))
  const [formMode, setFormMode] = useState<'closed' | 'add' | string>('closed')
  const [removingUser, setRemovingUser] = useState<AppUser | null>(null)

  const editingUser = formMode !== 'closed' && formMode !== 'add' ? users.find((u) => u.id === formMode) : undefined

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{users.length} account{users.length === 1 ? '' : 's'}</p>
        <Button variant="primary" onClick={() => setFormMode('add')} className="flex shrink-0 items-center gap-1.5">
          <PlusIcon className="h-3.5 w-3.5" /> Add user
        </Button>
      </div>

      {users.length === 0 ? (
        <p className="rounded-2xl border border-black/5 bg-black/[0.02] p-6 text-center text-sm text-muted">No users yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {users.map((u) => (
            <UserCard key={u.id} user={u} eventNameById={eventNameById} onEdit={() => setFormMode(u.id)} onRemove={() => setRemovingUser(u)} />
          ))}
        </div>
      )}

      {/* A side drawer now (matching AddGuestDrawer), not a modal — same
          "stays open across a run of adds, closes right away on an edit"
          behavior that drawer already has, see UserDrawer's own doc. */}
      <UserDrawer
        open={formMode !== 'closed'}
        editingUser={editingUser}
        onClose={() => setFormMode('closed')}
        onCreated={(u) => onToast(`${u.name} added`)}
        onUpdated={(u) => onToast(`${u.name} updated`)}
      />

      <ConfirmModal
        open={Boolean(removingUser)}
        onClose={() => setRemovingUser(null)}
        title={`Remove ${removingUser?.name ?? 'this user'}?`}
        body="They'll lose access immediately — this can't be undone."
        tone="destructive"
        confirmLabel="Remove"
        onConfirm={() => {
          if (removingUser) {
            removeUser(removingUser.id)
            onToast('User removed')
          }
          setRemovingUser(null)
        }}
      />
    </div>
  )
}

function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('users')
  const [toast, setToast] = useState<ToastState | null>(null)
  const showToast = (message: string, tone: ToastTone = 'success') => setToast({ message, tone })
  const tabRailRef = useRef<HTMLDivElement>(null)
  const tabIndicator = useSlidingIndicator(tabRailRef, tab)

  return (
    <PageStage>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink-900">Users & Roles</h2>
          <p className="text-sm text-muted">Manage accounts and control who can access Guests, Seating, Check-in, and Reports.</p>
        </div>

        <div ref={tabRailRef} className="relative flex w-fit gap-1.5 rounded-2xl border border-black/5 bg-cream p-1.5">
          {tabIndicator && (
            <div
              aria-hidden="true"
              className="absolute left-0 top-0 rounded-xl bg-ink-900 transition-[transform,width] duration-300 ease-out"
              style={{ width: tabIndicator.width, height: tabIndicator.height, transform: `translate(${tabIndicator.left}px, ${tabIndicator.top}px)` }}
            />
          )}
          {(
            [
              { key: 'users', label: 'Users' },
              { key: 'permissions', label: 'Permissions' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              data-tab-key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative z-10 rounded-xl px-4 py-2 text-sm font-medium transition-colors active:scale-[0.97] ${
                tab === t.key ? 'text-white' : 'text-ink-900/70 hover:bg-black/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'users' ? <UsersPanel onToast={showToast} /> : <PermissionsPanel />}
      </div>

      <Toast toast={toast} />
    </PageStage>
  )
}

export default memo(SettingsPage)
