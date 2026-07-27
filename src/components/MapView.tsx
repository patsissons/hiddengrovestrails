import { useEffect, useRef, useState } from 'react'
import {
  GeolocateControl,
  Map as MaplibreMap,
  NavigationControl,
  type MapLayerMouseEvent,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { JunctionId, TrailGraph } from '@/lib/graph/types'
import { MAP_STYLE_URL, graphBounds } from '@/lib/map/config'
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
  onJunctionClick?: (id: JunctionId) => void
}

export default function MapView({
  graph,
  routeEdgeKeys,
  candidateIds,
  visibility,
  onJunctionClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MaplibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const clickHandlerRef = useRef(onJunctionClick)
  useEffect(() => {
    clickHandlerRef.current = onJunctionClick
  }, [onJunctionClick])

  useEffect(() => {
    if (!containerRef.current) return
    const b = graphBounds(graph)
    const map = new MaplibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      bounds: [b.west, b.south, b.east, b.north],
      fitBoundsOptions: { padding: 40 },
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(
      new GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showAccuracyCircle: true,
      }),
      'top-right',
    )

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
