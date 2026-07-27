import { useEffect, useRef, useState } from 'react'
import {
  GeolocateControl,
  Map as MaplibreMap,
  NavigationControl,
  type MapLayerMouseEvent,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { JunctionId, TrailGraph } from '@/lib/graph/types'
import { MAP_STYLE_URL, graphBounds, type Bounds } from '@/lib/map/config'
import {
  LAYERS,
  addAppLayers,
  applyLayerVisibility,
  applyRouteHighlight,
  type LayerVisibility,
} from '@/lib/map/layers'

interface MapViewProps {
  graph: TrailGraph
  routeEdgeKeys: string[]
  candidateIds: JunctionId[]
  visibility: LayerVisibility
  /** Camera target on first render (e.g. a route loaded from the URL). */
  initialBounds?: Bounds
  onJunctionClick?: (id: JunctionId) => void
}

export default function MapView({
  graph,
  routeEdgeKeys,
  candidateIds,
  visibility,
  initialBounds,
  onJunctionClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MaplibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const clickHandlerRef = useRef(onJunctionClick)
  useEffect(() => {
    clickHandlerRef.current = onJunctionClick
  }, [onJunctionClick])

  const initialBoundsRef = useRef(initialBounds)

  useEffect(() => {
    if (!containerRef.current) return
    const focusRoute = initialBoundsRef.current !== undefined
    const b = initialBoundsRef.current ?? graphBounds(graph)
    // Keep the focused route clear of the route panel (bottom sheet / left dock).
    const mobile = window.innerWidth < 768
    const padding = focusRoute
      ? mobile
        ? { top: 70, left: 40, right: 40, bottom: Math.round(window.innerHeight * 0.5) }
        : { top: 60, right: 60, bottom: 60, left: 420 }
      : 60
    const map = new MaplibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      bounds: [b.west, b.south, b.east, b.north],
      fitBoundsOptions: { padding },
      attributionControl: { compact: true },
    })
    mapRef.current = map
    // Exposed for e2e tests and debugging.
    ;(window as unknown as { __hgMap?: MaplibreMap }).__hgMap = map

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(
      new GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showAccuracyCircle: true,
      }),
      'top-right',
    )

    map.on('error', (e) => {
      console.error('[map]', e.error ?? e)
    })
    map.on('load', () => {
      addAppLayers(map, graph)
      setReady(true)
    })

    const handleJunctionClick = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'number') clickHandlerRef.current?.(id)
    }
    map.on('click', LAYERS.junctionHit, handleJunctionClick)
    map.on('mouseenter', LAYERS.junctionHit, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', LAYERS.junctionHit, () => {
      map.getCanvas().style.cursor = ''
    })

    return () => {
      mapRef.current = null
      setReady(false)
      map.remove()
    }
  }, [graph])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    applyRouteHighlight(map, { routeEdgeKeys, candidateIds })
  }, [ready, routeEdgeKeys, candidateIds])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    applyLayerVisibility(map, visibility)
  }, [ready, visibility])

  return <div ref={containerRef} className="h-full w-full" data-testid="map-container" />
}
