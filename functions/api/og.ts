// Dynamic OpenGraph image for shared routes: /api/og?r=1.30.32.33
// Renders the route over the dimmed trail network as a PNG. Results are
// immutable per route param, so they cache at the edge.
import graphJson from '../../src/data/graph.json'
import type { TrailGraph } from '../../src/lib/graph/types'
import { parseRouteParam } from '../../src/lib/route/codec'
import { resolveRoute } from '../../src/lib/route/validate'
import { renderRouteOg } from '../../src/lib/og/render'

const graph = graphJson as unknown as TrailGraph

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  const fallback = () => Response.redirect(`${url.origin}/og-image.png`, 302)

  const param = url.searchParams.get('r')
  if (param === null) return fallback()
  const parsed = parseRouteParam(param)
  if (!parsed.ok) return fallback()
  const resolved = resolveRoute(graph, parsed.tokens)
  if (!resolved.ok || resolved.route.steps.length === 0) return fallback()

  const cache = caches.default
  const cacheKey = new Request(url.toString())
  const cached = await cache.match(cacheKey)
  if (cached) return cached

  const png = await renderRouteOg(graph, resolved.route)
  const response = new Response(png as unknown as BodyInit, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
  context.waitUntil(cache.put(cacheKey, response.clone()))
  return response
}
