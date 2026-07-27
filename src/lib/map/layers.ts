import type { Map as MaplibreMap } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import type { JunctionId, TrailGraph } from '../graph/types'

export const SOURCES = {
  trails: 'hg-trails',
  edges: 'hg-edges',
  junctions: 'hg-junctions',
  pois: 'hg-pois',
} as const

export const LAYERS = {
  trailCasing: 'hg-trail-casing',
  trailLine: 'hg-trail-line',
  routeCasing: 'hg-route-casing',
  routeLine: 'hg-route-line',
  poi: 'hg-poi',
  junctionCircle: 'hg-junction-circle',
  candidateCircle: 'hg-candidate-circle',
  junctionLabel: 'hg-junction-label',
  junctionHit: 'hg-junction-hit',
} as const

export function trailsToGeoJSON(graph: TrailGraph): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: graph.trails.map((t) => ({
      type: 'Feature',
      properties: { wayId: t.wayId, color: t.color, colorHex: t.colorHex, name: t.name ?? null },
      geometry: { type: 'LineString', coordinates: t.coords },
    })),
  }
}

export function edgesToGeoJSON(graph: TrailGraph): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: Object.values(graph.edges).map((e) => ({
      type: 'Feature',
      properties: { key: e.key, colorHex: e.colorHex },
      geometry: { type: 'LineString', coordinates: e.coords },
    })),
  }
}

export function junctionsToGeoJSON(graph: TrailGraph): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: Object.values(graph.junctions).map((j) => ({
      type: 'Feature',
      properties: { id: j.id, label: j.label ?? null },
      geometry: { type: 'Point', coordinates: [j.lng, j.lat] },
    })),
  }
}

export function poisToGeoJSON(graph: TrailGraph): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: graph.pois.map((p) => ({
      type: 'Feature',
      properties: { id: p.id, kind: p.kind, name: p.name ?? null },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  }
}

// Hand-drawn markers matching the paper map's legend: an eye for viewpoints,
// a flower for the "huge trees" groves. Rendered on a white badge for contrast.
const EYE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
  <circle cx="22" cy="22" r="20" fill="#fff" stroke="#1a1a2e" stroke-width="2"/>
  <path d="M8 22 Q22 10 36 22 Q22 34 8 22 Z" fill="none" stroke="#1a1a2e" stroke-width="2.5"/>
  <circle cx="22" cy="22" r="5.5" fill="#1a1a2e"/>
  <circle cx="24" cy="20" r="1.8" fill="#fff"/>
</svg>`

const FLOWER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
  <circle cx="22" cy="22" r="20" fill="#fff" stroke="#1a1a2e" stroke-width="2"/>
  <g fill="#2e7d32">
    <circle cx="22" cy="11" r="5.5"/>
    <circle cx="31.5" cy="16.5" r="5.5"/>
    <circle cx="31.5" cy="27.5" r="5.5"/>
    <circle cx="22" cy="33" r="5.5"/>
    <circle cx="12.5" cy="27.5" r="5.5"/>
    <circle cx="12.5" cy="16.5" r="5.5"/>
  </g>
  <circle cx="22" cy="22" r="4.5" fill="#fff" stroke="#1a1a2e" stroke-width="1.5"/>
</svg>`

function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(44, 44)
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

export async function loadPoiIcons(map: MaplibreMap): Promise<void> {
  const [eye, flower] = await Promise.all([svgToImage(EYE_SVG), svgToImage(FLOWER_SVG)])
  if (!map.hasImage('poi-viewpoint')) map.addImage('poi-viewpoint', eye, { pixelRatio: 2 })
  if (!map.hasImage('poi-grove')) map.addImage('poi-grove', flower, { pixelRatio: 2 })
}

/** Font stack available in the loaded style, for our symbol layers. */
function styleFontStack(map: MaplibreMap): string[] {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type === 'symbol') {
      const font = layer.layout?.['text-font']
      if (Array.isArray(font) && font.length > 0 && typeof font[0] === 'string') {
        return font as string[]
      }
    }
  }
  return ['Noto Sans Regular']
}

export function addAppLayers(map: MaplibreMap, graph: TrailGraph): void {
  map.addSource(SOURCES.trails, { type: 'geojson', data: trailsToGeoJSON(graph) })
  map.addSource(SOURCES.edges, { type: 'geojson', data: edgesToGeoJSON(graph) })
  map.addSource(SOURCES.junctions, { type: 'geojson', data: junctionsToGeoJSON(graph) })
  map.addSource(SOURCES.pois, { type: 'geojson', data: poisToGeoJSON(graph) })

  map.addLayer({
    id: LAYERS.trailCasing,
    type: 'line',
    source: SOURCES.trails,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.85 },
  })
  map.addLayer({
    id: LAYERS.trailLine,
    type: 'line',
    source: SOURCES.trails,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'colorHex'], 'line-width': 2.5 },
  })

  // Active-route highlight; filters start empty and are driven by applyRouteHighlight.
  map.addLayer({
    id: LAYERS.routeCasing,
    type: 'line',
    source: SOURCES.edges,
    filter: ['in', ['get', 'key'], ['literal', []]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#1a1a2e', 'line-width': 9, 'line-opacity': 0.9 },
  })
  map.addLayer({
    id: LAYERS.routeLine,
    type: 'line',
    source: SOURCES.edges,
    filter: ['in', ['get', 'key'], ['literal', []]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'colorHex'], 'line-width': 5 },
  })

  // Viewpoints (eye) and huge trees (flower), below junctions so numbers stay tappable.
  map.addLayer({
    id: LAYERS.poi,
    type: 'symbol',
    source: SOURCES.pois,
    filter: ['in', ['get', 'kind'], ['literal', ['grove', 'viewpoint']]],
    layout: {
      'icon-image': ['concat', 'poi-', ['get', 'kind']],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.7, 16, 1],
      'icon-allow-overlap': true,
      'text-field': ['coalesce', ['get', 'name'], ''],
      'text-font': styleFontStack(map),
      'text-size': 11,
      'text-anchor': 'top',
      'text-offset': [0, 1.1],
      'text-optional': true,
    },
    paint: {
      'text-color': '#1a1a2e',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
    },
  })

  map.addLayer({
    id: LAYERS.junctionCircle,
    type: 'circle',
    source: SOURCES.junctions,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 6, 16, 10],
      'circle-color': '#ffffff',
      'circle-stroke-color': '#1a1a2e',
      'circle-stroke-width': 1.5,
    },
  })
  map.addLayer({
    id: LAYERS.candidateCircle,
    type: 'circle',
    source: SOURCES.junctions,
    filter: ['in', ['get', 'id'], ['literal', []]],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 9, 16, 14],
      'circle-color': '#2563eb',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
      'circle-opacity': 0.9,
    },
  })
  map.addLayer({
    id: LAYERS.junctionLabel,
    type: 'symbol',
    source: SOURCES.junctions,
    layout: {
      'text-field': ['to-string', ['get', 'id']],
      'text-font': styleFontStack(map),
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 14],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#1a1a2e',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
    },
  })
  // Invisible wide tap target for junction selection.
  map.addLayer({
    id: LAYERS.junctionHit,
    type: 'circle',
    source: SOURCES.junctions,
    paint: { 'circle-radius': 18, 'circle-opacity': 0 },
  })
}

/** Independently toggleable overlay groups. */
export type LayerGroup = 'trails' | 'junctions' | 'route' | 'pois'

export const LAYER_GROUPS: Record<LayerGroup, string[]> = {
  trails: [LAYERS.trailCasing, LAYERS.trailLine],
  junctions: [
    LAYERS.junctionCircle,
    LAYERS.candidateCircle,
    LAYERS.junctionLabel,
    LAYERS.junctionHit,
  ],
  route: [LAYERS.routeCasing, LAYERS.routeLine],
  pois: [LAYERS.poi],
}

export type LayerVisibility = Record<LayerGroup, boolean>

export const DEFAULT_VISIBILITY: LayerVisibility = {
  trails: true,
  junctions: true,
  route: true,
  pois: true,
}

export function applyLayerVisibility(map: MaplibreMap, visibility: LayerVisibility): void {
  for (const [group, layerIds] of Object.entries(LAYER_GROUPS)) {
    const visible = visibility[group as LayerGroup]
    for (const id of layerIds) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    }
  }
}

export interface HighlightState {
  routeEdgeKeys: string[]
  candidateIds: JunctionId[]
}

export function applyRouteHighlight(map: MaplibreMap, state: HighlightState): void {
  const edgeFilter = ['in', ['get', 'key'], ['literal', state.routeEdgeKeys]] as never
  map.setFilter(LAYERS.routeCasing, edgeFilter)
  map.setFilter(LAYERS.routeLine, edgeFilter)
  map.setFilter(LAYERS.candidateCircle, [
    'in',
    ['get', 'id'],
    ['literal', state.candidateIds],
  ] as never)
  const routeActive = state.routeEdgeKeys.length > 0 || state.candidateIds.length > 0
  map.setPaintProperty(LAYERS.trailLine, 'line-opacity', routeActive ? 0.35 : 1)
  map.setPaintProperty(LAYERS.trailCasing, 'line-opacity', routeActive ? 0.3 : 0.85)
}
