import { memo, useRef, useState } from 'react'
import PageStage from './PageStage'
import Button from './Button'
import Switch from './Switch'
import ConfirmModal from './ConfirmModal'
import Toast, { type ToastState, type ToastTone } from './Toast'
import UserDrawer from './UserDrawer'
import SwitchRow from './SwitchRow'
import { TextField, FieldGroup } from './GroupedField'
import { PlusIcon, CloseIcon, PencilIcon, ChevronDownIcon, MailIcon, ChatBubbleIcon } from './icons/UiIcons'
import { useEvents, useStaffPermissions, useStaffActionPermissions, useUsers, useIntegrationSettings } from '../data/hooks'
import { useSlidingIndicator } from '../hooks/useSlidingIndicator'
import { removeUser, SECTION_ACTIONS } from '../data/users'
import {
  isEmailConfigured,
  isMessageConfigured,
} from '../data/integrations'
import type { AppUser, DashboardSection, PermissionActionGroup } from '../data/types'

type SettingsTab = 'users' | 'permissions' | 'integrations'

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

// Where invites actually go out through — one card per channel family,
// each with its own provider picker and credentials. Saves the instant a
// field changes (same as Permissions), so there's no separate dirty/saved
// state; the status pill reads straight off whether the picked provider's
// required fields are filled in (see integrations.ts). Configuration only:
// nothing here opens a live connection yet — the send drawers still only
// mark invites as sent, they just name the sender from here now.
// Where invites actually go out through — one card per channel family.
// Each card has two states: a read-only summary (secrets masked, never
// shown back) and an editor. The stored settings only change on Save, so
// Cancel truly discards and half-typed secrets never sit in storage. Test
// connection validates the draft locally (required fields present, then a
// short simulated handshake) — no live call exists yet, so it reports on
// the details, not on a real server round-trip.
function IntegrationsPanel({ onToast }: { onToast: (message: string, tone?: ToastTone) => void }) {
  const [settings, patchSettings] = useIntegrationSettings()

  const [emailEditing, setEmailEditing] = useState(false)
  const [emailDraft, setEmailDraft] = useState(settings.email)
  const [emailTest, setEmailTest] = useState<{ state: 'idle' } | { state: 'testing' } | { state: 'done'; ok: boolean; message: string }>({ state: 'idle' })

  const [messageEditing, setMessageEditing] = useState(false)
  const [messageDraft, setMessageDraft] = useState(settings.message)
  const [messageTest, setMessageTest] = useState<{ state: 'idle' } | { state: 'testing' } | { state: 'done'; ok: boolean; message: string }>({ state: 'idle' })

  const emailOk = isEmailConfigured(settings.email)
  const messageOk = isMessageConfigured(settings.message)

  function openEmailEditor() {
    setEmailDraft(settings.email)
    setEmailTest({ state: 'idle' })
    setEmailEditing(true)
  }

  function saveEmail() {
    patchSettings({ ...settings, email: emailDraft })
    setEmailEditing(false)
    setEmailTest({ state: 'idle' })
    onToast('Email sender updated')
  }

  function testEmail() {
    const missing: string[] = []
    if (!emailDraft.fromEmail.trim()) missing.push('From email')
    if (emailDraft.provider === 'mailgun') {
      if (!emailDraft.mailgunApiKey.trim()) missing.push('API key')
      if (!emailDraft.mailgunDomain.trim()) missing.push('Domain')
    }
    if (emailDraft.provider === 'none' || missing.length > 0) {
      setEmailTest({ state: 'done', ok: false, message: emailDraft.provider === 'none' ? 'Pick a provider first.' : `Missing: ${missing.join(', ')}.` })
      return
    }
    setEmailTest({ state: 'testing' })
    window.setTimeout(() => setEmailTest({ state: 'done', ok: true, message: 'Details check out.' }), 900)
  }

  function openMessageEditor() {
    setMessageDraft(settings.message)
    setMessageTest({ state: 'idle' })
    setMessageEditing(true)
  }

  function saveMessage() {
    patchSettings({ ...settings, message: messageDraft })
    setMessageEditing(false)
    setMessageTest({ state: 'idle' })
    onToast('NetMessage sender updated')
  }

  function testMessage() {
    if (messageDraft.provider === 'none' || !messageDraft.netmessageApiToken.trim()) {
      setMessageTest({
        state: 'done',
        ok: false,
        message: messageDraft.provider === 'none' ? 'Pick a provider first.' : 'Missing: API token.',
      })
      return
    }
    setMessageTest({ state: 'testing' })
    window.setTimeout(() => setMessageTest({ state: 'done', ok: true, message: 'Details check out.' }), 900)
  }

  return (
    <div className="flex flex-col gap-4">
      <FieldGroup label="Email sending" labelExtra={<StatusPill configured={emailOk} />}>
        {emailEditing ? (
          <div className="flex flex-col gap-4">
            <SwitchRow
              icon={MailIcon}
              iconTone="bg-accent-700/10 text-accent-700"
              title="Mailgun"
              description="Email through Mailgun's API"
              checked={emailDraft.provider !== 'none'}
              onChange={(on) => setEmailDraft({ ...emailDraft, provider: on ? 'mailgun' : 'none' })}
            />
            {emailDraft.provider !== 'none' && (
              <>
                <div className="flex gap-3">
                  <div className="min-w-0 flex-1">
                    <TextField label="From name" value={emailDraft.fromName} onChange={(fromName) => setEmailDraft({ ...emailDraft, fromName })} placeholder="Gamefinity Events" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <TextField label="From email" type="email" value={emailDraft.fromEmail} onChange={(fromEmail) => setEmailDraft({ ...emailDraft, fromEmail })} placeholder="invites@example.com" />
                  </div>
                </div>
                <TextField label="Mailgun API key" type="password" value={emailDraft.mailgunApiKey} onChange={(mailgunApiKey) => setEmailDraft({ ...emailDraft, mailgunApiKey })} />
                <TextField label="Mailgun domain" value={emailDraft.mailgunDomain} onChange={(mailgunDomain) => setEmailDraft({ ...emailDraft, mailgunDomain })} placeholder="mg.example.com" />
                <p className="text-[11px] text-muted">Sent through Mailgun's API — needs a key and a verified domain.</p>
              </>
            )}
            <TestResult test={emailTest} />
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={testEmail} disabled={emailTest.state === 'testing'}>
                {emailTest.state === 'testing' ? 'Testing…' : 'Test connection'}
              </Button>
              <Button variant="ghost" onClick={() => setEmailEditing(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveEmail}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex flex-col divide-y divide-black/5">
              <SummaryRow label="Provider" value={settings.email.provider === 'mailgun' ? 'Mailgun' : 'Off'} />
              <SummaryRow
                label="From"
                value={settings.email.fromName || settings.email.fromEmail ? `${settings.email.fromName}${settings.email.fromName && settings.email.fromEmail ? ' · ' : ''}${settings.email.fromEmail}` : '—'}
              />
              <SummaryRow label="Domain" value={settings.email.mailgunDomain || '—'} />
              <SummaryRow label="API key" secret set={Boolean(settings.email.mailgunApiKey)} />
            </div>
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" onClick={openEmailEditor}>
                Edit
              </Button>
            </div>
          </div>
        )}
      </FieldGroup>

      <FieldGroup label="NetMessage sending" labelExtra={<StatusPill configured={messageOk} />}>
        {messageEditing ? (
          <div className="flex flex-col gap-4">
            <SwitchRow
              icon={ChatBubbleIcon}
              iconTone="bg-accent-cyan/15 text-accent-cyan"
              title="NetMessage"
              description="Messages through NetMessage"
              checked={messageDraft.provider !== 'none'}
              onChange={(on) => setMessageDraft({ ...messageDraft, provider: on ? 'netmessage' : 'none' })}
            />
            {messageDraft.provider !== 'none' && (
              <>
                <TextField label="NetMessage API token" type="password" value={messageDraft.netmessageApiToken} onChange={(netmessageApiToken) => setMessageDraft({ ...messageDraft, netmessageApiToken })} />
                <TextField label="Sender ID" value={messageDraft.netmessageSender} onChange={(netmessageSender) => setMessageDraft({ ...messageDraft, netmessageSender })} placeholder="Gamefinity" />
                <p className="text-[11px] text-muted">NetMessage invites go out with this token.</p>
              </>
            )}
            <TestResult test={messageTest} />
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={testMessage} disabled={messageTest.state === 'testing'}>
                {messageTest.state === 'testing' ? 'Testing…' : 'Test connection'}
              </Button>
              <Button variant="ghost" onClick={() => setMessageEditing(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveMessage}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex flex-col divide-y divide-black/5">
              <SummaryRow label="Provider" value={settings.message.provider === 'netmessage' ? 'NetMessage' : 'Off'} />
              <SummaryRow label="Sender ID" value={settings.message.netmessageSender || '—'} />
              <SummaryRow label="API token" secret set={Boolean(settings.message.netmessageApiToken)} />
            </div>
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" onClick={openMessageEditor}>
                Edit
              </Button>
            </div>
          </div>
        )}
      </FieldGroup>
    </div>
  )
}

// One read-only row of the saved-state summary — plain values shown as-is,
// secrets as a fixed row of dots (never the value, never its length).
function SummaryRow({ label, value, secret, set }: { label: string; value?: string; secret?: boolean; set?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-muted">{label}</span>
      {secret ? (
        set ? (
          <span className="font-mono text-xs tracking-widest text-ink-900">••••••••</span>
        ) : (
          <span className="text-sm text-muted/70">Not set</span>
        )
      ) : (
        <span className="truncate text-sm font-medium text-ink-900">{value}</span>
      )}
    </div>
  )
}

// Test connection's own result line — nothing while idle, so a fresh editor
// doesn't carry a stale verdict.
function TestResult({ test }: { test: { state: 'idle' } | { state: 'testing' } | { state: 'done'; ok: boolean; message: string } }) {
  if (test.state === 'idle') return null
  if (test.state === 'testing') return <p className="text-xs font-medium text-muted">Testing…</p>
  return <p className={`text-xs font-medium ${test.ok ? 'text-status-confirmed' : 'text-status-declined'}`}>{test.message}</p>
}

function StatusPill({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="shrink-0 rounded-full bg-status-confirmed/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-status-confirmed">
      Configured
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
      Not connected
    </span>
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
          <p className="text-sm text-muted">Manage accounts, permissions, and the third-party senders invites go out through.</p>
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
              { key: 'integrations', label: 'Integrations' },
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

        {tab === 'users' ? <UsersPanel onToast={showToast} /> : tab === 'permissions' ? <PermissionsPanel /> : <IntegrationsPanel onToast={showToast} />}
      </div>

      <Toast toast={toast} />
    </PageStage>
  )
}

export default memo(SettingsPage)
