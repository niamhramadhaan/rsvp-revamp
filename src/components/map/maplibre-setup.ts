// Shared MapLibre setup for VenueMapPicker/VenueMapPreview — the OpenFreeMap
// vector style URL, the pin marker element, and the brand retint both
// components apply on top of that style once it loads.
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
// maplibre-gl has no default export — every consumer of this module (and
// VenueMapPicker/VenueMapPreview themselves) imports named bindings
// (`Map`/`Marker`/`NavigationControl`), not a `maplibregl` namespace object.

// OpenFreeMap's hosted "Liberty" vector style (no API key, no self-hosting —
// same "genuinely real, free, no backend of our own" call as Photon in
// geocoding.ts). Note the URL has no `/style.json` suffix — that 404s;
// OpenFreeMap serves the style document at the bare style-name path.
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

// Jakarta — both seed events (src/data/seed.ts) are venues there, so a
// freshly opened, not-yet-pinned picker starts on a sensible, real part of
// the map rather than null island or the whole world.
export const DEFAULT_CENTER: [number, number] = [106.8456, -6.2088] // [lng, lat] — MapLibre's own order
export const DEFAULT_ZOOM = 11
export const PIN_ZOOM = 16

export function createPinElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'text-accent-700'
  el.innerHTML = `
    <svg width="30" height="40" viewBox="0 0 24 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>`
  return el
}

// Recolors the stock Liberty style (OpenMapTiles schema, real layer ids
// confirmed against the live style document) to Gamefinity's own palette —
// cream ground, brand blue/cyan water, warm-tan buildings, ink roads —
// instead of shipping a generic multicolor basemap next to this app's own
// deliberately restrained one. Hex values are this app's own index.css
// tokens, copied in literally: MapLibre's paint properties take real CSS
// color strings, not `var(--...)` references into this document's stylesheet.
const CREAM = '#f8f1e4'
const LANDCOVER = '#ece2c9' // park/landcover/landuse — one soft warm tone, not a per-category palette
const WATER = '#bfe0f2' // accent-cyan-light, lightened further for a fill area this large
const WATER_LINE = '#3ca8d8' // accent-cyan
const BUILDING = '#e2d2ac'
const BUILDING_3D = '#d6c298'
const ROAD_CASING = '#e9e2ce' // the lighter underlay stroke beneath each road's own core line
const ROAD_MAJOR = '#2a4a6b' // ink-700 — motorway/trunk/primary
const ROAD_MINOR = '#4d6580' // muted — everything else drivable/walkable
const RAIL = '#b7c3ce' // icon-gray
const BOUNDARY = '#2e86c1' // accent-600
const LABEL_TEXT = '#101e33' // ink-900
const LABEL_HALO = '#ffffff'

// Ordered rules, first match wins — a layer's id decides both which color it
// gets and (via `prop`) which paint property that color actually applies to,
// since a fill layer/line layer/symbol layer each name that property
// differently. Every rule is applied inside its own try/catch (see
// applyBrandTint below): some ids match a rule whose `prop` doesn't exist on
// that particular layer's own type (e.g. a stray symbol layer with no text),
// and MapLibre throws on an unsupported paint property rather than
// no-op'ing — one mismatched rule shouldn't abort every other layer's retint.
// The exact set of paint properties any rule below actually names — a plain
// `string` type would let `setPaintProperty` (typed against the real union
// of every valid paint property name across every layer type) reject it at
// the call site instead of here, where the mistake is easier to spot.
type PaintProp = 'background-color' | 'fill-color' | 'line-color' | 'fill-extrusion-color' | 'text-color' | 'text-halo-color'

const RULES: Array<{ test: (id: string) => boolean; prop: PaintProp; value: string }> = [
  { test: (id) => id === 'background', prop: 'background-color', value: CREAM },
  { test: (id) => id.startsWith('water_name') || id === 'waterway_line_label', prop: 'text-color', value: WATER_LINE },
  { test: (id) => id === 'water', prop: 'fill-color', value: WATER },
  { test: (id) => id.startsWith('waterway'), prop: 'line-color', value: WATER_LINE },
  { test: (id) => id.startsWith('park') || id.startsWith('landcover') || id.startsWith('landuse'), prop: 'fill-color', value: LANDCOVER },
  { test: (id) => id === 'building-3d', prop: 'fill-extrusion-color', value: BUILDING_3D },
  { test: (id) => id.startsWith('building'), prop: 'fill-color', value: BUILDING },
  { test: (id) => id.startsWith('boundary'), prop: 'line-color', value: BOUNDARY },
  { test: (id) => id.includes('rail'), prop: 'line-color', value: RAIL },
  { test: (id) => id.includes('casing'), prop: 'line-color', value: ROAD_CASING },
  { test: (id) => /motorway|trunk|primary/.test(id), prop: 'line-color', value: ROAD_MAJOR },
  { test: (id) => id === 'aeroway_fill', prop: 'fill-color', value: ROAD_CASING },
  { test: (id) => id.startsWith('road_') || id.startsWith('bridge_') || id.startsWith('tunnel_'), prop: 'line-color', value: ROAD_MINOR },
  {
    test: (id) => id.startsWith('label_') || id.startsWith('poi') || id === 'airport' || id.startsWith('highway-name') || id.startsWith('highway-shield') || id === 'road_shield_us',
    prop: 'text-color',
    value: LABEL_TEXT,
  },
]

const HALO_RULE: { test: (id: string) => boolean; prop: PaintProp; value: string } = {
  test: (id) => /label_|poi|airport|highway-name|water_name|waterway_line_label/.test(id),
  prop: 'text-halo-color',
  value: LABEL_HALO,
}

export function applyBrandTint(map: MapLibreMap): void {
  const layers = (map.getStyle() as StyleSpecification | undefined)?.layers ?? []
  for (const layer of layers) {
    const rule = RULES.find((r) => r.test(layer.id))
    if (rule) {
      try {
        map.setPaintProperty(layer.id, rule.prop, rule.value)
      } catch {
        // See RULES' own doc — an id/prop mismatch on one layer shouldn't
        // stop the rest of the retint.
      }
    }
    if (HALO_RULE.test(layer.id)) {
      try {
        map.setPaintProperty(layer.id, HALO_RULE.prop, HALO_RULE.value)
      } catch {
        /* same as above */
      }
    }
  }
}
