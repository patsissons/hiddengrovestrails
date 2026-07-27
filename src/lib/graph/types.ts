/** Paper-map intersection number (1–80). */
export type JunctionId = number

/** Canonical edge key: `"4-5"`, or `"74-75b"` for parallel alternatives (suffixes b, c, …). */
export type EdgeKey = string

export interface Junction {
  id: JunctionId
  osmNodeId: number
  lng: number
  lat: number
  label?: string
}

export interface Edge {
  key: EdgeKey
  /** Lower-numbered endpoint (a <= b; a === b for loops). */
  a: JunctionId
  b: JunctionId
  /** Color label from the paper map / OSM ("Red", "Blue", "Root Loop", …). */
  color: string
  colorHex: string
  /** Trail name where one exists ("Monty's Way", "Mike's Lane", …). */
  name?: string
  /** Walking time in minutes from the paper map; null until curated. */
  minutes: number | null
  distanceM: number
  /** [lng, lat] polyline ordered from a to b. */
  coords: [number, number][]
}

export type PoiKind = 'grove' | 'viewpoint' | 'parking' | 'kiosk'

export interface Poi {
  id: string
  kind: PoiKind
  name: string
  lng: number
  lat: number
}

/** Physical geometry of one OSM way — the always-complete base render layer. */
export interface TrailFeature {
  wayId: number
  color: string
  colorHex: string
  name?: string
  coords: [number, number][]
}

export interface TrailGraph {
  junctions: Record<string, Junction>
  edges: Record<EdgeKey, Edge>
  /** Junction id -> incident edge keys. */
  adjacency: Record<string, EdgeKey[]>
  /** All included ways, independent of curation state. */
  trails: TrailFeature[]
  pois: Poi[]
  meta: {
    generatedAt: string
    osmDataDate: string
  }
}

// --- Raw Overpass "out geom" response ---

export interface OverpassWay {
  type: 'way'
  id: number
  nodes: number[]
  geometry: { lat: number; lon: number }[]
  tags?: Record<string, string>
}

export interface OverpassData {
  osm3s?: { timestamp_osm_base?: string }
  elements: OverpassWay[]
}

// --- Curated inputs (data/curated/*.json) ---

export interface CuratedJunction {
  osmNodeId: number
  label?: string
}

export interface CuratedExclusion {
  id: number
  reason: string
  /** Still drawn on the map, but excluded from the routing graph (e.g. viewpoint spurs). */
  keepVisible?: boolean
}

/** Synthetic two-node connector bridging a gap in the OSM data. */
export interface CuratedSegment {
  a: number
  b: number
  color: string
  name?: string
  reason: string
}

export interface CuratedData {
  /** Intersection number -> OSM node. */
  junctions: Record<string, CuratedJunction>
  /** Edge key -> walking minutes from the paper map. */
  edgeTimes: Record<string, number>
  exclusions: CuratedExclusion[]
  pois: Poi[]
  /** OSM way id -> paper-map color label, overriding way tags. */
  wayColors?: Record<string, string>
  /** Edge key -> color label, for edges whose constituent ways mix colors. */
  edgeColors?: Record<string, string>
  /** Unnumbered fork nodes where edge walks branch into every continuation. */
  forkThrough?: number[]
  extraSegments?: CuratedSegment[]
}
