import { test, expect } from '@playwright/test'
import { goOffline, waitForMap } from './support'

test.beforeEach(async ({ page }) => {
  await goOffline(page)
})

test('builds a route from the candidate list and updates the URL', async ({ page }) => {
  await page.goto('/?r=1')
  await waitForMap(page)

  const candidates = page.getByTestId('candidate-list')
  await expect(candidates).toContainText('Continue from 1')

  // 1 -> 30 via Blue (Monty's Way)
  await candidates.getByRole('button').filter({ hasText: 'via Blue' }).first().click()
  await expect(page).toHaveURL(/\?r=1\.30$/)
  await expect(page.getByTestId('route-sequence')).toContainText('130')

  // 30 -> 10 via Dark Yellow
  await candidates.getByRole('button').filter({ hasText: 'via Dark Yellow' }).click()
  await expect(page).toHaveURL(/\?r=1\.30\.10$/)

  const stats = page.getByTestId('stats-summary')
  await expect(stats).toContainText('~5 min')
  await expect(stats).toContainText('2 legs')

  const steps = page.getByTestId('step-list')
  await expect(steps).toContainText("follow Blue (Monty's Way)")
  await expect(steps).toContainText('follow Dark Yellow')
})

test('undo removes the last stop and clear resets', async ({ page }) => {
  await page.goto('/?r=1.30.32')
  await waitForMap(page)

  await page.getByRole('button', { name: /remove last stop/i }).click()
  await expect(page).toHaveURL(/\?r=1\.30$/)

  await page.getByRole('button', { name: /clear route/i }).click()
  await expect(page).not.toHaveURL(/r=/)
  await expect(page.getByText(/tap any numbered intersection/i)).toBeVisible()
})

test('cold-loads a shared route URL with stats and steps', async ({ page }) => {
  await page.goto('/?r=1.30.32.33.34.50')
  await waitForMap(page)

  const stats = page.getByTestId('stats-summary')
  await expect(stats).toContainText('~9 min')
  await expect(stats).toContainText('5 legs')
  await expect(page.getByTestId('step-list')).toContainText('follow Brown')
})

test('resolves parallel-edge suffix routes (Rock Loop vs Main)', async ({ page }) => {
  await page.goto('/?r=70.71b')
  await waitForMap(page)
  await expect(page.getByTestId('step-list')).toContainText('follow Black (Rock Loop)')
  await expect(page.getByTestId('stats-summary')).toContainText('~12 min')

  await page.goto('/?r=70.71')
  await expect(page.getByTestId('step-list')).toContainText('follow Light Blue (Main)')
  await expect(page.getByTestId('stats-summary')).toContainText('~3 min')
})

test('shows specific errors for invalid route URLs', async ({ page }) => {
  await page.goto('/?r=1.99')
  await expect(page.getByTestId('error-banner')).toContainText(
    'Intersection 99 does not exist on the trail map.',
  )

  await page.goto('/?r=1.7')
  await expect(page.getByTestId('error-banner')).toContainText(
    'Intersections 1 and 7 are not directly connected by a trail.',
  )

  await page.goto('/?r=1.x7')
  await expect(page.getByTestId('error-banner')).toContainText('not a valid route stop')

  // dismissable
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByTestId('error-banner')).toHaveCount(0)
})

test('selects junctions by tapping the map', async ({ page }) => {
  await page.goto('/')
  await waitForMap(page)
  // zoom to the kiosk area so junction 1 is comfortably tappable
  await page.evaluate(() => {
    ;(
      window as unknown as {
        __hgMap: { jumpTo(o: { center: [number, number]; zoom: number }): void }
      }
    ).__hgMap.jumpTo({ center: [-123.7553, 49.5263], zoom: 17 })
  })
  await page.waitForTimeout(300)
  const point = await page.evaluate(() => {
    const map = (
      window as unknown as {
        __hgMap: {
          querySourceFeatures(s: string): {
            properties: { id: number }
            geometry: { coordinates: [number, number] }
          }[]
          project(c: [number, number]): { x: number; y: number }
        }
      }
    ).__hgMap
    const feature = map.querySourceFeatures('hg-junctions').find((f) => f.properties.id === 1)!
    return map.project(feature.geometry.coordinates)
  })
  await page.mouse.click(point.x, point.y)
  await expect(page).toHaveURL(/\?r=1$/)
  await expect(page.getByTestId('candidate-list')).toContainText('Continue from 1')
})

test('share button copies the route URL', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are chromium-only')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/?r=1.30.32')
  await waitForMap(page)
  await page.getByRole('button', { name: /share/i }).click()
  await expect(page.getByRole('button', { name: /copied/i })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('?r=1.30.32')
})

test('shows the user location after geolocating', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 49.5263, longitude: -123.7553 })
  await page.goto('/')
  await waitForMap(page)
  await page.locator('.maplibregl-ctrl-geolocate').click()
  await expect(page.locator('.maplibregl-user-location-dot')).toBeVisible()
})

test('layer toggles hide and show overlay groups', async ({ page }) => {
  await page.goto('/?r=1.30')
  await waitForMap(page)
  const layoutVisibility = (layer: string) =>
    page.evaluate(
      (l) =>
        (
          window as unknown as {
            __hgMap: { getLayoutProperty(l: string, p: string): string }
          }
        ).__hgMap.getLayoutProperty(l, 'visibility'),
      layer,
    )
  await page.getByRole('button', { name: 'Route', exact: true }).click()
  expect(await layoutVisibility('hg-route-line')).toBe('none')
  await page.getByRole('button', { name: 'POIs', exact: true }).click()
  expect(await layoutVisibility('hg-poi')).toBe('none')
  await page.getByRole('button', { name: 'POIs', exact: true }).click()
  expect(await layoutVisibility('hg-poi')).toBe('visible')
})
