// Cloudflare Pages Function: rewrites the page title and description/OpenGraph
// tags server-side for shared route URLs (?r=…), so link-preview crawlers that
// never run JavaScript still unfurl route duration, distance, and legs.
import graphJson from '../src/data/graph.json'
import type { TrailGraph } from '../src/lib/graph/types'
import { buildRouteMeta } from '../src/lib/route/summary'

const graph = graphJson as unknown as TrailGraph

const setContent = (content: string) => ({
  element(el: Element) {
    el.setAttribute('content', content)
  },
})

export const onRequestGet: PagesFunction = async (context) => {
  const response = await context.next()
  const url = new URL(context.request.url)
  const param = url.searchParams.get('r')
  const contentType = response.headers.get('content-type') ?? ''
  if (param === null || !contentType.includes('text/html')) return response

  const meta = buildRouteMeta(graph, param)
  if (meta === null) return response

  return new HTMLRewriter()
    .on('title', {
      element(el) {
        el.setInnerContent(meta.title)
      },
    })
    .on('meta[name="description"]', setContent(meta.description))
    .on('meta[property="og:title"]', setContent(meta.title))
    .on('meta[property="og:description"]', setContent(meta.description))
    .on('meta[property="og:url"]', setContent(url.href))
    .on(
      'meta[property="og:image"]',
      setContent(`${url.origin}/api/og?r=${encodeURIComponent(param)}`),
    )
    .transform(response)
}
