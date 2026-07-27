import { useCallback, useState } from 'react'
import MapView from '@/components/MapView'
import LayerToggles from '@/components/LayerToggles'
import RoutePanel from '@/components/RoutePanel'
import ErrorBanner from '@/components/ErrorBanner'
import { graph } from '@/data/graph'
import { DEFAULT_VISIBILITY, type LayerVisibility } from '@/lib/map/layers'
import { edgeBounds } from '@/lib/map/config'
import { useRouteState } from '@/hooks/useRouteState'
import type { JunctionId } from '@/lib/graph/types'

export default function App() {
  const [visibility, setVisibility] = useState<LayerVisibility>(DEFAULT_VISIBILITY)
  const [urlErrorDismissed, setUrlErrorDismissed] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const routeState = useRouteState(graph)
  // Camera target for a route cold-loaded from a shared URL; captured once on mount.
  const [initialBounds] = useState(() => edgeBounds(graph, routeState.routeEdgeKeys))

  const handleJunctionClick = useCallback(
    (id: JunctionId) => {
      const ok = routeState.selectJunction(id)
      if (!ok) {
        setHint(
          `Intersection ${id} is not connected to ${routeState.lastJunction} — tap a highlighted junction.`,
        )
        setTimeout(() => setHint(null), 3000)
      }
    },
    [routeState],
  )

  return (
    <main className="relative h-full">
      <h1 className="sr-only">Hidden Groves Trails</h1>
      {routeState.urlError && !urlErrorDismissed && (
        <ErrorBanner message={routeState.urlError} onDismiss={() => setUrlErrorDismissed(true)} />
      )}
      {hint && (
        <div
          role="status"
          className="absolute top-2 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-slate-900/90 px-3 py-2 text-sm text-white shadow-md"
        >
          {hint}
        </div>
      )}
      <LayerToggles visibility={visibility} onChange={setVisibility} />
      <MapView
        graph={graph}
        routeEdgeKeys={routeState.routeEdgeKeys}
        candidateIds={routeState.candidates}
        visibility={visibility}
        initialBounds={initialBounds}
        onJunctionClick={handleJunctionClick}
      />
      <RoutePanel
        graph={graph}
        tokens={routeState.tokens}
        route={routeState.route}
        candidates={routeState.candidates}
        lastJunction={routeState.lastJunction}
        onSelect={routeState.selectJunction}
        onUndo={routeState.undo}
        onClear={routeState.clear}
      />
    </main>
  )
}
