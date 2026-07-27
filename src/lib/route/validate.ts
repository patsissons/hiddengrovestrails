import type { Edge, JunctionId, TrailGraph } from '../graph/types'
import type { RouteToken } from './codec'

export interface RouteStep {
  from: JunctionId
  to: JunctionId
  edge: Edge
}

export interface Route {
  start: JunctionId
  steps: RouteStep[]
}

export type RouteError =
  | { kind: 'empty' }
  | { kind: 'unknown-junction'; junction: number; index: number }
  | { kind: 'not-adjacent'; from: JunctionId; to: JunctionId; index: number }
  | { kind: 'unknown-alt'; from: JunctionId; to: JunctionId; alt: string; index: number }

/**
 * Edges connecting two junctions, default first (the same order the edge-key
 * suffixes were assigned in).
 */
export function edgesBetween(graph: TrailGraph, from: JunctionId, to: JunctionId): Edge[] {
  const [a, b] = from <= to ? [from, to] : [to, from]
  const base = `${a}-${b}`
  return (graph.adjacency[String(from)] ?? [])
    .filter(
      (key) => key === base || (key.startsWith(base) && /^[a-z]$/.test(key.slice(base.length))),
    )
    .sort()
    .map((key) => graph.edges[key])
}

/** Junctions reachable in one step, ascending. */
export function adjacentJunctions(graph: TrailGraph, from: JunctionId): JunctionId[] {
  const out = new Set<JunctionId>()
  for (const key of graph.adjacency[String(from)] ?? []) {
    const edge = graph.edges[key]
    out.add(edge.a === from ? edge.b : edge.a)
    if (edge.a === edge.b) out.add(from)
  }
  return [...out].sort((x, y) => x - y)
}

export function resolveRoute(
  graph: TrailGraph,
  tokens: RouteToken[],
): { ok: true; route: Route } | { ok: false; error: RouteError } {
  if (tokens.length === 0) return { ok: false, error: { kind: 'empty' } }
  for (const [index, token] of tokens.entries()) {
    if (!(String(token.junction) in graph.junctions)) {
      return { ok: false, error: { kind: 'unknown-junction', junction: token.junction, index } }
    }
  }

  const start = tokens[0].junction
  const steps: RouteStep[] = []
  for (let i = 1; i < tokens.length; i++) {
    const from = tokens[i - 1].junction
    const { junction: to, alt } = tokens[i]
    const candidates = edgesBetween(graph, from, to)
    if (candidates.length === 0) {
      return { ok: false, error: { kind: 'not-adjacent', from, to, index: i } }
    }
    let edge: Edge
    if (alt !== undefined) {
      const key = `${Math.min(from, to)}-${Math.max(from, to)}${alt}`
      const match = candidates.find((e) => e.key === key)
      if (!match) return { ok: false, error: { kind: 'unknown-alt', from, to, alt, index: i } }
      edge = match
    } else {
      edge = candidates[0]
    }
    steps.push({ from, to, edge })
  }
  return { ok: true, route: { start, steps } }
}

export function describeRouteError(error: RouteError): string {
  switch (error.kind) {
    case 'empty':
      return 'The route is empty.'
    case 'unknown-junction':
      return `Intersection ${error.junction} does not exist on the trail map.`
    case 'not-adjacent':
      return `Intersections ${error.from} and ${error.to} are not directly connected by a trail.`
    case 'unknown-alt':
      return `There is no alternative trail "${error.alt}" between ${error.from} and ${error.to}.`
  }
}
