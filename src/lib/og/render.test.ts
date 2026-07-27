import { describe, it, expect } from 'vitest'
import { graph } from '@/data/graph'
import { parseRouteParam } from '@/lib/route/codec'
import { resolveRoute } from '@/lib/route/validate'
import { OG_HEIGHT, OG_WIDTH, renderRouteOg } from './render'
import { encodePng } from './png'

function pngDimensions(png: Uint8Array): { width: number; height: number } {
  const view = new DataView(png.buffer, png.byteOffset)
  // signature (8) + IHDR length/type (8) → width/height at offsets 16/20
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

describe('encodePng', () => {
  it('produces a well-formed PNG header', async () => {
    const png = await encodePng(2, 2, new Uint8Array(16).fill(255))
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(pngDimensions(png)).toEqual({ width: 2, height: 2 })
    expect(String.fromCharCode(...png.subarray(png.length - 8, png.length - 4))).toBe('IEND')
  })
})

describe('renderRouteOg', () => {
  it('renders a real route to a 1200x630 PNG', async () => {
    const parsed = parseRouteParam('1.30.32.33.34.50')
    if (!parsed.ok) throw new Error('bad param')
    const resolved = resolveRoute(graph, parsed.tokens)
    if (!resolved.ok) throw new Error('bad route')

    const png = await renderRouteOg(graph, resolved.route)
    expect(pngDimensions(png)).toEqual({ width: OG_WIDTH, height: OG_HEIGHT })
    // A rendered route compresses far larger than a blank background would.
    expect(png.length).toBeGreaterThan(10_000)
  })
})
