import { describe, it, expect } from 'vitest'
import { graph } from './graph'
import { UNKNOWN_COLOR_HEX } from '../lib/map/colors'

// Structural validation of the committed graph.json — a bad regeneration
// (pnpm data:build) fails validate:quick instead of breaking at runtime.
describe('committed trail graph', () => {
  it('has every paper-map intersection number', () => {
    const expected = [...range(1, 24), 26, 27, ...range(30, 39), ...range(50, 58), ...range(69, 80)]
    expect(Object.keys(graph.junctions).map(Number).sort(numeric)).toEqual(expected)
  })

  it('has symmetric, consistent adjacency', () => {
    for (const [id, keys] of Object.entries(graph.adjacency)) {
      for (const key of keys) {
        const edge = graph.edges[key]
        expect(edge, `adjacency of ${id} references missing edge ${key}`).toBeDefined()
        expect([String(edge.a), String(edge.b)]).toContain(id)
      }
    }
    for (const edge of Object.values(graph.edges)) {
      expect(graph.adjacency[String(edge.a)]).toContain(edge.key)
      expect(graph.adjacency[String(edge.b)]).toContain(edge.key)
    }
  })

  it('is fully connected', () => {
    const ids = Object.keys(graph.junctions)
    const seen = new Set([ids[0]])
    const queue = [ids[0]]
    while (queue.length > 0) {
      const id = queue.pop()!
      for (const key of graph.adjacency[id] ?? []) {
        const e = graph.edges[key]
        for (const other of [String(e.a), String(e.b)]) {
          if (!seen.has(other)) {
            seen.add(other)
            queue.push(other)
          }
        }
      }
    }
    expect(seen.size).toBe(ids.length)
  })

  it('has curated minutes and plausible distance on every edge', () => {
    for (const edge of Object.values(graph.edges)) {
      expect(edge.minutes, `edge ${edge.key} has no minutes`).not.toBeNull()
      expect(edge.minutes).toBeGreaterThan(0)
      expect(edge.distanceM).toBeGreaterThan(0)
      expect(edge.coords.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('has a known color hex on every edge and trail', () => {
    for (const edge of Object.values(graph.edges)) {
      expect(edge.colorHex, `edge ${edge.key} color "${edge.color}"`).not.toBe(UNKNOWN_COLOR_HEX)
    }
    for (const trail of graph.trails) {
      expect(trail.colorHex, `way ${trail.wayId} color "${trail.color}"`).not.toBe(
        UNKNOWN_COLOR_HEX,
      )
    }
  })

  it('orders edge coords from junction a to junction b', () => {
    for (const edge of Object.values(graph.edges)) {
      const a = graph.junctions[String(edge.a)]
      const b = graph.junctions[String(edge.b)]
      const [firstLng, firstLat] = edge.coords[0]
      const [lastLng, lastLat] = edge.coords[edge.coords.length - 1]
      expect(Math.abs(firstLng - a.lng) + Math.abs(firstLat - a.lat)).toBeLessThan(1e-9)
      expect(Math.abs(lastLng - b.lng) + Math.abs(lastLat - b.lat)).toBeLessThan(1e-9)
    }
  })
})

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

function numeric(a: number, b: number): number {
  return a - b
}
