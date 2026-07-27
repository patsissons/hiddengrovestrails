import { describe, it, expect } from 'vitest'
import { encodeRoute, parseRouteParam } from './codec'

describe('parseRouteParam', () => {
  it('parses plain and suffixed tokens', () => {
    const result = parseRouteParam('1.30.32b.33')
    expect(result).toEqual({
      ok: true,
      tokens: [{ junction: 1 }, { junction: 30 }, { junction: 32, alt: 'b' }, { junction: 33 }],
    })
  })

  it('rejects garbage tokens', () => {
    for (const bad of ['1..2', 'abc', '1.-2', '1.2B', '01.2', '1.2.3x9', '']) {
      const result = parseRouteParam(bad)
      expect(result.ok, `"${bad}" should fail`).toBe(false)
    }
  })

  it('round-trips through encodeRoute', () => {
    const param = '74.75b.80'
    const parsed = parseRouteParam(param)
    if (!parsed.ok) throw new Error('expected ok')
    expect(encodeRoute(parsed.tokens)).toBe(param)
  })
})
