import { lazy, Suspense, useId, useRef, useState, type FormEvent } from 'react'
import DrawerPanelPortal from '../DrawerPanelPortal'
import Button, { type ButtonProgress } from '../Button'
import { LabeledField, LabeledTextArea, FieldGroup, BannerImageField, LogoImageField } from '../GroupedField'
import { InfoTooltip } from '../Tooltip'
import { updateEvent } from '../../data/events'
import { PencilIcon, CalendarIcon, MailIcon, ChevronRightIcon } from '../icons/UiIcons'
import { TicketIcon } from '../icons/NavIcons'
import type { Event } from '../../data/types'

// See EventBanner's own doc for why this is lazy — VenueField pulls in
// MapLibre GL JS.
const VenueField = lazy(() => import('../map/VenueField'))

// See CreateEventDrawer's own doc for why — same limit, kept in step so a
// description doesn't clear here only to get rejected when re-edited there.
const DESCRIPTION_MAX_LENGTH = 240

export interface EditEventDrawerProps {
  event: Event | null
  onClose: () => void
  onSaved?: (event: Event) => void
  /** Opens InvitationTemplateDrawer for this same event — the caller (this
   * drawer can't own that hand-off itself, since it's rendered from two
   * places, EventsPage and OverviewContent, each with their own drawer
   * slot) is responsible for closing this drawer first, same "shared
   * single-slot" hand-off GuestProfileDrawer's own onViewTicket used to do
   * for TicketDrawer. Optional — a caller with nowhere to put a second
   * drawer just doesn't get the button. */
  onOpenInvitationTemplate?: (event: Event) => void
}

// Event-detail's edit action — the CreateEventDrawer counterpart for an
// event that already exists (see plan.md's "what's needed for event detail"
// assessment: everywhere an event's own name/date/venue/description showed
// up, it was read-only). Opened from EventBanner (Overview's event-detail
// hero) and from each card on the Events page. Seat categories/quotas and
// the floor-plan template picker used to live here too — both moved onto
// the seat map canvas itself (SeatMapCanvas's own floating quota chips and
// its template carousel modal), since they're about the floor plan, not
// this event's own name/date/venue/description.
export default function EditEventDrawer({ event, onClose, onSaved, onOpenInvitationTemplate }: EditEventDrawerProps) {
  const formId = useId()
  const [progress, setProgress] = useState<ButtonProgress>('idle')
  // Holds the saved event across Button's own 1s "Saved!" flash — closing
  // (and firing onSaved) waits for handleProgressSettle, same reasoning as
  // CreateEventDrawer's own pendingEventRef. Lives up here (not in
  // EditEventFields below) since it's this component's Button, not the
  // per-event-keyed child, that owns the flash timing.
  const pendingEventRef = useRef<Event | null>(null)

  function handleProgressSettle() {
    const saved = pendingEventRef.current
    pendingEventRef.current = null
    setProgress('idle')
    if (saved) onSaved?.(saved)
    onClose()
  }

  return (
    <DrawerPanelPortal
      open={Boolean(event)}
      onClose={onClose}
      title="Edit event"
      icon={PencilIcon}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} progress={progress} onProgressSettle={handleProgressSettle}>
            {progress === 'loading' ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      {/* Keyed by event.id: remounts fresh whenever a different event opens
          (or the same one reopens), so its fields always initialize
          straight from that event's own data — no effect-driven resync
          needed to keep the form in step with a prop that changes. */}
      {event && (
        <EditEventFields
          formId={formId}
          event={event}
          onProgress={setProgress}
          onSaveResult={(saved) => {
            pendingEventRef.current = saved
          }}
          onOpenInvitationTemplate={onOpenInvitationTemplate ? () => onOpenInvitationTemplate(event) : undefined}
          key={event.id}
        />
      )}
    </DrawerPanelPortal>
  )
}

interface EditEventFieldsProps {
  formId: string
  event: Event
  onProgress: (progress: ButtonProgress) => void
  /** Hands the freshly-saved event up to the parent's pendingEventRef —
   * separate from onProgress('success') itself only because the parent
   * needs the actual value, not just the state transition. */
  onSaveResult: (event: Event) => void
  onOpenInvitationTemplate?: () => void
}

function EditEventFields({ formId, event, onProgress, onSaveResult, onOpenInvitationTemplate }: EditEventFieldsProps) {
  const [name, setName] = useState(event.name)
  // datetime-local wants "YYYY-MM-DDTHH:mm", not the full ISO string
  // Event.date stores.
  const [date, setDate] = useState(event.date.slice(0, 16))
  const [venue, setVenue] = useState(event.venue)
  const [lat, setLat] = useState<number | undefined>(event.lat)
  const [lng, setLng] = useState<number | undefined>(event.lng)
  const [description, setDescription] = useState(event.description ?? '')
  const [imageUrl, setImageUrl] = useState<string | undefined>(event.imageUrl)
  const [imageFocalPoint, setImageFocalPoint] = useState<{ x: number; y: number } | undefined>(event.imageFocalPoint)
  const [logoUrl, setLogoUrl] = useState<string | undefined>(event.logoUrl)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim() || !date) return

    setError(null)
    onProgress('loading')
    // localStorage.setItem throws when the origin's quota is full — without
    // this try/finally, that throw left `submitting` stuck true forever (a
    // "Saving…" button that never resolves). ImageField's own compression
    // (see its doc) makes hitting the quota unlikely now, but this is the
    // backstop for whatever still manages to.
    try {
      const updated = await updateEvent(event.id, {
        name: name.trim(),
        date,
        venue: venue.trim(),
        lat,
        lng,
        description: description.trim(),
        imageUrl,
        imageFocalPoint,
        logoUrl,
      })
      if (updated) onSaveResult(updated)
      onProgress('success')
    } catch {
      setError('Could not save — your browser storage may be full. Try removing the photo or freeing up space.')
      onProgress('idle')
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
      <LabeledField label="Event name" value={name} onChange={setName} icon={TicketIcon} required autoFocus />
      <FieldGroup label="Schedule & venue">
        <LabeledField label="Date & time" type="datetime-local" value={date} onChange={setDate} icon={CalendarIcon} required />
        <Suspense fallback={<p className="text-xs text-muted">Loading venue search…</p>}>
          <VenueField
            venue={venue}
            onVenueChange={setVenue}
            lat={lat}
            lng={lng}
            onPinChange={(newLat, newLng) => {
              setLat(newLat)
              setLng(newLng)
            }}
            onClear={() => {
              setLat(undefined)
              setLng(undefined)
            }}
          />
        </Suspense>
      </FieldGroup>
      <LabeledTextArea label="Description" value={description} onChange={setDescription} rows={3} maxLength={DESCRIPTION_MAX_LENGTH} />

      <BannerImageField label="Event photo" value={imageUrl} onChange={setImageUrl} focalPoint={imageFocalPoint} onFocalPointChange={setImageFocalPoint} />

      <LogoImageField label="Event logo" value={logoUrl} onChange={setLogoUrl} />

      {onOpenInvitationTemplate && (
        <FieldGroup
          label="Invitation"
          labelExtra={<InfoTooltip label="The one invite every guest on this event gets." />}
        >
          <button
            type="button"
            onClick={onOpenInvitationTemplate}
            className="flex w-full items-center justify-between gap-2 rounded-xl bg-black/[0.03] px-3.5 py-3 text-left text-sm font-semibold text-ink-900 transition hover:bg-black/[0.06]"
          >
            <span className="flex items-center gap-2">
              <MailIcon className="h-4 w-4 text-accent-700" />
              Edit invitation template
            </span>
            <ChevronRightIcon className="h-4 w-4 text-icon-gray" />
          </button>
        </FieldGroup>
      )}

      {error && <p className="rounded-xl bg-status-declined/10 px-3.5 py-2.5 text-xs font-medium text-status-declined">{error}</p>}
    </form>
  )
}
