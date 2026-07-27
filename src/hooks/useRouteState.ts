import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { JunctionId, TrailGraph } from '@/lib/graph/types'
import { encodeRoute, parseRouteParam, type RouteToken } from '@/lib/route/codec'
import {
  adjacentJunctions,
  describeRouteError,
  edgesBetween,
  resolveRoute,
  type Route,
} from '@/lib/route/validate'

export interface RouteState {
  tokens: RouteToken[]
  /** Set when the URL contained a route that failed validation. */
  urlError: string | null
}

type RouteAction =
  | { type: 'start'; junction: JunctionId }
  | { type: 'extend'; junction: JunctionId; alt?: string }
  | { type: 'undo' }
  | { type: 'clear' }
  | { type: 'load'; tokens: RouteToken[]; error?: string }

function reducer(state: RouteState, action: RouteAction): RouteState {
  switch (action.type) {
    case 'start':
      return { tokens: [{ junction: action.junction }], urlError: null }
    case 'extend':
      return {
        tokens: [
          ...state.tokens,
          { junction: action.junction, ...(action.alt ? { alt: action.alt } : {}) },
        ],
        urlError: null,
      }
    case 'undo':
      return { tokens: state.tokens.slice(0, -1), urlError: null }
    case 'clear':
      return { tokens: [], urlError: null }
    case 'load':
      return { tokens: action.tokens, urlError: action.error ?? null }
  }
}

function readUrl(graph: TrailGraph): RouteState {
  const param = new URLSearchParams(window.location.search).get('r')
  if (!param) return { tokens: [], urlError: null }
  const parsed = parseRouteParam(param)
  if (!parsed.ok) {
    return { tokens: [], urlError: `"${parsed.error.token}" is not a valid route stop.` }
  }
  const resolved = resolveRoute(graph, parsed.tokens)
  if (!resolved.ok) {
    return { tokens: [], urlError: describeRouteError(resolved.error) }
  }
  return { tokens: parsed.tokens, urlError: null }
}

function writeUrl(tokens: RouteToken[]): void {
  const url = new URL(window.location.href)
  if (tokens.length === 0) url.searchParams.delete('r')
  else url.searchParams.set('r', encodeRoute(tokens))
  window.history.replaceState(null, '', url)
}

export function useRouteState(graph: TrailGraph) {
  const [state, dispatch] = useReducer(reducer, graph, readUrl)

  useEffect(() => {
    writeUrl(state.tokens)
  }, [state.tokens])

  useEffect(() => {
    const onPopState = () => {
      const next = readUrl(graph)
      dispatch({
        type: 'load',
        tokens: next.tokens,
        ...(next.urlError ? { error: next.urlError } : {}),
      })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [graph])

  const route: Route | null = useMemo(() => {
    if (state.tokens.length === 0) return null
    const resolved = resolveRoute(graph, state.tokens)
    return resolved.ok ? resolved.route : null
  }, [graph, state.tokens])

  const lastJunction: JunctionId | null =
    state.tokens.length > 0 ? state.tokens[state.tokens.length - 1].junction : null

  const candidates: JunctionId[] = useMemo(
    () => (lastJunction === null ? [] : adjacentJunctions(graph, lastJunction)),
    [graph, lastJunction],
  )

  const routeEdgeKeys = useMemo(() => (route ? route.steps.map((s) => s.edge.key) : []), [route])

  const selectJunction = useCallback(
    (junction: JunctionId, alt?: string) => {
      if (lastJunction === null) {
        dispatch({ type: 'start', junction })
        return true
      }
      if (edgesBetween(graph, lastJunction, junction).length === 0) return false
      dispatch({ type: 'extend', junction, ...(alt ? { alt } : {}) })
      return true
    },
    [graph, lastJunction],
  )

  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const clear = useCallback(() => dispatch({ type: 'clear' }), [])

  return {
    tokens: state.tokens,
    urlError: state.urlError,
    route,
    lastJunction,
    candidates,
    routeEdgeKeys,
    selectJunction,
    undo,
    clear,
  }
}
