import type { Route } from './validate'

export interface RouteStats {
  /** Sum of curated walking minutes; null when the route has no steps. */
  totalMinutes: number | null
  totalDistanceM: number
  stepCount: number
}

export function computeStats(route: Route): RouteStats {
  if (route.steps.length === 0) {
    return { totalMinutes: null, totalDistanceM: 0, stepCount: 0 }
  }
  let minutes = 0
  let distance = 0
  for (const step of route.steps) {
    minutes += step.edge.minutes ?? 0
    distance += step.edge.distanceM
  }
  return { totalMinutes: minutes, totalDistanceM: distance, stepCount: route.steps.length }
}
