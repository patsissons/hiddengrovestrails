import { describe, it, expect } from 'vitest'
import { tinyGraph } from '@/test/fixtures/tiny-graph'
import { graph as realGraph } from '@/data/graph'
import { parseRouteParam } from './codec'
import { adjacentJunctions, describeRouteError, edgesBetween, resolveRoute } from './validate'

function resolve(param: string) {
  const parsed = parseRouteParam(param)
  if (!parsed.ok) throw new Error(`bad param ${param}`)
  return resolveRoute(tinyGraph, parsed.tokens)
}

describe('resolveRoute', () => {
  it('resolves a valid route with default edges', () => {
    const result = resolve('1.2.3.4')
    if (!result.ok) throw new Error('expected ok')
    expect(result.route.start).toBe(1)
    expect(result.route.steps.map((s) => s.edge.key)).toEqual(['1-2', '2-3', '3-4'])
  })

  it('resolves parallel-edge suffixes and defaults', () => {
    const viaDefault = resolve('2.3')
    const viaAlt = resolve('2.3b')
    if (!viaDefault.ok || !viaAlt.ok) throw new Error('expected ok')
    expect(viaDefault.route.steps[0].edge.key).toBe('2-3')
    expect(viaAlt.route.steps[0].edge.key).toBe('2-3b')
    // suffix works in the reverse direction too
    const reverse = resolve('3b.2')
    if (reverse.ok) {
      // the suffix belongs to the arrival token, so "3b" as a start is inert
      expect(reverse.route.steps[0].edge.key).toBe('2-3')
    }
  })

  it('rejects unknown junctions', () => {
    const result = resolve('1.99')
    expect(result).toEqual({
      ok: false,
      error: { kind: 'unknown-junction', junction: 99, index: 1 },
    })
  })

  it('rejects non-adjacent steps', () => {
    const result = resolve('1.3')
    expect(result).toEqual({ ok: false, error: { kind: 'not-adjacent', from: 1, to: 3, index: 1 } })
  })

  it('rejects unknown parallel suffixes', () => {
    const result = resolve('1.2c')
    expect(result).toEqual({
      ok: false,
      error: { kind: 'unknown-alt', from: 1, to: 2, alt: 'c', index: 1 },
    })
  })

  it('accepts a single-junction route', () => {
    const result = resolve('3')
    if (!result.ok) throw new Error('expected ok')
    expect(result.route.start).toBe(3)
    expect(result.route.steps).toEqual([])
  })

  it('describes every error kind', () => {
    expect(describeRouteError({ kind: 'empty' })).toMatch(/empty/)
    expect(describeRouteError({ kind: 'unknown-junction', junction: 99, index: 1 })).toMatch(/99/)
    expect(describeRouteError({ kind: 'not-adjacent', from: 1, to: 3, index: 1 })).toMatch(
      /1 and 3/,
    )
    expect(describeRouteError({ kind: 'unknown-alt', from: 1, to: 2, alt: 'c', index: 1 })).toMatch(
      /"c"/,
    )
  })
})

describe('edgesBetween / adjacentJunctions', () => {
  it('lists parallel edges default-first', () => {
    expect(edgesBetween(tinyGraph, 2, 3).map((e) => e.key)).toEqual(['2-3', '2-3b'])
    expect(edgesBetween(tinyGraph, 3, 2).map((e) => e.key)).toEqual(['2-3', '2-3b'])
  })

  it('does not confuse shared key prefixes (7-8 vs hypothetical 7-80)', () => {
    // real graph: junction 7 connects to 8 and 24 only
    expect(adjacentJunctions(realGraph, 7)).toEqual([6, 8, 24])
    expect(edgesBetween(realGraph, 7, 8).map((e) => e.key)).toEqual(['7-8'])
  })

  it('lists adjacent junctions ascending', () => {
    expect(adjacentJunctions(tinyGraph, 2)).toEqual([1, 3, 4])
  })

  it('resolves real-map parallel routes 70-71 (Main vs Rock Loop)', () => {
    const edges = edgesBetween(realGraph, 70, 71)
    expect(edges.map((e) => e.key)).toEqual(['70-71', '70-71b'])
    // default = the short Main connector; "71b" = the long Rock Loop
    const viaDefault = resolveRoute(realGraph, [{ junction: 70 }, { junction: 71 }])
    const viaRock = resolveRoute(realGraph, [{ junction: 70 }, { junction: 71, alt: 'b' }])
    if (!viaDefault.ok || !viaRock.ok) throw new Error('expected ok')
    expect(viaDefault.route.steps[0].edge.name).toBe('Main')
    expect(viaRock.route.steps[0].edge.name).toBe('Rock Loop')
  })
})
