import { test, expect } from '@playwright/test'

// Link previews (and the lgtm.page card) read these absolute tags from the served HTML.
test('Open Graph tags point at the lgtm.page domain', async ({ request }) => {
  const html = await (await request.get('/')).text()
  const content = (selector: RegExp) => html.match(selector)?.[1]
  expect(content(/property="og:url"\s+content="([^"]+)"/)).toBe(
    'https://hiddengrovestrails.lgtm.page/',
  )
  expect(content(/property="og:image"\s+content="([^"]+)"/)).toBe(
    'https://hiddengrovestrails.lgtm.page/og-image.png',
  )
  expect(content(/name="twitter:image"\s+content="([^"]+)"/)).toBe(
    'https://hiddengrovestrails.lgtm.page/og-image.png',
  )
  expect(content(/name="theme-color"\s+content="([^"]+)"/)).toBeTruthy()
  expect(html).toMatch(/property="og:image:alt"/)
})
