import { useEffect } from 'react'
import type { TrailGraph } from '@/lib/graph/types'
import type { RouteToken } from '@/lib/route/codec'
import { encodeRoute } from '@/lib/route/codec'
import { DEFAULT_META, buildRouteMeta } from '@/lib/route/summary'

function setMeta(selector: string, content: string): void {
  document.querySelector(selector)?.setAttribute('content', content)
}

/**
 * Keeps the document title and description/OpenGraph tags in sync with the
 * current route, so shared tabs and JS-rendering crawlers see route stats.
 * (Non-JS crawlers get the same treatment server-side via functions/index.ts.)
 */
export function useRouteMeta(graph: TrailGraph, tokens: RouteToken[]): void {
  useEffect(() => {
    const meta =
      (tokens.length > 0 ? buildRouteMeta(graph, encodeRoute(tokens)) : null) ?? DEFAULT_META
    document.title = meta.title
    setMeta('meta[name="description"]', meta.description)
    setMeta('meta[property="og:title"]', meta.title)
    setMeta('meta[property="og:description"]', meta.description)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', window.location.href)
  }, [graph, tokens])
}
