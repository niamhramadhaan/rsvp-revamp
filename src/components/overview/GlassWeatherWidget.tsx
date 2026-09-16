/*
  Glass Weather widget — scoped port of the standalone snippet at
  projects/_template/snippets/glass-weather/ (glass-weather.css/.html/.js).

  Scoping notes (why this isn't a verbatim copy):
  - The snippet's `*` and `body` rules (page grid, Inter font, page-level
    radial washes) are deliberately NOT carried over — they'd leak onto the
    whole dashboard. Only the `.card` block and its children are ported,
    renamed to `.gw-*` so `.card`/`.stat`/`.icon` can never collide with
    app styles.
  - The snippet's page background washes live on `body`; here the same two
    radial washes are folded into `.gw-card`'s own background (over the
    `#0b0716` base) so the glass reads on the light overview page without
    needing a full-bleed dark section behind it.
  - Width is fluid (100% of its grid column) instead of the snippet's fixed
    `min(340px, 88vw)` — OverviewContent places this in a ~340px side
    column, which is what restores the snippet's proportions.
  - Live data via Open-Meteo (free, no API key, CORS-open): the event's own
    pin coordinates when set, otherwise the venue string is geocoded
    (falling back to comma-tail segments, then a Bandung default). The
    snippet's static DATA + Clear/Cloudy/Rain demo toggle is gone — the
    condition icon now follows the real WMO weather code.
*/

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import './GlassWeatherWidget.css'

// Six distinct icon states, not three — the original clear/cloudy/rain
// split lumped partly-cloudy, overcast, and fog all into one "cloudy"
// bucket (and drizzle/rain/showers/thunderstorm/snow all into "rain"),
// so most real-world conditions landed on the same two icons. Each of
// these six now gets its own icon (see the .tsx's own SVG markup below
// and the .css's own per-condition color variables).
type Condition = 'clear-day' | 'clear-night' | 'partly-cloudy' | 'overcast' | 'rain' | 'snow'

interface WeatherState {
  condition: Condition
  label: string
  temp: number
  feelsLike: string
  humidity: string
  wind: string
  placeName: string
}

// Bandung fallback — the snippet's own demo location, used only when the
// venue string can't be geocoded and no pin coordinates exist.
const FALLBACK = { latitude: -6.9175, longitude: 107.6191, name: 'Bandung, ID' }

function codeToCondition(code: number, isDay: number): Condition {
  // WMO weather codes, split into their own icon each instead of two
  // catch-all buckets (see Condition's own doc above).
  if (code === 0) return isDay ? 'clear-day' : 'clear-night'
  if (code === 1 || code === 2) return 'partly-cloudy'
  if (code === 3 || code === 45 || code === 48) return 'overcast'
  if (code >= 71 && code <= 77) return 'snow'
  return 'rain'
}

function codeToLabel(code: number, isDay: number): string {
  if (code === 0) return isDay ? 'Clear sky' : 'Clear night'
  if (code === 1) return 'Mainly clear'
  if (code === 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code === 45 || code === 48) return 'Fog'
  if (code >= 51 && code <= 57) return 'Drizzle'
  if (code >= 61 && code <= 67) return 'Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Rain showers'
  if (code >= 95) return 'Thunderstorm'
  return 'Cloudy'
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Updating…'
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'Updated just now'
  if (mins < 60) return `Updated ${mins}m ago`
  return `Updated ${Math.round(mins / 60)}h ago`
}

async function geocode(query: string, signal: AbortSignal): Promise<{ latitude: number; longitude: number; name: string } | null> {
  // Venue strings are often POIs ("Kota Kasablanka, Jakarta") that a
  // city-level geocoder won't match — retry with progressively shorter
  // comma-tail segments ("Jakarta") before giving up.
  const candidates = [query, ...query.split(',').slice(1).map((s) => s.trim()).filter(Boolean)]
  for (const name of candidates) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`
    const res = await fetch(url, { signal })
    if (!res.ok) continue
    const json = (await res.json()) as {
      results?: { latitude: number; longitude: number; name: string; country?: string }[]
    }
    const hit = json.results?.[0]
    if (hit) return { latitude: hit.latitude, longitude: hit.longitude, name: hit.country ? `${hit.name}, ${hit.country}` : hit.name }
  }
  return null
}

async function fetchWeather(latitude: number, longitude: number, signal: AbortSignal): Promise<WeatherState> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&timezone=auto`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`)
  const json = (await res.json()) as {
    current: {
      temperature_2m: number
      relative_humidity_2m: number
      apparent_temperature: number
      is_day: number
      weather_code: number
      wind_speed_10m: number
    }
  }
  const c = json.current
  return {
    condition: codeToCondition(c.weather_code, c.is_day),
    label: codeToLabel(c.weather_code, c.is_day),
    temp: Math.round(c.temperature_2m),
    feelsLike: `${Math.round(c.apparent_temperature)}°`,
    humidity: `${Math.round(c.relative_humidity_2m)}%`,
    wind: `${Math.round(c.wind_speed_10m)} km/h`,
    placeName: '',
  }
}

export interface GlassWeatherWidgetProps {
  /** Venue/city line shown in the card header — defaults to the snippet's
   * own demo location so the widget works with no event selected. */
  location?: string
  /** The event pin's own coordinates when set — skips geocoding entirely. */
  latitude?: number
  longitude?: number
}

// One glanceable "will guests need umbrellas" card next to Recent
// check-ins (see OverviewContent) — its own pastel glass surface (sky +
// peach washes over ink text), distinct from GLASS_CARD's cream but in
// the same light-card family as the rest of Overview now, rather than the
// dark-glass-on-light-page mismatch this widget started as.
export default function GlassWeatherWidget({ location = 'Bandung, ID', latitude, longitude }: GlassWeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherState | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [placeName, setPlaceName] = useState(location)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const loading = weather === null && error === null
  // Separate from `loading` — that only reads true before the very first
  // load ever resolves (see the stale-while-revalidate comment below), so
  // a refresh after that point left the button's own spin/disabled state
  // never turning on at all. This tracks every in-flight request, first
  // load included, so pressing ↻ always gets a visible spin.
  const [refreshing, setRefreshing] = useState(true)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // Tilt — a pointer-tracked 3D rotation written straight to the card's own
  // style as CSS custom properties (no React state/re-render per pointer
  // move; see the .css's own --gw-tilt-x/-y). Off entirely under
  // prefers-reduced-motion, same guard every other loop in this file's own
  // CSS already respects.
  const cardRef = useRef<HTMLElement | null>(null)
  const reduceMotionRef = useRef(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduceMotionRef.current = mq.matches
    const onChange = () => {
      reduceMotionRef.current = mq.matches
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const handlePointerMove = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    const card = cardRef.current
    if (!card || reduceMotionRef.current) return
    const rect = card.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    const MAX_TILT = 7
    card.style.transition = 'none'
    card.style.setProperty('--gw-tilt-x', `${((0.5 - py) * MAX_TILT * 2).toFixed(2)}deg`)
    card.style.setProperty('--gw-tilt-y', `${((px - 0.5) * MAX_TILT * 2).toFixed(2)}deg`)
  }, [])

  const handlePointerLeave = useCallback(() => {
    const card = cardRef.current
    if (!card) return
    card.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
    card.style.setProperty('--gw-tilt-x', '0deg')
    card.style.setProperty('--gw-tilt-y', '0deg')
  }, [])

  // Flash feedback on the temperature value — the visible confirmation
  // that pressing ↻ actually landed fresh data (see the .css's own
  // gw-value-flash), not just that the button spun for a moment. Skips
  // the very first load (nothing to compare against yet).
  const [flash, setFlash] = useState(false)
  const firstLoadRef = useRef(true)
  useEffect(() => {
    if (!updatedAt) return
    if (firstLoadRef.current) {
      firstLoadRef.current = false
      return
    }
    setFlash(true)
    const timer = setTimeout(() => setFlash(false), 700)
    return () => clearTimeout(timer)
  }, [updatedAt])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    async function load() {
      setError(null)
      setRefreshing(true)
      try {
        let coords: { latitude: number; longitude: number; name: string }
        if (latitude != null && longitude != null) {
          coords = { latitude, longitude, name: location }
        } else {
          coords = (await geocode(location, controller.signal)) ?? FALLBACK
        }
        const w = await fetchWeather(coords.latitude, coords.longitude, controller.signal)
        if (cancelled) return
        setWeather(w)
        setPlaceName(coords.name)
        setUpdatedAt(new Date().toISOString())
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return
        setError('Live weather unavailable — check connection and retry.')
      } finally {
        if (!cancelled) setRefreshing(false)
      }
    }

    // Stale-while-revalidate: a refresh keeps the previous fetch's data
    // on screen (only the very first load renders the skeleton).
    void load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [location, latitude, longitude, refreshKey])

  const condition: Condition = weather?.condition ?? 'clear-day'

  return (
    <section
      className="gw-card"
      data-condition={condition}
      aria-label={`Weather for ${placeName}`}
      aria-live="polite"
      ref={cardRef}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
    >
      <div className="gw-card__glow" aria-hidden="true" />

      {/* Title lives inside the card, on its own divider row, the same
          "headline + border-b" treatment WidgetCard gives every sibling
          widget on this page — it used to float above the card as a small
          caption, which is what made this card read as a mismatched
          height/rhythm next to Recent check-ins instead of its paired
          sibling. */}
      <header className="gw-card__title-row">
        <h3 className="gw-card__title">Venue weather</h3>
      </header>

      <div className="gw-card__body">
        <header className="gw-card__top">
          <span className="gw-card__location">{placeName}</span>
          <span className="gw-card__updated">{error ? 'Offline' : timeAgo(updatedAt)}</span>
        </header>

        {/* Icon/temp/condition group grows to fill whatever height this
            card stretches to (matching Recent check-ins next door) and
            centers within it, instead of leaving a hard gap of dead space
            between "Mainly clear" and the stats row below. */}
        <div className="gw-card__middle">
          {loading ? (
            <p className="gw-card__loading">Fetching live weather…</p>
          ) : error && !weather ? (
            <div className="gw-card__error">
              <p>{error}</p>
              <button type="button" onClick={refresh}>
                Retry
              </button>
            </div>
          ) : (
            weather && (
              <>
                <div className="gw-card__main">
                  <div className="gw-card__icon" aria-hidden="true">
                    <svg viewBox="0 0 64 64" className="gw-icon gw-icon--sun">
                      <circle cx="32" cy="32" r="14" />
                      <g className="gw-icon__rays">
                        <line x1="32" y1="4" x2="32" y2="12" />
                        <line x1="32" y1="52" x2="32" y2="60" />
                        <line x1="4" y1="32" x2="12" y2="32" />
                        <line x1="52" y1="32" x2="60" y2="32" />
                        <line x1="12.7" y1="12.7" x2="18.3" y2="18.3" />
                        <line x1="45.7" y1="45.7" x2="51.3" y2="51.3" />
                        <line x1="12.7" y1="51.3" x2="18.3" y2="45.7" />
                        <line x1="45.7" y1="18.3" x2="51.3" y2="12.7" />
                      </g>
                    </svg>
                    <svg viewBox="0 0 64 64" className="gw-icon gw-icon--moon">
                      <path d="M38 12a20 20 0 1 0 14 34 16 16 0 0 1-14-34z" />
                      <circle className="gw-icon__star" cx="50" cy="14" r="1.6" />
                      <circle className="gw-icon__star" cx="44" cy="24" r="1.1" />
                    </svg>
                    <svg viewBox="0 0 64 64" className="gw-icon gw-icon--partly-cloudy">
                      <g className="gw-icon__peek">
                        <circle cx="38" cy="22" r="10" />
                        <line x1="38" y1="4" x2="38" y2="9" />
                        <line x1="53" y1="12" x2="49.5" y2="15.5" />
                        <line x1="58" y1="22" x2="53" y2="22" />
                      </g>
                      <path className="gw-icon__cloud-body" d="M18 46a11 11 0 1 1 3-21.6A13.5 13.5 0 0 1 46 28a9 9 0 0 1-2 18H18z" />
                    </svg>
                    <svg viewBox="0 0 64 64" className="gw-icon gw-icon--cloud">
                      <path d="M20 44a12 12 0 1 1 3-23.6A15 15 0 0 1 51 26a10 10 0 0 1-2 20H20z" />
                    </svg>
                    <svg viewBox="0 0 64 64" className="gw-icon gw-icon--rain">
                      <path d="M20 38a12 12 0 1 1 3-23.6A15 15 0 0 1 51 20a10 10 0 0 1-2 20H20z" />
                      <g className="gw-icon__drops">
                        <line x1="24" y1="46" x2="20" y2="56" />
                        <line x1="34" y1="46" x2="30" y2="56" />
                        <line x1="44" y1="46" x2="40" y2="56" />
                      </g>
                    </svg>
                    <svg viewBox="0 0 64 64" className="gw-icon gw-icon--snow">
                      <path d="M20 38a12 12 0 1 1 3-23.6A15 15 0 0 1 51 20a10 10 0 0 1-2 20H20z" />
                      <g className="gw-icon__flakes">
                        <circle cx="23" cy="48" r="1.8" />
                        <circle cx="33" cy="52" r="1.8" />
                        <circle cx="43" cy="48" r="1.8" />
                      </g>
                    </svg>
                  </div>

                  <div className="gw-card__temp">
                    <span className={`gw-card__temp-value${flash ? ' gw-flash' : ''}`}>{weather.temp}</span>
                    <span className="gw-card__temp-unit">°C</span>
                  </div>
                </div>

                <p className="gw-card__condition">{weather.label}</p>
              </>
            )
          )}
        </div>

        {weather && (
          <footer className="gw-card__stats">
            <div className="gw-stat">
              <span className="gw-stat__label">Feels like</span>
              <span className="gw-stat__value">{weather.feelsLike}</span>
            </div>
            <div className="gw-stat">
              <span className="gw-stat__label">Humidity</span>
              <span className="gw-stat__value">{weather.humidity}</span>
            </div>
            <div className="gw-stat">
              <span className="gw-stat__label">Wind</span>
              <span className="gw-stat__value">{weather.wind}</span>
            </div>
          </footer>
        )}
      </div>

      <div className="gw-card__foot">
        <span>{error && weather ? error : 'Live · Open-Meteo'}</span>
        <button type="button" onClick={refresh} disabled={refreshing} aria-label="Refresh weather" data-refreshing={refreshing}>
          <svg viewBox="0 0 24 24" className="gw-refresh-icon" aria-hidden="true">
            <path d="M20 11a8 8 0 0 0-14.93-3.36M4 13a8 8 0 0 0 14.93 3.36" />
            <path d="M5.07 3v4.64h4.64M18.93 21v-4.64h-4.64" />
          </svg>
        </button>
      </div>
    </section>
  )
}
