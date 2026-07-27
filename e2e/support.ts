import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

const emptyStyle = readFileSync(
  fileURLToPath(new URL('./fixtures/empty-style.json', import.meta.url)),
  'utf8',
)

/**
 * Serve a minimal style for the base map and block every other external
 * request, so e2e runs fully offline. App trail/junction layers are bundled
 * GeoJSON and keep working.
 */
export async function goOffline(page: Page): Promise<void> {
  // Playwright matches routes in reverse registration order: register the
  // catch-all abort first so the style fulfillment below wins for its URL.
  await page.route(
    (url) => url.origin !== 'http://localhost:4173',
    (route) => route.abort(),
  )
  await page.route('https://tiles.openfreemap.org/styles/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: emptyStyle }),
  )
}

export async function waitForMap(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const map = (window as { __hgMap?: { loaded(): boolean } }).__hgMap
    return map !== undefined && map.loaded()
  })
}
