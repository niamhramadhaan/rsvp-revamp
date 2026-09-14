import { useId, useRef, useState } from 'react'
import { searchPlaces, type PlaceResult } from '../../data/geocoding'
import { FIELD_LABEL, FIELD_INPUT } from '../GroupedField'
import { SearchIcon, MapPinIcon } from '../icons/UiIcons'
import { useComboboxKeyboard } from '../../hooks/useComboboxKeyboard'
import VenueMapPicker from './VenueMapPicker'

export interface VenueFieldProps {
  venue: string
  onVenueChange: (venue: string) => void
  lat?: number
  lng?: number
  onPinChange: (lat: number, lng: number) => void
  onClear: () => void
}

const SEARCH_DEBOUNCE_MS = 350
const MIN_QUERY_LENGTH = 3

// Replaces the old plain "Venue" text field + separately-typed Address/Map
// link pair: typing a venue/building name here searches real places (see
// geocoding.ts) as-you-type, and picking one fills the venue name AND drops
// the map pin below in one action — the pin (not a free-text address or a
// pasted map link) is now the one source of truth CreateEventDrawer/
// EditEventDrawer's own getDirectionsUrl reads. The map stays fully
// editable afterward (tap/drag to fine-tune) for whenever the search result
// isn't pinpoint-accurate enough on its own.
export default function VenueField({ venue, onVenueChange, lat, lng, onPinChange, onClear }: VenueFieldProps) {
  const id = useId()
  const listId = useId()
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [flyToToken, setFlyToToken] = useState(0)
  const debounceRef = useRef<number | undefined>(undefined)
  // Guards against a debounced search that started before the user picked a
  // suggestion (or cleared the field) landing afterward and reopening the
  // dropdown out from under them.
  const requestIdRef = useRef(0)

  function handleInput(value: string) {
    onVenueChange(value)
    window.clearTimeout(debounceRef.current)
    setHighlightedIndex(-1)

    const trimmed = value.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([])
      setLoading(false)
      return
    }

    const requestId = ++requestIdRef.current
    setOpen(true)
    setLoading(true)
    debounceRef.current = window.setTimeout(async () => {
      try {
        const results = await searchPlaces(trimmed)
        if (requestIdRef.current === requestId) setSuggestions(results)
      } catch (err) {
        // AbortError means a newer search superseded this one — its own
        // resolution is what updates `suggestions`, this one just bows out.
        if (requestIdRef.current === requestId && (err as Error).name !== 'AbortError') setSuggestions([])
      } finally {
        if (requestIdRef.current === requestId) setLoading(false)
      }
    }, SEARCH_DEBOUNCE_MS)
  }

  function handlePick(place: PlaceResult) {
    requestIdRef.current++ // invalidates any debounced search still pending
    onVenueChange(place.name)
    onPinChange(place.lat, place.lng)
    setFlyToToken((t) => t + 1)
    setSuggestions([])
    setOpen(false)
  }

  // Same shared keyboard hook ComboField (GroupedField.tsx) uses — ↓ opens
  // the list and highlights the first result, ↑/↓ move the highlight,
  // Enter picks whichever result is highlighted, Escape closes without
  // clearing what's typed. Previously mouse-only (onMouseDown per row,
  // nothing on the input itself) — a real gap next to a native <select>'s
  // own free keyboard support.
  const { highlightedIndex, setHighlightedIndex, handleKeyDown } = useComboboxKeyboard({
    itemCount: suggestions.length,
    open,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
    onSelect: (index) => handlePick(suggestions[index]),
  })

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>Venue</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-icon-gray">
            <SearchIcon className="h-4 w-4" />
          </span>
          <input
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && highlightedIndex >= 0 ? `${listId}-${highlightedIndex}` : undefined}
            value={venue}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            // A plain blur closes the dropdown before a click on a
            // suggestion (onMouseDown, not onClick, below) gets a chance to
            // register — deferred one tick so that click still lands.
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder="Start typing a venue or building name…"
            autoComplete="off"
            className={`${FIELD_INPUT} pl-10`}
          />
          {open && (loading || suggestions.length > 0) && (
            <ul
              id={listId}
              role="listbox"
              // See ComboField's own doc (GroupedField.tsx) — an
              // overflow:auto container Chromium would otherwise add to
              // the tab sequence on its own.
              tabIndex={-1}
              className="combo-scrollbar absolute z-20 mt-1.5 max-h-56 w-full divide-y divide-black/5 overflow-y-auto rounded-xl border border-black/10 bg-white py-1 shadow-lg"
            >
              {loading && <li className="px-3.5 py-2 text-xs text-muted">Searching…</li>}
              {!loading &&
                suggestions.map((place, index) => (
                  <li key={place.id} id={`${listId}-${index}`} role="option" aria-selected={index === highlightedIndex}>
                    <button
                      type="button"
                      // See ComboField's own doc (GroupedField.tsx) — not a
                      // Tab stop, reachable by pointer or by the input's own
                      // arrow-key handling instead.
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handlePick(place)
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`flex w-full items-start gap-2 px-3.5 py-2 text-left text-sm transition ${
                        index === highlightedIndex ? 'bg-accent-700/10 text-accent-700' : 'text-ink-900 hover:bg-black/5'
                      }`}
                    >
                      <MapPinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-700" />
                      <span className="min-w-0 truncate">{place.label}</span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </label>

      <VenueMapPicker lat={lat} lng={lng} onChange={onPinChange} onClear={onClear} flyToToken={flyToToken} />
    </div>
  )
}
