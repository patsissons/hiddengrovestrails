import type { Edge, TrailGraph } from '@/lib/graph/types'

function edge(partial: Pick<Edge, 'key' | 'a' | 'b'> & Partial<Edge>): Edge {
  return {
    color: 'Red',
    colorHex: '#d92b21',
    minutes: 1,
    distanceM: 100,
    coords: [
      [-123.75, 49.52],
      [-123.751, 49.521],
    ],
    ...partial,
  }
}

/**
 * 1 --- 2 === 3 --- 4     (2-3 has parallel edges: default Red, alt "b" Yellow)
 *        \---------/      (2-4 direct)
 */
export const tinyGraph: TrailGraph = {
  junctions: {
    '1': { id: 1, osmNodeId: 11, lng: -123.75, lat: 49.52 },
    '2': { id: 2, osmNodeId: 12, lng: -123.751, lat: 49.521 },
    '3': { id: 3, osmNodeId: 13, lng: -123.752, lat: 49.522 },
    '4': { id: 4, osmNodeId: 14, lng: -123.753, lat: 49.523 },
  },
  edges: {
    '1-2': edge({ key: '1-2', a: 1, b: 2, minutes: 3 }),
    '2-3': edge({ key: '2-3', a: 2, b: 3, minutes: 2 }),
    '2-3b': edge({ key: '2-3b', a: 2, b: 3, color: 'Yellow', colorHex: '#eec927', minutes: 5 }),
    '3-4': edge({ key: '3-4', a: 3, b: 4, minutes: 4 }),
    '2-4': edge({ key: '2-4', a: 2, b: 4, minutes: 8 }),
  },
  adjacency: {
    '1': ['1-2'],
    '2': ['1-2', '2-3', '2-3b', '2-4'],
    '3': ['2-3', '2-3b', '3-4'],
    '4': ['2-4', '3-4'],
  },
  trails: [],
  pois: [],
  meta: { generatedAt: '2026-01-01T00:00:00Z', osmDataDate: '2026-01-01T00:00:00Z' },
}
