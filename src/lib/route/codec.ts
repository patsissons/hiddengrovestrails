// A route URL is `?r=1.30.32b.33` — dot-separated intersection numbers, where a
// lowercase suffix on a token picks a parallel-edge alternative for the step
// ARRIVING at that junction (e.g. "75b" = reach 75 via the second edge).

export interface RouteToken {
  junction: number
  /** Parallel-edge suffix ("b", "c", …); undefined = the default edge. */
  alt?: string
}

export type CodecError = { kind: 'bad-token'; token: string; index: number }

const TOKEN_RE = /^([1-9]\d*)([a-z])?$/

export function parseRouteParam(
  param: string,
): { ok: true; tokens: RouteToken[] } | { ok: false; error: CodecError } {
  const parts = param.split('.')
  const tokens: RouteToken[] = []
  for (const [index, part] of parts.entries()) {
    const match = TOKEN_RE.exec(part)
    if (!match) return { ok: false, error: { kind: 'bad-token', token: part, index } }
    tokens.push({ junction: Number(match[1]), ...(match[2] ? { alt: match[2] } : {}) })
  }
  return { ok: true, tokens }
}

export function encodeRoute(tokens: RouteToken[]): string {
  return tokens.map((t) => `${t.junction}${t.alt ?? ''}`).join('.')
}
