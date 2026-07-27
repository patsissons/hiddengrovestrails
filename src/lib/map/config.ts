import type { TrailGraph } from '../graph/types'

// Free, no-key vector base style (OSM data). Swap here if OpenFreeMap is unavailable.
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

function boundsOf(coordLists: [number, number][][]): Bounds {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const coords of coordLists) {
    for (const [lng, lat] of coords) {
      if (lng < west) west = lng
      if (lng > east) east = lng
      if (lat < south) south = lat
      if (lat > north) north = lat
    }
  }
  return { west, south, east, north }
}

/** Bounding box of the whole trail network, for the initial camera fit. */
export function graphBounds(graph: TrailGraph): Bounds {
  return boundsOf(graph.trails.map((t) => t.coords))
}

/** Bounding box of a set of edges (e.g. the route loaded from the URL). */
export function edgeBounds(graph: TrailGraph, edgeKeys: string[]): Bounds | undefined {
  const lists = edgeKeys.map((k) => graph.edges[k]?.coords).filter(Boolean)
  return lists.length > 0 ? boundsOf(lists) : undefined
}
