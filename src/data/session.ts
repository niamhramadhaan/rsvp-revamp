import { clearTable, readTable, readValue, writeValue } from './store'
import { updateProfile } from './profile'
import type { AppUser } from './types'

// Which AppUser this browser is signed in as (their id). The one piece of
// "auth" this app has: App.tsx renders the login gate when this is absent
// and the dashboard when it's present. A scalar value (not a table row),
// same pattern as currentEventId — see store.ts's readValue/writeValue.
export const SESSION_KEY = 'sessionUserId'

export function getSessionUserId(): string | null {
  return readValue<string>(SESSION_KEY)
}

export function getSessionUser(): AppUser | null {
  const id = getSessionUserId()
  if (!id) return null
  return readTable<AppUser>('users').find((u) => u.id === id) ?? null
}

// Pure credential check with no side effects — the login page verifies
// first so a wrong password fails instantly, and only plays its loading
// beat for credentials that will actually sign in.
export function verifyCredentials(email: string, password: string): AppUser | null {
  return (
    readTable<AppUser>('users').find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
    ) ?? null
  )
}
// Email + password match against the users table (plaintext mock data — see
// SEED_USERS). On success this also syncs the local Profile record to the
// signed-in user, because the rest of the app (useCanAccess, TopHeader's
// avatar, SettingsPage) reads "what can this session do" off Profile.role,
// not off any AppUser row — see hooks.ts's own doc on why there's no other
// association between a session and a user. Returns the user, or null when
// the credentials match nothing.
export function signIn(email: string, password: string): AppUser | null {
  const user = verifyCredentials(email, password)
  if (!user) return null
  updateProfile({ name: user.name, role: user.role, imageUrl: user.imageUrl })
  writeValue(SESSION_KEY, user.id)
  return user
}

// Clears the key entirely (not a null write) so it reads as "never signed
// in" — the Profile record itself is left alone, it just stops mattering
// until the next sign-in overwrites it.
export function signOut(): void {
  clearTable(SESSION_KEY)
}
