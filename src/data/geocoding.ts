// Forward geocoding — turns whatever an admin is typing into "Venue" into
// real place candidates (name + coordinates), so picking one both fills the
// venue name AND drops the map pin at once, instead of a free-text field
// with no idea where on earth it is. Photon (photon.komoot.io, built on
// OpenStreetMap data) — a free, no-API-key public endpoint, the same
// "genuinely real, not mocked" call this app already makes for things like
// html5-qrcode scanning and Google Maps directions links. No backend of our
// own to proxy through, so this is a direct client-side fetch, same as
// VenueMapPicker/VenueMapPreview's own map tiles.
const PHOTON_URL = 'https://photon.komoot.io/api/'

export interface PlaceResult {
  id: string
  /** The place/building's own name, e.g. "Kota Kasablanka" — what actually
   * fills the Venue field once picked. */
  name: string
  /** name + locality, for the suggestion list only (e.g. "Kota Kasablanka —
   * Jakarta, Indonesia") — never stored, just disambiguates same-named
   * places in the dropdown. */
  label: string
  lat: number
  lng: number
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    name?: string
    street?: string
    city?: string
    state?: string
    country?: string
    osm_type?: string
    osm_id?: number
  }
}

// Aborts whatever search is still in flight before starting the next one —
// without this, a slow response to an earlier keystroke could resolve AFTER
// a faster response to a later one and clobber the dropdown with stale
// results. Module-level (not per-component-instance) is fine: only one
// venue search box is ever open at a time in this app.
let inFlight: AbortController | null = null

export async function searchPlaces(query: string, limit = 5): Promise<PlaceResult[]> {
  inFlight?.abort()
  const controller = new AbortController()
  inFlight = controller

  const url = `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=${limit}`
  const res = await fetch(url, { signal: controller.signal })
  if (!res.ok) throw new Error(`geocoding failed: ${res.status}`)
  const data: { features?: PhotonFeature[] } = await res.json()

  return (data.features ?? [])
    .filter((f): f is PhotonFeature & { geometry: { coordinates: [number, number] } } => Array.isArray(f.geometry?.coordinates))
    .map((f, i) => {
      const p = f.properties ?? {}
      const name = p.name || p.street || query
      const locality = [p.city, p.state, p.country].filter(Boolean).join(', ')
      // GeoJSON order is [lng, lat] — the opposite of the lat/lng order this
      // app's own Event.lat/Event.lng fields use everywhere else.
      const [lng, lat] = f.geometry.coordinates
      return {
        id: `${p.osm_type ?? 'place'}-${p.osm_id ?? i}`,
        name,
        label: locality ? `${name} — ${locality}` : name,
        lat,
        lng,
      }
    })
}
