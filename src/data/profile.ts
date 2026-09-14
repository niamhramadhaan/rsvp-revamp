import { readValue, writeValue } from './store'
import type { Profile } from './types'
import avatarWilliam from '../assets/images/avatar-william-jacobson.png'

export const PROFILE_KEY = 'profile'

const DEFAULT_PROFILE: Profile = {
  name: 'William Jacobson',
  role: 'admin',
  imageUrl: avatarWilliam,
}

export function getProfile(): Profile {
  return readValue<Profile>(PROFILE_KEY, DEFAULT_PROFILE)
}

export function updateProfile(patch: Partial<Profile>): Profile {
  const next = { ...getProfile(), ...patch }
  writeValue(PROFILE_KEY, next)
  return next
}
