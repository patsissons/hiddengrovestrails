import { describe, it, expect } from 'vitest'
import { tinyGraph } from '@/test/fixtures/tiny-graph'
import { graph as realGraph } from '@/data/graph'
import { DEFAULT_META, buildRouteMeta } from './summary'

describe('buildRouteMeta', () => {
  it('summarizes a valid route with duration, distance, and legs', () => {
    const meta = buildRouteMeta(tinyGraph, '1.2.3b')
    expect(meta).not.toBeNull()
    expect(meta!.title).toBe('Hidden Groves route 1 → 3 · ~8 min')
    expect(meta!.description).toContain('200 m walk')
    expect(meta!.description).toContain('~8 min')
    expect(meta!.description).toContain('2 legs')
    expect(meta!.description).toContain('1 → 2 → 3b')
  })

  it('includes the junction label for named starts on the real graph', () => {
    const meta = buildRouteMeta(realGraph, '1.30.32')
    expect(meta!.description).toContain('intersection 1 (Kiosk)')
  })

  it('returns null for missing, invalid, or start-only params', () => {
    expect(buildRouteMeta(tinyGraph, null)).toBeNull()
    expect(buildRouteMeta(tinyGraph, 'garbage!')).toBeNull()
    expect(buildRouteMeta(tinyGraph, '1.99')).toBeNull()
    expect(buildRouteMeta(tinyGraph, '2')).toBeNull()
  })

  it('has sensible defaults', () => {
    expect(DEFAULT_META.title).toContain('Hidden Groves')
    expect(DEFAULT_META.description).toContain('Sechelt')
  })
})
