import { lazy, Suspense, useId, useRef, useState, type FormEvent } from 'react'
import DrawerPanelPortal from '../DrawerPanelPortal'
import Button, { type ButtonProgress } from '../Button'
import { LabeledField, LabeledTextArea, FieldGroup, BannerImageField, LogoImageField } from '../GroupedField'
import { createEvent } from '../../data/events'
import { PlusIcon, CalendarIcon } from '../icons/UiIcons'
import { TicketIcon } from '../icons/NavIcons'
import type { Event } from '../../data/types'

// See EventBanner's own doc for why this is lazy — VenueField pulls in
// MapLibre GL JS (well over half a megabyte), and this drawer is imported
// eagerly by OverviewContent (open on demand, but its own code isn't) —
// most Overview visits never open "New event" at all.
const VenueField = lazy(() => import('../map/VenueField'))

// Keeps the description short enough to still read cleanly wherever it's
// shown — EventBanner's own hero clamps it to 2 lines (`line-clamp-2`);
// this stays roughly in that same "a sentence or two" budget rather than
// letting someone type a paragraph that just gets truncated anyway.
const DESCRIPTION_MAX_LENGTH = 240

export interface CreateEventDrawerProps {
  open: boolean
  onClose: () => void
  onCreated?: (event: Event) => void
}

export default function CreateEventDrawer({ open, onClose, onCreated }: CreateEventDrawerProps) {
  const formId = useId()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [venue, setVenue] = useState('')
  const [lat, setLat] = useState<number | undefined>(undefined)
  const [lng, setLng] = useState<number | undefined>(undefined)
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined)
  const [imageFocalPoint, setImageFocalPoint] = useState<{ x: number; y: number } | undefined>(undefined)
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined)
  const [progress, setProgress] = useState<ButtonProgress>('idle')
  const [error, setError] = useState<string | null>(null)
  // Holds the just-created event across the Button's own 1s "Saved!" flash
  // (see handleProgressSettle) — the drawer closing (and onCreated firing)
  // is deferred until then, so the flash is something the user actually
  // gets to see instead of vanishing the instant the save resolves.
  const pendingEventRef = useRef<Event | null>(null)

  function reset() {
    setName('')
    setDate('')
    setVenue('')
    setLat(undefined)
    setLng(undefined)
    setDescription('')
    setImageUrl(undefined)
    setImageFocalPoint(undefined)
    setLogoUrl(undefined)
    setError(null)
  }

  function handleClose() {
    onClose()
    reset()
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim() || !date) return

    setError(null)
    setProgress('loading')
    // See EditEventDrawer's own handleSubmit for why this is wrapped —
    // same "don't let a storage-quota throw strand this on Saving…forever"
    // backstop.
    try {
      const event = await createEvent({
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
      pendingEventRef.current = event
      setProgress('success')
    } catch {
      setError('Could not create the event — your browser storage may be full. Try removing the photo or freeing up space.')
      setProgress('idle')
    }
  }

  function handleProgressSettle() {
    const event = pendingEventRef.current
    pendingEventRef.current = null
    setProgress('idle')
    reset()
    if (event) onCreated?.(event)
    onClose()
  }

  return (
    <DrawerPanelPortal
      open={open}
      onClose={handleClose}
      title="New event"
      icon={PlusIcon}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          {/* `form={formId}` — submits the <form> below even though this
              button renders in Drawer's separate footer slot. */}
          <Button variant="primary" type="submit" form={formId} progress={progress} onProgressSettle={handleProgressSettle}>
            {progress === 'loading' ? 'Creating…' : 'Create event'}
          </Button>
        </>
      }
    >
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

        {error && <p className="rounded-xl bg-status-declined/10 px-3.5 py-2.5 text-xs font-medium text-status-declined">{error}</p>}
      </form>
    </DrawerPanelPortal>
  )
}
