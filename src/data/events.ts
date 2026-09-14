import { readTable, writeTable, genId } from './store'
import type { Event, EventStatus, InvitationTemplate, NewEventInput } from './types'

/** Fields editable after creation via `updateEvent` — same shape as
 * `NewEventInput`, kept as its own type so a future divergence (e.g. a field
 * that's settable at creation but frozen after) doesn't have to fight a
 * shared alias. */
export type EventEditInput = NewEventInput

const TABLE = 'events'

export async function listEvents(): Promise<Event[]> {
  return readTable<Event>(TABLE)
}

export async function getEvent(id: string): Promise<Event | null> {
  return readTable<Event>(TABLE).find((e) => e.id === id) ?? null
}

// The event this app treats as "active" for the Overview page: the soonest
// non-archived event by date. Multi-event-aware from day one, per plan.md.
export async function getActiveEvent(): Promise<Event | null> {
  const events = readTable<Event>(TABLE).filter((e) => e.status !== 'archived')
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return events[0] ?? null
}

export async function createEvent(data: NewEventInput): Promise<Event> {
  const events = readTable<Event>(TABLE)
  const event: Event = {
    id: genId('evt'),
    status: 'live',
    createdAt: new Date().toISOString(),
    ...data,
  }
  writeTable(TABLE, [...events, event])
  return event
}

// Edits an existing event's own details (name/date/venue/description) — the
// event-detail counterpart to createEvent. Status/id/createdAt are never
// touched here; that's setEventStatus's job below.
export async function updateEvent(id: string, data: EventEditInput): Promise<Event | null> {
  const events = readTable<Event>(TABLE)
  let updated: Event | null = null
  writeTable(
    TABLE,
    events.map((e) => {
      if (e.id !== id) return e
      updated = { ...e, ...data }
      return updated
    })
  )
  return updated
}

// Replaces this event's whole invitation template in one shot — a separate
// function from updateEvent (not just `updateEvent(id, { invitationTemplate })`)
// for the same reason setEventStatus is: InvitationTemplateDrawer never
// touches this event's name/date/venue/description, so it shouldn't need to
// round-trip that whole EventEditInput shape just to save its own two
// fields.
export async function updateInvitationTemplate(id: string, template: InvitationTemplate): Promise<Event | null> {
  const events = readTable<Event>(TABLE)
  let updated: Event | null = null
  writeTable(
    TABLE,
    events.map((e) => {
      if (e.id !== id) return e
      updated = { ...e, invitationTemplate: template }
      return updated
    })
  )
  return updated
}

// Archive/restore — a status flip, never a delete, so history (guests,
// seating, past check-ins) stays intact. Backs the Events page's
// Archive/Restore action.
export async function setEventStatus(id: string, status: EventStatus): Promise<void> {
  const events = readTable<Event>(TABLE)
  writeTable(
    TABLE,
    events.map((e) => (e.id === id ? { ...e, status } : e))
  )
}
