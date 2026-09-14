import type { Event } from '../data/types'

// Turns Event.imageFocalPoint into the CSS value every `object-cover`/
// `background-size: cover` photo render in this app (EventBanner, TicketCard,
// EventsPage) needs — one place so all three stay in agreement rather than
// three separate `${x}% ${y}%` templates that could drift out of sync.
export function focalPointToCss(focalPoint: Event['imageFocalPoint']): string {
  return focalPoint ? `${focalPoint.x}% ${focalPoint.y}%` : 'center'
}
