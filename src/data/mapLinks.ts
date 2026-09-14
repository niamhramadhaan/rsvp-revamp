import type { Event } from './types'

// "Get directions" URL for an event's venue — derived straight from the
// dropped pin (Event.lat/lng, set via VenueField's map-plus-search picker).
// There's no separate manually-typed map-link field to prefer any more (see
// types.ts's Event doc — VenueField's real geocoding search replaced both
// that and the free-text Address field). Returns undefined when there's no
// pin yet — every caller already treats an undefined result as "plain text,
// no link".
export function getDirectionsUrl(event: Pick<Event, 'lat' | 'lng'>): string | undefined {
  if (event.lat != null && event.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`
  }
  return undefined
}
