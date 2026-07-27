import { describe, it, expect } from 'vitest'
import { tinyGraph } from '@/test/fixtures/tiny-graph'
import { parseRouteParam } from './codec'
import { resolveRoute } from './validate'
import { computeStats } from './stats'

function routeFor(param: string) {
  const parsed = parseRouteParam(param)
  if (!parsed.ok) throw new Error('bad param')
  const resolved = resolveRoute(tinyGraph, parsed.tokens)
  if (!resolved.ok) throw new Error('bad route')
  return resolved.route
}

describe('computeStats', () => {
  it('sums minutes and distance over steps', () => {
    const stats = computeStats(routeFor('1.2.3.4'))
    expect(stats.totalMinutes).toBe(3 + 2 + 4)
    expect(stats.totalDistanceM).toBe(300)
    expect(stats.stepCount).toBe(3)
  })

  it('uses the chosen parallel edge', () => {
    expect(computeStats(routeFor('1.2.3b')).totalMinutes).toBe(3 + 5)
  })

  it('returns null minutes for a start-only route', () => {
    const stats = computeStats(routeFor('2'))
    expect(stats.totalMinutes).toBeNull()
    expect(stats.totalDistanceM).toBe(0)
  })
})
