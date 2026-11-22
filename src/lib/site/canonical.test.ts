import { describe, expect, it } from 'vitest'
import { CANONICAL_ORIGIN, canonicalRedirect } from './canonical'

describe('canonicalRedirect', () => {
  it('redirects the production pages.dev host to the canonical origin', () => {
    expect(canonicalRedirect('https://hiddengrovestrails.pages.dev/')).toBe(`${CANONICAL_ORIGIN}/`)
  })

  it('keeps the path and the shared route query', () => {
    expect(canonicalRedirect('https://hiddengrovestrails.pages.dev/api/og?r=1.30.32')).toBe(
      `${CANONICAL_ORIGIN}/api/og?r=1.30.32`,
    )
  })

  it('serves preview deployments on their own hosts', () => {
    expect(canonicalRedirect('https://abc123.hiddengrovestrails.pages.dev/?r=1.30')).toBeNull()
    expect(canonicalRedirect('https://my-branch.hiddengrovestrails.pages.dev/')).toBeNull()
  })

  it('serves the canonical origin and local dev as-is', () => {
    expect(canonicalRedirect(`${CANONICAL_ORIGIN}/?r=1.30`)).toBeNull()
    expect(canonicalRedirect('http://localhost:8788/?r=1.30')).toBeNull()
  })
})
