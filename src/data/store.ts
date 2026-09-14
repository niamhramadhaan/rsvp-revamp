// Generic localStorage-backed table engine. This is the ONLY module that
// touches localStorage directly — every entity module (events.ts, guests.ts,
// seatmaps.ts) reads/writes through readTable/writeTable, so swapping to a
// real backend later only means rewriting the entity modules, not every
// component that uses them.

const PREFIX = 'gamefinity:'
const listeners = new Map<string, Set<() => void>>() // table name -> Set<() => void>

function storageKey(table: string): string {
  return `${PREFIX}${table}`
}

export function genId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`
}

export function readTable<T>(table: string): T[] {
  try {
    const raw = localStorage.getItem(storageKey(table))
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

export function writeTable<T>(table: string, rows: T[]): T[] {
  localStorage.setItem(storageKey(table), JSON.stringify(rows))
  listeners.get(table)?.forEach((fn) => fn())
  return rows
}

// Seed a table only the first time it's ever read (leaves it alone if the
// key already exists, even as an empty array — that means "user cleared it").
export function seedIfEmpty<T>(table: string, rows: T[]): void {
  if (localStorage.getItem(storageKey(table)) == null) writeTable(table, rows)
}

// Deletes a table's (or scalar value's) underlying localStorage key
// entirely — unlike writeTable(table, []), which leaves the key present as
// "the user deliberately emptied this" (see seedIfEmpty's comment above),
// this makes seedIfEmpty treat it as genuinely never-seeded again. Used by
// init.ts's version-bump reseed, the one place this app intentionally wipes
// rather than just writes.
export function clearTable(table: string): void {
  localStorage.removeItem(storageKey(table))
  listeners.get(table)?.forEach((fn) => fn())
}

// Same idea as readTable/writeTable but for a single scalar value rather
// than an array of rows — e.g. "which event is currently selected." Shares
// the same key/listener map, just under whatever key name you pass.
export function readValue<T>(key: string): T | null
export function readValue<T>(key: string, fallback: T): T
export function readValue<T>(key: string, fallback: T | null = null): T | null {
  try {
    const raw = localStorage.getItem(storageKey(key))
    return raw != null ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeValue<T>(key: string, value: T): void {
  localStorage.setItem(storageKey(key), JSON.stringify(value))
  listeners.get(key)?.forEach((fn) => fn())
}

// Subscribe to changes on one table (any writeTable call for it). Used by the
// hooks in data/hooks.ts so every mounted component re-reads after a write,
// without needing Redux/Zustand.
export function subscribe(table: string, fn: () => void): () => void {
  if (!listeners.has(table)) listeners.set(table, new Set())
  listeners.get(table)!.add(fn)
  return () => listeners.get(table)?.delete(fn)
}
