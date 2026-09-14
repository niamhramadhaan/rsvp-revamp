import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { applyBrandTint, createPinElement, DEFAULT_CENTER, DEFAULT_ZOOM, MAP_STYLE_URL, PIN_ZOOM } from './maplibre-setup'

export interface VenueMapPickerProps {
  lat?: number
  lng?: number
  onChange: (lat: number, lng: number) => void
  onClear: () => void
  /** Bump this (e.g. a running counter) whenever the camera should actively
   * fly to `lat`/`lng` — a search-result pick (VenueField) wants the map to
   * visibly travel there, but a plain click/drag on the map itself must NOT
   * also trigger a fly-to (the pin is already exactly where the user's own
   * gesture put it; snapping the camera right after would fight it).
   * Decoupled from lat/lng themselves for exactly that reason — both kinds
   * of change update lat/lng, only one of them should move the camera. */
  flyToToken?: number
}

// CreateEventDrawer/EditEventDrawer's "pin the venue" editor, wrapped by
// VenueField (which adds the venue-name search on top) — a click-to-place,
// drag-to-adjust map. The map instance itself is created once (empty deps)
// and kept alive for the component's whole lifetime — unlike
// VenueMapPreview's own "just recreate it" approach, this one is what a
// search result's own recenter (see VenueField) has to animate smoothly,
// so it's built to be updated in place instead.
export default function VenueMapPicker({ lat, lng, onChange, onClear, flyToToken }: VenueMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const latRef = useRef(lat)
  const lngRef = useRef(lng)
  latRef.current = lat
  lngRef.current = lng
  const mountedFlyRef = useRef(false)
  // onChange/onClear are recreated every render at every call site (inline
  // closures over `lat`/`lng` state) — read through a ref inside the map's
  // own click/dragend handlers instead of putting them in the mount effect's
  // deps, so the map itself is built exactly once rather than torn down and
  // recreated on every keystroke elsewhere in the form.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Creates/moves/removes the marker to match whatever lat/lng the refs
  // currently hold. Pulled out into its own ref-stable function (not just
  // the body of the [lat, lng] effect below) so the mount effect can call
  // it directly the instant the map first becomes ready — see that
  // effect's own doc for why the map's readiness can't be assumed to line
  // up with when that effect happens to run.
  const syncMarkerRef = useRef<() => void>(() => {})
  syncMarkerRef.current = () => {
    const map = mapRef.current
    if (!map) return
    const currentLat = latRef.current
    const currentLng = lngRef.current
    if (currentLat == null || currentLng == null) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    if (markerRef.current) {
      markerRef.current.setLngLat([currentLng, currentLat])
    } else {
      const marker = new Marker({ element: createPinElement(), anchor: 'bottom', draggable: true })
        .setLngLat([currentLng, currentLat])
        .addTo(map)
      marker.on('dragend', () => {
        const pos = marker.getLngLat()
        onChangeRef.current(pos.lat, pos.lng)
      })
      markerRef.current = marker
    }
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    // This picker lives inside DrawerPanelPortal's shared panel, which
    // pushes <main> aside by animating a `--panel-w` grid-column width
    // from 0 (DashboardLayout.tsx) starting the same instant this
    // component first mounts — so on the very first commit, the container
    // this map would attach to can genuinely still be 0×0, or partway
    // through animating to its real width. MapLibre computes its initial
    // viewport/tile-cover from the container's size at construction time;
    // building it against a 0-sized box is what produced the bug this was
    // built to fix (map stuck showing only its flat background color,
    // never any actual tiles, even after the drawer finished opening). A
    // ResizeObserver — not a guessed setTimeout — is what actually knows
    // when there's real space to draw into, and it keeps firing for the
    // rest of this component's lifetime so the map stays correctly sized
    // if the drawer's own width ever changes again later too (e.g. its
    // footer growing, or a narrower window).
    let map: MapLibreMap | null = null

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect || rect.width === 0 || rect.height === 0) return

      if (!map) {
        const hasPin = latRef.current != null && lngRef.current != null
        const created = new MapLibreMap({
          container,
          style: MAP_STYLE_URL,
          center: hasPin ? [lngRef.current as number, latRef.current as number] : DEFAULT_CENTER,
          zoom: hasPin ? PIN_ZOOM : DEFAULT_ZOOM,
        })
        created.addControl(new NavigationControl({ showCompass: false }), 'top-right')
        created.on('load', () => applyBrandTint(created))
        created.on('click', (e) => onChangeRef.current(e.lngLat.lat, e.lngLat.lng))
        map = created
        mapRef.current = created
        // The [lat, lng] effect below may already have run (and no-op'd,
        // finding no map yet) before this observer callback ever fired —
        // sync the marker once right now so an initial pin isn't dropped.
        syncMarkerRef.current()
      } else {
        map.resize()
      }
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      map?.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keeps the marker (create/move/remove) and the map's own center in sync
  // with lat/lng — separate from the mount effect above so picking a search
  // result (VenueField) or dragging the marker doesn't tear down the whole
  // map, just moves what's already there.
  useEffect(() => {
    syncMarkerRef.current()
  }, [lat, lng])

  // See flyToToken's own doc above — an explicit "go look at this" signal,
  // separate from the marker-sync effect above so a plain click/drag never
  // fires this.
  useEffect(() => {
    if (!mountedFlyRef.current) {
      mountedFlyRef.current = true
      return
    }
    const map = mapRef.current
    if (!map || latRef.current == null || lngRef.current == null) return
    map.flyTo({ center: [lngRef.current, latRef.current], zoom: PIN_ZOOM })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToToken])

  const hasPin = lat != null && lng != null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-900">Pin the venue on the map</span>
        {hasPin && (
          <button type="button" onClick={onClear} className="text-xs font-medium text-status-declined transition hover:underline">
            Clear pin
          </button>
        )}
      </div>
      <div className="h-48 w-full overflow-hidden rounded-xl border-[1.5px] border-black/10">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      <p className="text-[11px] text-muted">Tap the map to drop a pin, or drag it to fine-tune the spot.</p>
    </div>
  )
}
