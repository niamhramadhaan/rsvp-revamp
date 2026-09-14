import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { applyBrandTint, createPinElement, MAP_STYLE_URL } from './maplibre-setup'

export interface VenueMapPreviewProps {
  lat: number
  lng: number
  directionsUrl?: string
  className?: string
}

// Small read-only thumbnail for EventBanner/TicketCard — `interactive: false`
// disables every pointer/scroll/keyboard handler in one shot (MapLibre's own
// equivalent of Leaflet's dragging/scrollWheelZoom/doubleClickZoom/
// zoomControl all being turned off individually), since this is a glanceable
// preview, not a navigable map. A transparent anchor overlay makes the whole
// thing one "open in Maps" tap target rather than trying to make MapLibre's
// own interactions coexist with a link. Callers guard with
// `event.lat != null && event.lng != null` before rendering this — lat/lng
// are required here so "no pin → don't render" stays an explicit choice at
// each call site instead of a silent null return buried in here.
//
// Recreated wholesale whenever lat/lng changes rather than panned in place —
// this is a tiny non-interactive thumbnail (unlike SeatMapCanvas's own
// perf-sensitive live dragging), so the simplicity of "just make a fresh map"
// is worth more here than the small saved cost of an in-place recenter.
export default function VenueMapPreview({ lat, lng, directionsUrl, className = 'h-24 w-full' }: VenueMapPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    // Same fix as VenueMapPicker.tsx (see its own longer doc): this preview
    // renders inside TicketCard, itself inside TicketDrawer — one of the
    // shared DrawerPanelPortal's panels, which animates its own width open
    // from 0 starting the same instant this component mounts. Building
    // MapLibre against a still-0-sized container is what left this stuck
    // showing only a flat background color. Deferring creation to the
    // first real size a ResizeObserver reports (and calling `resize()` on
    // every size after that) fixes it without guessing a delay.
    let map: MapLibreMap | null = null

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect || rect.width === 0 || rect.height === 0) return

      if (!map) {
        const created = new MapLibreMap({
          container,
          style: MAP_STYLE_URL,
          center: [lng, lat],
          zoom: 15,
          interactive: false,
          attributionControl: false,
        })
        created.on('load', () => applyBrandTint(created))
        new Marker({ element: createPinElement(), anchor: 'bottom' }).setLngLat([lng, lat]).addTo(created)
        map = created
      } else {
        map.resize()
      }
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      map?.remove()
    }
  }, [lat, lng])

  return (
    <div className={`relative overflow-hidden rounded-xl border border-black/10 ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
      {directionsUrl && <a href={directionsUrl} target="_blank" rel="noreferrer" aria-label="Open in Maps" className="absolute inset-0" />}
    </div>
  )
}
