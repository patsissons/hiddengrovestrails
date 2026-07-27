import type {
  CuratedData,
  EdgeKey,
  JunctionId,
  OverpassData,
  OverpassWay,
  TrailGraph,
} from './types'
import { colorHexFor } from '../map/colors'

export interface BuildResult {
  graph: TrailGraph
  warnings: string[]
}

/** A run of OSM nodes between two split nodes, entirely within one way. */
interface Segment {
  id: number
  wayId: number
  color: string
  name?: string
  nodeIds: number[]
  coords: [number, number][]
  distanceM: number
}

const EARTH_RADIUS_M = 6371008.8

export function haversineM(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinLng * sinLng
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

function polylineDistanceM(coords: [number, number][]): number {
  let sum = 0
  for (let i = 1; i < coords.length; i++) sum += haversineM(coords[i - 1], coords[i])
  return sum
}

/**
 * The paper-map color label for a way — the marker color hikers follow on the
 * ground. Curated override wins, then the OSM `description`, then the way name.
 */
function wayColor(
  way: OverpassWay,
  overrides: Record<string, string>,
): { color: string; name?: string } {
  const tags = way.tags ?? {}
  const color = overrides[String(way.id)] ?? tags.description ?? tags.name ?? `way ${way.id}`
  const name = tags.name !== undefined && tags.name !== color ? tags.name : undefined
  return name !== undefined ? { color, name } : { color }
}

export function buildGraph(raw: OverpassData, curated: CuratedData): BuildResult {
  const warnings: string[] = []
  const colorOverrides = curated.wayColors ?? {}
  const hidden = new Set(curated.exclusions.filter((e) => !e.keepVisible).map((e) => e.id))
  const graphExcluded = new Set(curated.exclusions.map((e) => e.id))
  const drawnWays = raw.elements.filter((el) => el.type === 'way' && !hidden.has(el.id))
  const ways = drawnWays.filter((el) => !graphExcluded.has(el.id))

  const nodeCoord = new Map<number, [number, number]>()
  for (const way of ways) {
    way.nodes.forEach((nodeId, i) => {
      const g = way.geometry[i]
      nodeCoord.set(nodeId, [g.lon, g.lat])
    })
  }

  // Synthetic connectors bridging gaps in the OSM data (e.g. unconnected stubs
  // across a road). Their endpoints must be nodes of included ways.
  const synthetic: OverpassWay[] = []
  for (const [i, seg] of (curated.extraSegments ?? []).entries()) {
    const ca = nodeCoord.get(seg.a)
    const cb = nodeCoord.get(seg.b)
    if (!ca || !cb) {
      warnings.push(`extra segment ${seg.a}-${seg.b}: endpoint node not found in included ways`)
      continue
    }
    synthetic.push({
      type: 'way',
      id: -(i + 1),
      nodes: [seg.a, seg.b],
      geometry: [
        { lon: ca[0], lat: ca[1] },
        { lon: cb[0], lat: cb[1] },
      ],
      tags: { name: seg.name ?? seg.color, description: seg.color },
    })
  }
  const allWays = [...ways, ...synthetic]

  // Degree counts consecutive-pair incidences within ways, so a node interior
  // to one way but shared with another still shows deg >= 3.
  const degree = new Map<number, number>()
  for (const way of allWays) {
    for (let i = 1; i < way.nodes.length; i++) {
      degree.set(way.nodes[i - 1], (degree.get(way.nodes[i - 1]) ?? 0) + 1)
      degree.set(way.nodes[i], (degree.get(way.nodes[i]) ?? 0) + 1)
    }
  }

  // Numbered junctions from curation.
  const numberByNode = new Map<number, JunctionId>()
  const junctions: TrailGraph['junctions'] = {}
  for (const [numStr, cj] of Object.entries(curated.junctions)) {
    const id = Number(numStr)
    const coord = nodeCoord.get(cj.osmNodeId)
    if (!coord) {
      warnings.push(
        `junction ${id}: OSM node ${cj.osmNodeId} not found in raw data (OSM churn? excluded way?)`,
      )
      continue
    }
    if (numberByNode.has(cj.osmNodeId)) {
      warnings.push(
        `junction ${id}: OSM node ${cj.osmNodeId} already assigned to junction ${numberByNode.get(cj.osmNodeId)}`,
      )
      continue
    }
    numberByNode.set(cj.osmNodeId, id)
    junctions[String(id)] = {
      id,
      osmNodeId: cj.osmNodeId,
      lng: coord[0],
      lat: coord[1],
      ...(cj.label ? { label: cj.label } : {}),
    }
  }

  // Split nodes: real intersections, way endpoints, and curated numbered nodes.
  const splitNodes = new Set<number>()
  for (const [nodeId, deg] of degree) if (deg >= 3) splitNodes.add(nodeId)
  for (const way of allWays) {
    splitNodes.add(way.nodes[0])
    splitNodes.add(way.nodes[way.nodes.length - 1])
  }
  for (const nodeId of numberByNode.keys()) splitNodes.add(nodeId)

  // Cut ways into segments at split nodes.
  const segments: Segment[] = []
  for (const way of allWays) {
    const { color, name } = wayColor(way, colorOverrides)
    let start = 0
    for (let i = 1; i < way.nodes.length; i++) {
      if (splitNodes.has(way.nodes[i]) || i === way.nodes.length - 1) {
        const nodeIds = way.nodes.slice(start, i + 1)
        const coords = way.geometry.slice(start, i + 1).map((g): [number, number] => [g.lon, g.lat])
        segments.push({
          id: segments.length,
          wayId: way.id,
          color,
          ...(name !== undefined ? { name } : {}),
          nodeIds,
          coords,
          distanceM: polylineDistanceM(coords),
        })
        start = i
      }
    }
  }

  // Segment incidence by endpoint node.
  const incidence = new Map<number, Segment[]>()
  for (const seg of segments) {
    for (const end of [seg.nodeIds[0], seg.nodeIds[seg.nodeIds.length - 1]]) {
      const list = incidence.get(end)
      if (list) list.push(seg)
      else incidence.set(end, [seg])
    }
  }

  const segEnd = (seg: Segment, from: number): number =>
    seg.nodeIds[0] === from ? seg.nodeIds[seg.nodeIds.length - 1] : seg.nodeIds[0]

  // Walk from each numbered junction through unnumbered split nodes until another
  // numbered junction. Every edge is discovered from both ends (and forkThrough
  // nodes branch into every continuation), so edges dedupe by segment signature.
  const forkThrough = new Set(curated.forkThrough ?? [])
  const warnedNodes = new Set<number>()
  interface RawEdge {
    from: JunctionId
    to: JunctionId
    coords: [number, number][]
    distanceM: number
    parts: Segment[]
  }
  const rawEdges: RawEdge[] = []
  const edgeSignatures = new Set<string>()

  const appendCoords = (
    acc: [number, number][],
    seg: Segment,
    from: number,
  ): [number, number][] => {
    const coords = seg.nodeIds[0] === from ? seg.coords : [...seg.coords].reverse()
    return acc.length === 0 ? coords : [...acc, ...coords.slice(1)]
  }

  interface WalkState {
    node: number
    seg: Segment
    parts: Segment[]
    coords: [number, number][]
  }

  for (const startNode of numberByNode.keys()) {
    const stack: WalkState[] = (incidence.get(startNode) ?? []).map((seg) => ({
      node: startNode,
      seg,
      parts: [],
      coords: [],
    }))
    while (stack.length > 0) {
      const state = stack.pop()!
      const parts = [...state.parts, state.seg]
      const coords = appendCoords(state.coords, state.seg, state.node)
      const nextNode = segEnd(state.seg, state.node)

      if (numberByNode.has(nextNode)) {
        const signature = `${parts
          .map((p) => p.id)
          .sort((x, y) => x - y)
          .join(',')}`
        if (edgeSignatures.has(signature)) continue
        edgeSignatures.add(signature)
        rawEdges.push({
          from: numberByNode.get(startNode)!,
          to: numberByNode.get(nextNode)!,
          coords,
          distanceM: parts.reduce((sum, p) => sum + p.distanceM, 0),
          parts,
        })
        continue
      }

      const continuations = (incidence.get(nextNode) ?? []).filter(
        (s) => s !== state.seg && !parts.includes(s),
      )
      if (continuations.length === 1 || (continuations.length > 1 && forkThrough.has(nextNode))) {
        for (const seg of continuations) {
          stack.push({ node: nextNode, seg, parts, coords })
        }
      } else if (!warnedNodes.has(nextNode)) {
        warnedNodes.add(nextNode)
        const [lng, lat] = nodeCoord.get(nextNode) ?? [0, 0]
        warnings.push(
          continuations.length === 0
            ? `unnumbered dead end at OSM node ${nextNode} (${lat.toFixed(5)}, ${lng.toFixed(5)}) via way ${state.seg.wayId} — number it, or exclude the way`
            : `unnumbered junction at OSM node ${nextNode} (${lat.toFixed(5)}, ${lng.toFixed(5)}) — assign it an intersection number, or mark forkThrough, or exclude a way`,
        )
      }
    }
  }

  // Canonicalize (a <= b, coords a -> b), group parallels, assign suffix keys.
  const grouped = new Map<string, RawEdge[]>()
  for (const e of rawEdges) {
    if (e.from > e.to) {
      e.coords = [...e.coords].reverse()
      ;[e.from, e.to] = [e.to, e.from]
    }
    const base = `${e.from}-${e.to}`
    const list = grouped.get(base) ?? []
    list.push(e)
    grouped.set(base, list)
  }

  const edges: TrailGraph['edges'] = {}
  const adjacency: TrailGraph['adjacency'] = {}
  for (const id of Object.keys(junctions)) adjacency[id] = []

  for (const [base, group] of grouped) {
    // Shortest first: the unsuffixed key is the most direct option between two junctions.
    group.sort((x, y) => {
      if (x.distanceM !== y.distanceM) return x.distanceM - y.distanceM
      const cx = dominantColor(x.parts)
      const cy = dominantColor(y.parts)
      return cx < cy ? -1 : cx > cy ? 1 : 0
    })
    group.forEach((e, i) => {
      const key: EdgeKey = i === 0 ? base : `${base}${String.fromCharCode(97 + i)}` // b, c, …
      const curatedColor = curated.edgeColors?.[key]
      const color = curatedColor ?? dominantColor(e.parts)
      const partColors = [...new Set(e.parts.map((p) => p.color))]
      if (partColors.length > 1 && !curatedColor) {
        warnings.push(
          `edge ${key}: color changes mid-edge (${partColors.join(', ')}) — curate edgeColors["${key}"] or number the transition`,
        )
      }
      // Trail name from the longest part matching the edge color, so a short
      // tail from an adjoining trail can't donate its name (e.g. 1-4 is the
      // Purple trail, not "Monty's Way", despite a metre of Blue at one end).
      const name = e.parts
        .filter((p) => p.color === color && p.name)
        .sort((x, y) => y.distanceM - x.distanceM)[0]?.name
      const minutes = curated.edgeTimes[key] ?? null
      if (minutes === null) warnings.push(`edge ${key}: no walking time curated`)
      const { hex, known } = colorHexFor(color)
      if (!known) warnings.push(`edge ${key}: no hex mapping for color "${color}"`)
      // Short edges are all 1-minute granularity noise; only sanity-check real legs.
      if (minutes !== null && e.distanceM >= 150) {
        const paceMinPerKm = minutes / (e.distanceM / 1000)
        if (paceMinPerKm < 8 || paceMinPerKm > 45) {
          warnings.push(
            `edge ${key}: pace ${paceMinPerKm.toFixed(1)} min/km looks wrong (${minutes} min over ${Math.round(e.distanceM)} m)`,
          )
        }
      }
      edges[key] = {
        key,
        a: e.from,
        b: e.to,
        color,
        colorHex: hex,
        ...(name ? { name } : {}),
        minutes,
        distanceM: Math.round(e.distanceM),
        coords: e.coords,
      }
      adjacency[String(e.from)]?.push(key)
      if (e.to !== e.from) adjacency[String(e.to)]?.push(key)
    })
  }

  for (const key of Object.keys(curated.edgeTimes)) {
    if (!(key in edges)) warnings.push(`edge time "${key}" does not match any built edge`)
  }

  for (const list of Object.values(adjacency)) list.sort()

  // Connectivity over numbered junctions.
  const ids = Object.keys(junctions)
  if (ids.length > 0) {
    const seen = new Set<string>()
    const queue = [ids[0]]
    seen.add(ids[0])
    while (queue.length) {
      const id = queue.pop()!
      for (const key of adjacency[id] ?? []) {
        const e = edges[key]
        for (const nb of [String(e.a), String(e.b)]) {
          if (!seen.has(nb)) {
            seen.add(nb)
            queue.push(nb)
          }
        }
      }
    }
    if (seen.size !== ids.length) {
      const missing = ids.filter((id) => !seen.has(id))
      warnings.push(
        `graph is disconnected: junctions [${missing.join(', ')}] unreachable from ${ids[0]}`,
      )
    }
  }

  const trails = [...drawnWays, ...synthetic].map((w) => {
    const { color, name } = wayColor(w, colorOverrides)
    const { hex, known } = colorHexFor(color)
    if (!known) warnings.push(`trail way ${w.id}: no hex mapping for color "${color}"`)
    return {
      wayId: w.id,
      color,
      colorHex: hex,
      ...(name !== undefined ? { name } : {}),
      coords: w.geometry.map((g): [number, number] => [g.lon, g.lat]),
    }
  })

  return {
    graph: {
      junctions,
      edges,
      adjacency,
      trails,
      pois: curated.pois,
      meta: {
        generatedAt: new Date().toISOString(),
        osmDataDate: raw.osm3s?.timestamp_osm_base ?? 'unknown',
      },
    },
    warnings,
  }
}

/** Color of the longest constituent segment. */
function dominantColor(parts: Segment[]): string {
  const byColor = new Map<string, number>()
  for (const p of parts) byColor.set(p.color, (byColor.get(p.color) ?? 0) + p.distanceM)
  return [...byColor.entries()].sort((a, b) => b[1] - a[1])[0][0]
}
