import { test, expect } from '@playwright/test'
import { goOffline, waitForMap } from './support'

test('app loads and shows the title', async ({ page }) => {
  await goOffline(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Hidden Groves Trails' })).toBeAttached()
  await waitForMap(page)
})

test('@online real base map style loads with tiles', async ({ page }) => {
  await page.goto('/')
  await waitForMap(page)
  await page.waitForFunction(() => {
    const map = (window as { __hgMap?: { areTilesLoaded(): boolean } }).__hgMap
    return map !== undefined && map.areTilesLoaded()
  })
})
