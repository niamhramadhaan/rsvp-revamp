import { readValue, writeValue } from './store'

// Third-party sending configuration (see SettingsPage's Integrations tab).
// Everything here is configuration only for now: stored and editable, but no
// caller actually opens a network connection yet — SendInvitationsDrawer
// still only marks invites as sent (see that file's own doc), it just reads
// these settings to say *through what* it would send. Passwords/keys are
// stored as plain mock data like every other field in this app (see
// AppUser's own doc) — there is no vault here, same as there's no backend.

export type EmailProvider = 'none' | 'mailgun'
export type MessageProvider = 'none' | 'netmessage'

export interface EmailIntegrationSettings {
  provider: EmailProvider
  /** Shared sender identity, whichever provider is picked. */
  fromName: string
  fromEmail: string
  /** Mailgun fields. Secrets stay masked in the UI (see SettingsPage's
   * Integrations tab) — stored plain here like every other mock field. */
  mailgunApiKey: string
  mailgunDomain: string
}

export interface MessageIntegrationSettings {
  provider: MessageProvider
  /** NetMessage fields. */
  netmessageApiToken: string
  netmessageSender: string
}

export interface IntegrationSettings {
  email: EmailIntegrationSettings
  message: MessageIntegrationSettings
}

export const INTEGRATIONS_KEY = 'integrations'

const DEFAULT_EMAIL: EmailIntegrationSettings = {
  provider: 'none',
  fromName: '',
  fromEmail: '',
  mailgunApiKey: '',
  mailgunDomain: '',
}

const DEFAULT_MESSAGE: MessageIntegrationSettings = {
  provider: 'none',
  netmessageApiToken: '',
  netmessageSender: '',
}

export const DEFAULT_INTEGRATIONS: IntegrationSettings = {
  email: DEFAULT_EMAIL,
  message: DEFAULT_MESSAGE,
}

// Merges per-section over the defaults so a newly added field still reads
// as its own sensible default for anyone with an already-stored blob from
// before that field existed — same reasoning as getStaffPermissions.
export function getIntegrationSettings(): IntegrationSettings {
  const stored = readValue<Partial<IntegrationSettings>>(INTEGRATIONS_KEY, DEFAULT_INTEGRATIONS)
  return {
    email: { ...DEFAULT_EMAIL, ...stored.email },
    message: { ...DEFAULT_MESSAGE, ...stored.message },
  }
}

export function updateIntegrationSettings(next: IntegrationSettings): void {
  writeValue(INTEGRATIONS_KEY, next)
}

// Display names for "sends through X" copy (SendInvitationsDrawer's own
// channel tooltip). 'none' reads as what it is — nothing connected.
export const EMAIL_PROVIDER_LABELS: Record<EmailProvider, string> = {
  none: 'Not connected',
  mailgun: 'Mailgun',
}

export const MESSAGE_PROVIDER_LABELS: Record<MessageProvider, string> = {
  none: 'Not connected',
  netmessage: 'NetMessage',
}

// Whether the picked provider has its required fields filled in — what the
// Integrations tab's own status pill reads. 'none' is never "configured":
// picking no provider is a deliberate off state, not a half-filled form.
export function isEmailConfigured(s: EmailIntegrationSettings): boolean {
  if (s.provider === 'mailgun') return Boolean(s.mailgunApiKey.trim() && s.mailgunDomain.trim() && s.fromEmail.trim())
  return false
}

export function isMessageConfigured(s: MessageIntegrationSettings): boolean {
  if (s.provider === 'netmessage') return Boolean(s.netmessageApiToken.trim())
  return false
}

// Whether this channel is switched on at all — the SwitchRow toggle in
// Settings → Integrations (provider !== 'none'). SendInvitationsDrawer
// gates channel availability on this alone, not on isXConfigured above
// (still what the Integrations tab's own status pill reads): an admin who
// flips a channel on expects it to show up as sendable right away, not
// only once every credential field is also filled in and valid.
export function isEmailEnabled(s: EmailIntegrationSettings): boolean {
  return s.provider !== 'none'
}

export function isMessageEnabled(s: MessageIntegrationSettings): boolean {
  return s.provider !== 'none'
}
