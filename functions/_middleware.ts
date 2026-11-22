// Cloudflare Pages middleware: sends the production pages.dev host to the custom domain
// (hiddengrovestrails.lgtm.page) so shared links have one canonical URL. Preview deployments
// are left on their own hosts.
import { canonicalRedirect } from '../src/lib/site/canonical'

export const onRequest: PagesFunction = async (context) => {
  const location = canonicalRedirect(context.request.url)
  if (location === null) return context.next()
  return Response.redirect(location, 301)
}
