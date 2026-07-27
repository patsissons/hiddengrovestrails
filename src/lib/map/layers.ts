import type { Map as MaplibreMap } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import type { JunctionId, TrailGraph } from '../graph/types'

export const SOURCES = {
  trails: 'hg-trails',
  edges: 'hg-edges',
  junctions: 'hg-junctions',
} as const

export const LAYERS = {
  trailCasing: 'hg-trail-casing',
  trailLine: 'hg-trail-line',
  routeCasing: 'hg-route-casing',
  routeLine: 'hg-route-line',
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
export type LayerGroup = 'trails' | 'junctions' | 'route'

export const LAYER_GROUPS: Record<LayerGroup, string[]> = {
  trails: [LAYERS.trailCasing, LAYERS.trailLine],
  junctions: [
    LAYERS.junctionCircle,
    LAYERS.candidateCircle,
    LAYERS.junctionLabel,
    LAYERS.junctionHit,
  ],
  route: [LAYERS.routeCasing, LAYERS.routeLine],
}

export type LayerVisibility = Record<LayerGroup, boolean>

export const DEFAULT_VISIBILITY: LayerVisibility = { trails: true, junctions: true, route: true }

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
