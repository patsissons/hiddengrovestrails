import type { TrailGraph } from '../graph/types'

// Free, no-key vector base style (OSM data). Swap here if OpenFreeMap is unavailable.
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

/** Bounding box of the whole trail network, for the initial camera fit. */
export function graphBounds(graph: TrailGraph): Bounds {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const trail of graph.trails) {
    for (const [lng, lat] of trail.coords) {
      if (lng < west) west = lng
      if (lng > east) east = lng
      if (lat < south) south = lat
      if (lat > north) north = lat
    }
  }
  return { west, south, east, north }
}
