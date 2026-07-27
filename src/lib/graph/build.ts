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

/** The paper-map color label for a way: explicit `description` wins, else the way name. */
function wayColor(way: OverpassWay): { color: string; name?: string } {
  const tags = way.tags ?? {}
  const name = tags.name ?? `way ${way.id}`
  if (tags.description) return { color: tags.description, name }
  return { color: name }
}

export function buildGraph(raw: OverpassData, curated: CuratedData): BuildResult {
  const warnings: string[] = []
  const excluded = new Set(curated.exclusions.map((e) => e.id))
  const ways = raw.elements.filter((el) => el.type === 'way' && !excluded.has(el.id))

  // Node coordinates and degree. Degree counts consecutive-pair incidences within
  // ways, so a node interior to one way but shared with another still shows deg >= 3.
  const nodeCoord = new Map<number, [number, number]>()
  const degree = new Map<number, number>()
  for (const way of ways) {
    way.nodes.forEach((nodeId, i) => {
      const g = way.geometry[i]
      nodeCoord.set(nodeId, [g.lon, g.lat])
    })
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
  for (const way of ways) {
    splitNodes.add(way.nodes[0])
    splitNodes.add(way.nodes[way.nodes.length - 1])
  }
  for (const nodeId of numberByNode.keys()) splitNodes.add(nodeId)

  // Cut ways into segments at split nodes.
  const segments: Segment[] = []
  for (const way of ways) {
    const { color, name } = wayColor(way)
    let start = 0
    for (let i = 1; i < way.nodes.length; i++) {
      if (splitNodes.has(way.nodes[i]) || i === way.nodes.length - 1) {
        const nodeIds = way.nodes.slice(start, i + 1)
        const coords = way.geometry.slice(start, i + 1).map((g): [number, number] => [g.lon, g.lat])
        segments.push({
          wayId: way.id,
          color,
          ...(name !== undefined && name !== color ? { name } : {}),
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
  // numbered junction; each traversed segment belongs to exactly one edge.
  const consumed = new Set<Segment>()
  const warnedNodes = new Set<number>()
  interface RawEdge {
    from: JunctionId
    to: JunctionId
    coords: [number, number][]
    distanceM: number
    parts: Segment[]
  }
  const rawEdges: RawEdge[] = []

  const appendCoords = (
    acc: [number, number][],
    seg: Segment,
    from: number,
  ): [number, number][] => {
    const coords = seg.nodeIds[0] === from ? seg.coords : [...seg.coords].reverse()
    return acc.length === 0 ? coords : [...acc, ...coords.slice(1)]
  }

  for (const startNode of numberByNode.keys()) {
    for (const firstSeg of incidence.get(startNode) ?? []) {
      if (consumed.has(firstSeg)) continue
      const parts: Segment[] = []
      let coords: [number, number][] = []
      let currentNode = startNode
      let seg: Segment | undefined = firstSeg
      let terminal: number | undefined
      const localConsumed: Segment[] = []

      while (seg) {
        parts.push(seg)
        localConsumed.push(seg)
        coords = appendCoords(coords, seg, currentNode)
        const nextNode = segEnd(seg, currentNode)
        if (numberByNode.has(nextNode)) {
          terminal = nextNode
          break
        }
        const nextSegs = (incidence.get(nextNode) ?? []).filter(
          (s) => s !== seg && !localConsumed.includes(s),
        )
        if (nextSegs.length !== 1) {
          if (!warnedNodes.has(nextNode)) {
            warnedNodes.add(nextNode)
            const [lng, lat] = nodeCoord.get(nextNode) ?? [0, 0]
            warnings.push(
              nextSegs.length === 0
                ? `unnumbered dead end at OSM node ${nextNode} (${lat.toFixed(5)}, ${lng.toFixed(5)}) via way ${seg.wayId} — number it, or exclude the way`
                : `unnumbered junction at OSM node ${nextNode} (${lat.toFixed(5)}, ${lng.toFixed(5)}) — assign it an intersection number or exclude a way`,
            )
          }
          seg = undefined
          break
        }
        currentNode = nextNode
        seg = nextSegs[0]
      }

      if (terminal === undefined) continue
      for (const s of localConsumed) consumed.add(s)

      const colors = [...new Set(parts.map((p) => p.color))]
      if (colors.length > 1) {
        warnings.push(
          `edge ${numberByNode.get(startNode)}-${numberByNode.get(terminal)}: color changes mid-edge (${colors.join(', ')}) at an unnumbered node`,
        )
      }
      rawEdges.push({
        from: numberByNode.get(startNode)!,
        to: numberByNode.get(terminal)!,
        coords,
        distanceM: parts.reduce((sum, p) => sum + p.distanceM, 0),
        parts,
      })
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
    group.sort((x, y) => {
      const cx = dominantColor(x.parts)
      const cy = dominantColor(y.parts)
      return cx === cy ? x.distanceM - y.distanceM : cx < cy ? -1 : 1
    })
    group.forEach((e, i) => {
      const key: EdgeKey = i === 0 ? base : `${base}${String.fromCharCode(97 + i)}` // b, c, …
      const color = dominantColor(e.parts)
      const name = e.parts.find((p) => p.name)?.name
      const minutes = curated.edgeTimes[key] ?? null
      if (minutes === null) warnings.push(`edge ${key}: no walking time curated`)
      const { hex, known } = colorHexFor(color)
      if (!known) warnings.push(`edge ${key}: no hex mapping for color "${color}"`)
      if (minutes !== null && e.distanceM > 0) {
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

  const trails = ways.map((w) => {
    const { color, name } = wayColor(w)
    return {
      wayId: w.id,
      color,
      colorHex: colorHexFor(color).hex,
      ...(name !== undefined && name !== color ? { name } : {}),
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
