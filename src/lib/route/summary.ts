import type { TrailGraph } from '../graph/types'
import { formatDistance } from '../format'
import { parseRouteParam } from './codec'
import { resolveRoute } from './validate'
import { computeStats } from './stats'

export interface RouteMeta {
  title: string
  description: string
}

export const DEFAULT_META: RouteMeta = {
  title: 'Hidden Groves Trails — Route Planner',
  description:
    'Plan and share hiking routes through the Hidden Groves trails in Sechelt, BC. ' +
    'Pick a starting intersection, follow the colored trail markers, and share your route as a link.',
}

/**
 * Human-readable summary of a route URL param, for page titles and OpenGraph
 * tags. Returns null when the param is missing or invalid (use DEFAULT_META).
 */
export function buildRouteMeta(graph: TrailGraph, param: string | null): RouteMeta | null {
  if (!param) return null
  const parsed = parseRouteParam(param)
  if (!parsed.ok) return null
  const resolved = resolveRoute(graph, parsed.tokens)
  if (!resolved.ok || resolved.route.steps.length === 0) return null

  const { route } = resolved
  const stats = computeStats(route)
  const end = route.steps[route.steps.length - 1].to
  const startLabel = graph.junctions[String(route.start)]?.label
  const start = startLabel ? `${route.start} (${startLabel})` : String(route.start)

  const legs = `${stats.stepCount} ${stats.stepCount === 1 ? 'leg' : 'legs'}`
  return {
    title: `Hidden Groves route ${route.start} → ${end} · ~${stats.totalMinutes} min · ${formatDistance(stats.totalDistanceM)} · ${legs}`,
    description:
      `A ${formatDistance(stats.totalDistanceM)} walk (~${stats.totalMinutes} min, ` +
      `${stats.stepCount} ${stats.stepCount === 1 ? 'leg' : 'legs'}) through the Hidden Groves ` +
      `trails in Sechelt, BC, starting at intersection ${start}: ` +
      `${parsed.tokens.map((t) => `${t.junction}${t.alt ?? ''}`).join(' → ')}.`,
  }
}
