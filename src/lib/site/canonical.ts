/** The production origin; the Pages project's custom domain. */
export const CANONICAL_ORIGIN = 'https://hiddengrovestrails.lgtm.page'

/** The Pages project's own production host, redirected to the canonical origin. */
const PAGES_HOST = 'hiddengrovestrails.pages.dev'

/**
 * The canonical URL to redirect `href` to, or null to serve it as-is. Only the exact
 * production pages.dev host redirects: preview deployments (`<hash>.hiddengrovestrails.pages.dev`,
 * `<branch>.hiddengrovestrails.pages.dev`) and local dev keep working on their own hosts.
 */
export function canonicalRedirect(href: string): string | null {
  const url = new URL(href)
  if (url.hostname !== PAGES_HOST) return null
  return `${CANONICAL_ORIGIN}${url.pathname}${url.search}`
}
