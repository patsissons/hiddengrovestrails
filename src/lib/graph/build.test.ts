import { describe, it, expect } from 'vitest'
import { buildGraph, haversineM } from './build'
import type { CuratedData, OverpassData, OverpassWay } from './types'

// Deterministic coords per synthetic node id so shared nodes align across ways.
function way(id: number, nodes: number[], tags?: Record<string, string>): OverpassWay {
  return {
    type: 'way',
    id,
    nodes,
    geometry: nodes.map((n) => ({ lat: 49.5 + n * 0.001, lon: -123.7 + n * 0.0005 })),
    tags,
  }
}

function raw(...ways: OverpassWay[]): OverpassData {
  return { osm3s: { timestamp_osm_base: '2026-01-01T00:00:00Z' }, elements: ways }
}

function curated(partial: Partial<CuratedData> = {}): CuratedData {
  return { junctions: {}, edgeTimes: {}, exclusions: [], pois: [], ...partial }
}

describe('buildGraph', () => {
  it('builds a single edge between two numbered way endpoints', () => {
    const data = raw(way(10, [101, 102, 103], { name: 'Red' }))
    const { graph, warnings } = buildGraph(
      data,
      curated({
        junctions: { '1': { osmNodeId: 101 }, '2': { osmNodeId: 103 } },
        edgeTimes: { '1-2': 3 },
      }),
    )
    expect(Object.keys(graph.edges)).toEqual(['1-2'])
    const edge = graph.edges['1-2']
    expect(edge.a).toBe(1)
    expect(edge.b).toBe(2)
    expect(edge.color).toBe('Red')
    expect(edge.minutes).toBe(3)
    expect(edge.coords).toHaveLength(3)
    expect(graph.adjacency['1']).toEqual(['1-2'])
    expect(graph.adjacency['2']).toEqual(['1-2'])
    expect(warnings).toEqual([])
  })

  it('splits a way at a mid-way node shared with another way', () => {
    // Way A runs 101-102-103; way B tees into 102. All tips + the tee are numbered.
    const data = raw(
      way(10, [101, 102, 103], { name: 'Red' }),
      way(11, [104, 102], { name: 'Yellow' }),
    )
    const { graph } = buildGraph(
      data,
      curated({
        junctions: {
          '1': { osmNodeId: 101 },
          '2': { osmNodeId: 102 },
          '3': { osmNodeId: 103 },
          '4': { osmNodeId: 104 },
        },
        edgeTimes: { '1-2': 1, '2-3': 1, '2-4': 1 },
      }),
    )
    expect(Object.keys(graph.edges).sort()).toEqual(['1-2', '2-3', '2-4'])
    expect(graph.adjacency['2'].sort()).toEqual(['1-2', '2-3', '2-4'])
  })

  it('warns about an unnumbered junction and builds no edge through it', () => {
    const data = raw(
      way(10, [101, 102, 103], { name: 'Red' }),
      way(11, [104, 102], { name: 'Yellow' }),
    )
    const { graph, warnings } = buildGraph(
      data,
      curated({ junctions: { '1': { osmNodeId: 101 }, '3': { osmNodeId: 103 } } }),
    )
    expect(Object.keys(graph.edges)).toEqual([])
    expect(warnings.some((w) => w.includes('unnumbered junction at OSM node 102'))).toBe(true)
  })

  it('merges chains across way boundaries through unnumbered degree-2 nodes', () => {
    // Two "Main" ways share endpoint 102; only the outer tips are numbered.
    const data = raw(
      way(10, [101, 102], { name: 'Main', operator: 'x' }),
      way(11, [102, 103, 104], { name: 'Main', operator: 'x' }),
    )
    const { graph, warnings } = buildGraph(
      data,
      curated({
        junctions: { '70': { osmNodeId: 101 }, '71': { osmNodeId: 104 } },
        edgeTimes: { '70-71': 5 },
      }),
    )
    expect(Object.keys(graph.edges)).toEqual(['70-71'])
    expect(graph.edges['70-71'].coords).toHaveLength(4)
    expect(warnings).toEqual([])
  })

  it('warns when the color changes mid-edge at an unnumbered node', () => {
    const data = raw(way(10, [101, 102], { name: 'Red' }), way(11, [102, 103], { name: 'Yellow' }))
    const { graph, warnings } = buildGraph(
      data,
      curated({
        junctions: { '1': { osmNodeId: 101 }, '2': { osmNodeId: 103 } },
        edgeTimes: { '1-2': 1 },
      }),
    )
    expect(Object.keys(graph.edges)).toEqual(['1-2'])
    expect(warnings.some((w) => w.includes('color changes mid-edge'))).toBe(true)
  })

  it('drops excluded ways', () => {
    const data = raw(way(10, [101, 102], { name: 'Red' }), way(11, [102, 103], { name: 'Red' }))
    const { graph } = buildGraph(
      data,
      curated({
        junctions: { '1': { osmNodeId: 101 }, '2': { osmNodeId: 102 } },
        exclusions: [{ id: 11, reason: 'informal' }],
        edgeTimes: { '1-2': 1 },
      }),
    )
    expect(Object.keys(graph.edges)).toEqual(['1-2'])
  })

  it('assigns suffix keys to parallel edges ordered by color then distance', () => {
    const data = raw(
      way(10, [101, 102], { name: 'Yellow' }),
      way(11, [101, 110, 111, 102], { name: 'Red' }),
    )
    const { graph } = buildGraph(
      data,
      curated({
        junctions: { '74': { osmNodeId: 101 }, '75': { osmNodeId: 102 } },
        edgeTimes: { '74-75': 2, '74-75b': 3 },
      }),
    )
    expect(Object.keys(graph.edges).sort()).toEqual(['74-75', '74-75b'])
    expect(graph.edges['74-75'].color).toBe('Red')
    expect(graph.edges['74-75b'].color).toBe('Yellow')
    expect(graph.edges['74-75'].minutes).toBe(2)
    expect(graph.edges['74-75b'].minutes).toBe(3)
    expect(graph.adjacency['74'].sort()).toEqual(['74-75', '74-75b'])
  })

  it('handles a loop edge back to the same junction', () => {
    const data = raw(way(10, [101, 102, 103, 101], { name: 'Orange' }))
    const { graph } = buildGraph(
      data,
      curated({ junctions: { '26': { osmNodeId: 101 } }, edgeTimes: { '26-26': 4 } }),
    )
    expect(Object.keys(graph.edges)).toEqual(['26-26'])
    expect(graph.adjacency['26']).toEqual(['26-26'])
  })

  it('uses description as color and name as trail name', () => {
    const data = raw(way(10, [101, 102], { name: "Monty's Way", description: 'Blue' }))
    const { graph } = buildGraph(
      data,
      curated({
        junctions: { '1': { osmNodeId: 101 }, '30': { osmNodeId: 102 } },
        edgeTimes: { '1-30': 1 },
      }),
    )
    expect(graph.edges['1-30'].color).toBe('Blue')
    expect(graph.edges['1-30'].name).toBe("Monty's Way")
  })

  it('orients coords from a to b regardless of walk direction', () => {
    const data = raw(way(10, [103, 102, 101], { name: 'Red' }))
    const { graph } = buildGraph(
      data,
      curated({
        junctions: { '5': { osmNodeId: 103 }, '4': { osmNodeId: 101 } },
        edgeTimes: { '4-5': 1 },
      }),
    )
    const edge = graph.edges['4-5']
    // coords must start at junction 4 (node 101) and end at junction 5 (node 103)
    expect(edge.coords[0][1]).toBeCloseTo(49.5 + 101 * 0.001, 10)
    expect(edge.coords[2][1]).toBeCloseTo(49.5 + 103 * 0.001, 10)
  })

  it('warns for missing walking times, unknown colors, and stale edge-time keys', () => {
    const data = raw(way(10, [101, 102], { name: 'Chartreuse' }))
    const { warnings } = buildGraph(
      data,
      curated({
        junctions: { '1': { osmNodeId: 101 }, '2': { osmNodeId: 102 } },
        edgeTimes: { '9-9': 2 },
      }),
    )
    expect(warnings.some((w) => w.includes('edge 1-2: no walking time'))).toBe(true)
    expect(warnings.some((w) => w.includes('no hex mapping for color "Chartreuse"'))).toBe(true)
    expect(warnings.some((w) => w.includes('edge time "9-9" does not match'))).toBe(true)
  })

  it('warns when a curated junction node id is missing from the raw data', () => {
    const data = raw(way(10, [101, 102], { name: 'Red' }))
    const { warnings } = buildGraph(data, curated({ junctions: { '1': { osmNodeId: 999 } } }))
    expect(warnings.some((w) => w.includes('OSM node 999 not found'))).toBe(true)
  })

  it('warns when the numbered graph is disconnected', () => {
    const data = raw(way(10, [101, 102], { name: 'Red' }), way(11, [201, 202], { name: 'Red' }))
    const { warnings } = buildGraph(
      data,
      curated({
        junctions: {
          '1': { osmNodeId: 101 },
          '2': { osmNodeId: 102 },
          '3': { osmNodeId: 201 },
          '4': { osmNodeId: 202 },
        },
        edgeTimes: { '1-2': 1, '3-4': 1 },
      }),
    )
    expect(warnings.some((w) => w.includes('disconnected'))).toBe(true)
  })

  it('warns on implausible pace', () => {
    // ~111m long edge claimed to take 60 minutes.
    const data = raw(way(10, [101, 102], { name: 'Red' }))
    const { warnings } = buildGraph(
      data,
      curated({
        junctions: { '1': { osmNodeId: 101 }, '2': { osmNodeId: 102 } },
        edgeTimes: { '1-2': 60 },
      }),
    )
    expect(warnings.some((w) => w.includes('pace') && w.includes('1-2'))).toBe(true)
  })
})

describe('haversineM', () => {
  it('measures ~111m per 0.001 degree of latitude', () => {
    const d = haversineM([-123.7, 49.5], [-123.7, 49.501])
    expect(d).toBeGreaterThan(110)
    expect(d).toBeLessThan(112)
  })
})
