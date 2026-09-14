import { PencilIcon } from '../icons/UiIcons'
import { FROST_MASK } from './cardChrome'
import { focalPointToCss } from '../../utils/imagePosition'
import type { Event } from '../../data/types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export interface EventBannerProps {
  event: Event | null
  onEdit: () => void
}

// Hero for whichever event is currently selected (see TopHeader's event
// switcher) — this page IS that event's dashboard, so there's no "go to
// event" action here; there's nowhere else to go. It's also this event's
// only read-write surface for its own name/date/venue/description/photo —
// hence the Edit action, opening EditEventDrawer.
//
// A real photo — Event.imageUrl, set from EditEventDrawer/CreateEventDrawer's
// own upload field — fills the whole hero; the name/date/venue/description
// sit directly on it rather than inside a separate floating glass card (that
// card is gone — same "blur the photo itself, no extra block" treatment
// GuestSeatingList's own cards use, and for the same reason: a real
// filter: blur() on a cropped duplicate of the photo, revealed through a
// soft mask rather than backdrop-blur, so this doesn't pay backdrop-blur's
// per-frame resample cost). Most events don't have a photo yet (it's
// optional, and every event that existed before this field did simply
// doesn't have one) — the brand gradient + a decorative route line stand in
// for one then, the same honest "no photo to fake, so don't fake one"
// approach TicketCard's own banner already uses; there's no real photo
// detail to blur there, so that case keeps a plain gradient scrim only.
export default function EventBanner({ event, onEdit }: EventBannerProps) {
  if (!event) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-cream/40 bg-cream/20 p-10 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_30px_-12px_rgba(16,30,51,0.3)]">
        <p className="text-sm text-muted">No events yet — create one from the event switcher above.</p>
      </div>
    )
  }

  // BannerImageField's own drag-to-reposition handle (GroupedField.tsx) —
  // applied identically to both the sharp photo and its blurred duplicate
  // below, or the two would crop different parts of the same source image
  // and the frost mask would show a visible seam instead of a blur.
  const focalPosition = focalPointToCss(event.imageFocalPoint)

  return (
    // banner-float — a slow, few-pixel bob (transform-only, see index.css)
    // so the hero doesn't just sit dead still; the rounded-3xl clip stays on
    // this same element so the drop shadow (which isn't part of the clipped
    // box) reads as riding along with it rather than staying pinned.
    <div
      className="overflow-hidden rounded-3xl shadow-[0_20px_50px_-20px_rgba(16,30,51,0.3)]"
      style={{ animation: 'banner-float 6s ease-in-out infinite' }}
    >
      <div
        className="relative flex h-56 flex-col justify-between p-4 sm:h-64 sm:p-5"
        style={
          event.imageUrl
            ? { backgroundImage: `url(${event.imageUrl})`, backgroundSize: 'cover', backgroundPosition: focalPosition }
            : undefined
        }
      >
        {!event.imageUrl && (
          <>
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-accent-700 to-accent-cyan" />
            <svg
              aria-hidden="true"
              viewBox="0 0 160 120"
              className="pointer-events-none absolute -right-4 -top-2 hidden h-28 w-36 text-white/20 sm:block"
            >
              <path d="M10 100 C 60 100, 70 40, 140 20" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 6" strokeLinecap="round" />
              <circle cx="140" cy="20" r="4" fill="currentColor" />
            </svg>
          </>
        )}

        {/* The frosted strip under the text — a real photo only (see the
            component doc for why the gradient fallback skips it): cropped/
            positioned identically to the sharp photo above (same inset-0
            h-full w-full object-cover, same focalPosition) and revealed only
            near the bottom through a soft mask, the same "duplicate + mask"
            recipe GuestSeatingList's cards use, not a hard-edged crop window
            (that mismatch reads as a seam, not a blur — see that file's own
            doc for the bug this avoided; the same reasoning is why this
            can't reuse `center` while the sharp layer uses a real focal
            point). */}
        {event.imageUrl && (
          <img
            src={event.imageUrl}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover blur-lg"
            style={{ objectPosition: focalPosition, WebkitMaskImage: FROST_MASK, maskImage: FROST_MASK }}
          />
        )}

        {/* Dark scrim on top of the (possibly frosted) photo — keeps the
            white text legible regardless of how bright the photo itself
            is, same gradient recipe TicketCard's own banner already uses. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
          style={{ backgroundImage: 'linear-gradient(0deg, rgba(16,30,51,0.75) 0%, rgba(16,30,51,0.05) 60%, transparent 100%)' }}
        />

        <div className="relative z-10 flex items-start justify-between gap-3">
          {/* Was a relative "In X days"/"Tomorrow" countdown — replaced with
              the plain date itself (see formatDate below), since the live
              day-by-day countdown already has its own dedicated widget
              right below this banner (EventCountdownWidget) — this pill
              doesn't need to duplicate that read, just anchor "which day is
              this." The metadata chip that used to repeat this same date
              further down (see this component's own history) is gone now
              that this pill already says it. */}
          <span className="inline-flex items-center rounded-full bg-cream/85 px-3 py-1 text-xs font-semibold text-accent-700 backdrop-blur-sm">
            {formatDate(event.date)}
          </span>
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit event details"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream/85 text-ink-900 backdrop-blur-sm transition hover:bg-cream active:scale-[0.9]"
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Sits directly on the photo/scrim now — no separate card block.
            No more runway ring on the right, either — it duplicated
            EventCountdownWidget's own live days:hrs:min gauge, which
            already sits right below this on Overview; the hero doesn't need
            a second progress-through-time read alongside the plain date
            pill above. Reclaiming that column is what lets the metadata
            line below become real compact chips instead of icon+text
            squeezed against a ring. */}
        <div className="relative z-10 min-w-0">
          <h2 className="truncate font-display text-lg font-bold text-white sm:text-xl">{event.name}</h2>
          {/* Venue/location pill (a "name — address" chip with a directions
              link) used to sit here — removed; the venue is still fully
              editable in EditEventDrawer and shown on the guest-facing
              ticket, this hero just doesn't repeat it any more. */}
          {event.description && <p className="mt-1.5 line-clamp-2 text-xs text-white/80">{event.description}</p>}
        </div>
      </div>
    </div>
  )
}
