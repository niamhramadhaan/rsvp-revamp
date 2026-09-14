// Shared entity/domain types for the data layer. Every module in src/data
// (and every component that consumes it) imports its shapes from here rather
// than re-declaring them ad hoc — see plan.md and the migration notes.

import type { AvatarFullConfig } from 'react-nice-avatar'

/** An event's lifecycle status. Only these two values are ever assigned:
 * `createEvent` defaults new events to 'live', and `getActiveEvent` filters
 * out 'archived' ones. */
export type EventStatus = 'live' | 'archived'

export interface Event {
  id: string
  name: string
  /** ISO 8601 date-time string. */
  date: string
  /** The venue's own name, e.g. "Kota Kasablanka" — filled in by VenueField
   * (components/map/VenueField.tsx), either typed by hand or picked from
   * its real-place search (geocoding.ts's searchPlaces, backed by Photon).
   * There's no separate street-address field any more: picking a search
   * result (or dropping/dragging the pin on the map) sets `lat`/`lng`
   * directly, which is now the one source of truth getDirectionsUrl
   * (mapLinks.ts) reads — a free-text address or pasted map link could
   * silently disagree with where the pin actually was, and never needed to
   * exist once the pin itself is real. */
  venue: string
  /** The venue's coordinates — dropped by picking a VenueField search
   * result, or by tapping/dragging the pin on its map directly. Optional:
   * most events, and every event that existed before this field did, don't
   * have one — VenueMapPreview simply renders nothing wherever it's
   * missing, and getDirectionsUrl returns undefined. */
  lat?: number
  lng?: number
  description?: string
  /** A data: URL (the browser-native base64 encoding of an uploaded file) —
   * this app has no backend to upload to, so the image lives inline in the
   * event record itself, same "everything lives in one JSON blob" approach
   * store.ts already uses for every other entity. Shown on EventBanner's
   * own glass-overlay hero and wherever else an event's own details are
   * viewed. Optional: most events, and every event that existed before this
   * field did, simply don't have one. */
  imageUrl?: string
  /** A square event logo / mark — same inline data: URL storage as
   * `imageUrl`, but a separate field because it serves a different job: the
   * small profile-photo-like chip in the event switcher dropdown/sheet (and
   * the Events page cards), not the wide banner hero. Stored compressed to
   * a small dimension (see LogoImageField) since it never renders past ~40px.
   * Optional: events without one fall back to the two-letter monogram chip. */
  logoUrl?: string
  /** Where the banner's own crop window sits within `imageUrl`, as
   * percentages (0-100, CSS `object-position`/`background-position`
   * convention) — set by BannerImageField's drag-to-reposition handle
   * whenever a photo doesn't naturally crop well at the banner's own
   * landscape ratio. Undefined (rather than defaulting to `{x:50,y:50}`
   * here) means "center" — EventBanner/EventsPage both fall back to plain
   * `object-position: center`/`background-position: center` when this is
   * absent, which is also every event's own state before this field
   * existed. */
  imageFocalPoint?: { x: number; y: number }
  status: EventStatus
  /** ISO 8601 date-time string. */
  createdAt: string
  /** What gets sent to every guest for this event — one uniform invitation,
   * not a per-guest ticket (see Guest.token's own doc for what replaced
   * that). Optional: most events, and every event that existed before this
   * field did, simply don't have one yet. Edited from EditEventDrawer's own
   * "Invitation template" button (InvitationTemplateDrawer), never at
   * creation time — see NewEventInput's own doc for why it's absent there. */
  invitationTemplate?: InvitationTemplate
}

/** The "message" variant of an invitation — banner + text + an optional PDF
 * attachment, all delivered the same "everything lives inline as a data:
 * URL" way every other file in this app's data layer already does (see
 * Event.imageUrl's own doc). Unlike an image, there's no compression pass
 * for a PDF (compressImage is image-specific), so a real attached file can
 * be considerably larger than any other single field this app stores —
 * InvitationTemplateDrawer caps the accepted file size specifically because
 * of that, not because of anything enforced here. */
export interface InvitationMessageTemplate {
  bannerImageUrl?: string
  bannerFocalPoint?: { x: number; y: number }
  bodyText?: string
  pdfDataUrl?: string
  pdfFileName?: string
}

/** The "email" variant — raw, admin-authored HTML, sent as-is. There's no
 * sanitization here (or anywhere this reads it) because there's nowhere
 * this app renders untrusted/guest-supplied HTML — this field is only ever
 * written by an admin/staff editing their own event, the same trust level
 * as every other field they can already type into this form. */
export interface InvitationEmailTemplate {
  html?: string
}

/** An event's own invitation template — up to one of each variant. Neither
 * is required: an event can have just a message template, just an email
 * one, both, or (before anyone's touched InvitationTemplateDrawer) neither. */
export interface InvitationTemplate {
  message?: InvitationMessageTemplate
  email?: InvitationEmailTemplate
}

/** Fields the caller supplies to `createEvent` — id/status/createdAt are
 * filled in by the store. */
export interface NewEventInput {
  name: string
  date: string
  venue: string
  lat?: number
  lng?: number
  description?: string
  imageUrl?: string
  imageFocalPoint?: { x: number; y: number }
  logoUrl?: string
}

export type SeatLabelScheme = 'group-sequence'

export interface SeatMap {
  id: string
  eventId: string
  rows: number
  columns: number
  labelScheme: SeatLabelScheme
}

export interface SeatGroup {
  id: string
  seatMapId: string
  label: string
  /** CSS color, e.g. '#0060A8'. */
  color: string
  /** Max guests this category is allocated — set from event details
   * (EditEventDrawer's "Seat categories & quotas" section), independent of
   * how many physical seats happen to be painted for it. Drives the seat
   * map's "N left of quota" readout. */
  quota: number
}

export type SeatKind = 'seat' | 'gap'
export type SeatStatus = 'empty' | 'assigned'

export interface Seat {
  id: string
  seatMapId: string
  groupId: string
  /** Row/column this seat was originally painted at — still what
   * label-numbering and "sort into a stable order" (e.g. auto-assign,
   * check-in's empty-seat list) key off. No longer what determines where
   * the seat actually renders on the canvas — see x/y. */
  row: number
  column: number
  /** Pixel position on the seat map's free-form canvas (SeatMapCanvas's own
   * unscaled coordinate space, top-left origin) — where the seat actually
   * sits once an admin has dragged it, independent of row/column. Seeded
   * from row/column so a freshly-generated seat map still starts out
   * grid-aligned. */
  x: number
  y: number
  label: string
  kind: SeatKind
  status: SeatStatus
  /** Set only for a chair generated around a LayoutBlock of kind
   * 'table-rect' (see layoutBlocks.ts's createTableBlock) — lets dragging
   * the table move its own chairs along with it. Absent on every other
   * seat (the whole pre-existing grid, and any seat added standalone via
   * the "+ Seat" library item); optional rather than `string | null` so
   * none of those existing seat object literals need updating. */
  tableBlockId?: string
}

// A placeable, non-assignable floor-plan element — the "component library"
// items alongside Seat (stage, a table's own surface, a custom labeled
// zone). Purely spatial/visual: nothing about guest assignment reads this,
// the same way nothing about it reads Seat's own row/column. Round tables
// were considered and dropped — rectangular only, so 'table-rect' is the
// only table kind rather than a wider union some future shape would need.
export type LayoutBlockKind = 'stage' | 'table-rect' | 'label'

export interface LayoutBlock {
  id: string
  seatMapId: string
  kind: LayoutBlockKind
  x: number
  y: number
  width: number
  height: number
  /** Display text — a stage's own name (defaults to "Stage"), or a custom
   * label's text (e.g. "Bar", "Entrance"). Unused for 'table-rect': its
   * generated chairs carry the identity there instead of a caption on the
   * table itself. */
  label: string
}

export type InviteChannelStatus = 'sent' | 'not_sent'
export type GuestStatus = 'active'

/** A guest's own response to the invitation — undefined means no response
 * yet ("Pending" in the UI). Distinct from `checkedInAt`/seating: this is
 * what they SAID, not what actually happened on the day (a guest can
 * accept and still no-show, or walk in having never responded at all —
 * see selectors.ts's own GuestStage doc for that separate ladder). Not
 * wired to any real external source yet (see Guest.token's own doc on the
 * still-external redemption flow) — settable here as plain data for now. */
export type RsvpStatus = 'accepted' | 'unsure' | 'declined'

export interface InviteInfo {
  status: InviteChannelStatus
  /** ISO 8601 date-time string, or null if never sent. */
  sentAt: string | null
}

export interface GuestContact {
  wa: string
  email: string
}

export interface GuestInvites {
  wa: InviteInfo
  email: InviteInfo
}

// Guest used to carry its own free-text `groupLabel` (VIP/Regular/Press/etc),
// deliberately decoupled from SeatGroup — the seat map's own category. That's
// gone now: grouping lives in exactly one place, the seat editor's SeatGroup,
// so a guest's "group" is whatever category their assigned seat belongs to
// (see selectors.ts's getGuestGroupLabel) rather than a second, independently
// editable field that could disagree with it. An unseated guest simply has
// no group yet.
export interface Guest {
  id: string
  eventId: string
  name: string
  contact: GuestContact
  role: string
  organization: string
  /** This guest's own invitation code — generated once at creation
   * (createGuest/createGuestsBulk, `genId('tok')`) and never regenerated.
   * Shown view-only (as text + a Code128 barcode) in GuestProfileDrawer's
   * own Invitation section, and it's the one value CheckInDrawer's
   * resolve() matches an exact scan/typed code against. Used to also back a
   * per-guest TicketCard (a whole flip-card "ticket" UI) — that's gone now
   * (see this file's own git history): guests get one shared invitation
   * per event, not an individually-generated ticket from this app, so this
   * field's only job left is being that check-in credential. */
  token: string
  seatId: string | null
  /** ISO 8601 date-time string, or null if no seat assigned yet. */
  seatAssignedAt: string | null
  invites: GuestInvites
  /** ISO 8601 date-time string, or null if not checked in. */
  checkedInAt: string | null
  checkedInBy: string | null
  status: GuestStatus
  /** See RsvpStatus's own doc. Optional/undefined = no response yet. */
  rsvpStatus?: RsvpStatus
  /** ISO 8601 date-time string — when this guest was added to the roster
   * (createGuest/createGuestsBulk). Every guest that existed before this
   * field did has none; GuestsView's own "Added" column and sort just read
   * it as blank/last for those. */
  createdAt?: string
  /** A data: URL — same "no backend, so it lives inline" approach
   * Event.imageUrl already uses, the raw uploaded photo as-is. Optional:
   * most guests don't have one, and every guest that existed before this
   * field did simply doesn't. See GuestAvatar.tsx for the generated-avatar
   * fallback when this is unset. */
  imageUrl?: string
  /** A pinned react-nice-avatar config — set only via the profile drawer's
   * own "Randomize" action (GuestProfileDrawer), which calls genConfig()
   * with no seed to get a genuinely random look, not the name-derived one.
   * Absent for every guest by default: GuestAvatar.tsx then falls back to
   * deriving one deterministically from the guest's own name instead (same
   * name → same look, every time). Ignored whenever imageUrl is set — a
   * real uploaded photo always wins over either generated option. */
  avatarConfig?: AvatarFullConfig
}

/** Fields the caller supplies to `createGuest` — id/token/invites/seat/
 * timestamps/status are all filled in by the store, same division of
 * labor as `NewEventInput`/`createEvent`. Only `name` is required — the plan
 * (see plan.md's guest-add spec) wants at least one contact method, but that
 * validation lives in the form, not the type. */
export interface NewGuestInput {
  name: string
  wa?: string
  email?: string
  role?: string
  organization?: string
  imageUrl?: string
  /** A pinned "Randomize" look chosen before the guest was even saved —
   * see Guest.avatarConfig's own doc. Only ever set by AddGuestDrawer's
   * own GuestAvatarPicker (bulk CSV import has no photo/avatar concept at
   * all, so createGuestsBulk never populates this). */
  avatarConfig?: AvatarFullConfig
}

/** Pure-derived counters computed from a Guest[] — see selectors.ts. There's
 * no RSVP-response concept here (see Guest's own doc for why): `invited`/
 * `notInvited` and `checkedIn`/`seatsAssigned` are the whole real lifecycle. */
export interface GuestCounts {
  total: number
  invited: number
  notInvited: number
  checkedIn: number
  seatsAssigned: number
}

export type ActivityType = 'invited_wa' | 'invited_email' | 'seat_assigned' | 'checked_in'

/** One flattened, timestamped guest event, before the display label is
 * attached (see getRecentActivity in selectors.ts). */
export interface RawActivityEvent {
  type: ActivityType
  guest: string
  /** ISO 8601 date-time string. */
  at: string
}

/** A RawActivityEvent plus its human-readable label — what getRecentActivity
 * actually returns. */
export interface ActivityEntry extends RawActivityEvent {
  label: string
}

/** Per-seat-category rollup of guest outcomes — the Reports tab's breakdown
 * table/bars, grouped by each guest's assigned seat's SeatGroup (see
 * getGuestGroupLabel) rather than a free-text field Guest itself no longer
 * carries. Derived only, like GuestCounts — never a stored counter. */
export interface GroupBreakdown {
  groupLabel: string
  total: number
  invited: number
  notInvited: number
  checkedIn: number
  /** Invited but never checked in. */
  noShows: number
  /** Checked in without ever being invited — a subset of both `checkedIn`
   * and `notInvited` (see selectors.ts's getWalkIns), broken out on its own
   * so a stacked bar can subtract it back out of `notInvited` and land on
   * mutually exclusive segments that actually sum to `total`. */
  walkIns: number
  /** Rounded percent, checkedIn/invited — 0 if no one in the group was invited. */
  attendanceRate: number
}

// The two roles plan.md's auth section describes (Admin = full access,
// Staff = check-in only). No real login yet, so this labels an account
// rather than enforcing anything by itself — RolesDrawer's permission
// matrix is what actually gives it teeth.
export type AppRole = 'admin' | 'staff'

// This app's one local "who's using this" record — no real account/login.
export interface Profile {
  name: string
  role: AppRole
  /** Data: URL, same convention Guest.imageUrl uses. */
  imageUrl?: string
}

/** Which real dashboard sections a role can reach, enforced by useCanAccess
 * (data/hooks.ts) against IconRail/EventTabs/QuickActionsPanel/
 * SettingsPage. Admin is always full-access — a code invariant, not
 * something stored/configurable (see users.ts's own doc) — so only
 * Staff's own permissions actually need a persisted shape. */
export type DashboardSection = 'guests' | 'seating' | 'checkIn' | 'reports' | 'roles'
export type StaffPermissions = Record<DashboardSection, boolean>

/** Every group the Permissions tab shows fine-grained actions for — the
 * five real DashboardSections above, plus 'events' (Events has no
 * section-level on/off of its own the way Guests/Seating/etc. do — nothing
 * gates the Events page itself — but "who can add/edit/archive an event" is
 * still worth breaking out as its own configurable action). */
export type PermissionActionGroup = DashboardSection | 'events'

/** One fine-grained action inside a PermissionActionGroup — e.g. Guests' own
 * "Add guest"/"Delete guest" — shown as sub-rows once a group is expanded in
 * the Permissions tab (see SettingsPage). Independent of StaffPermissions'
 * own section-level boolean, which still gates whether Staff can open that
 * section/tab at all — a staff member can see Guests but still have
 * "Delete guest" switched off. Configuration only for now: stored and
 * editable, but not yet read by AddGuestDrawer/GuestProfileDrawer/etc.
 * themselves — see users.ts's own doc on SECTION_ACTIONS. */
export type StaffActionPermissions = Record<PermissionActionGroup, Record<string, boolean>>

/** A real dashboard user account (RolesDrawer's own roster) — separate from
 * Profile ("me"). No real backend: `password` is stored as plain mock data
 * like everything else in this app (see store.ts), not hashed/authenticated
 * against anything — there's no login flow that reads it yet. */
export interface AppUser {
  id: string
  name: string
  email: string
  password: string
  role: AppRole
  eventIds: string[]
  /** Data: URL, same convention Guest.imageUrl uses. */
  imageUrl?: string
}
