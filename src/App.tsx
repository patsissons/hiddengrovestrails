import { useState } from 'react'
import MapView from '@/components/MapView'
import LayerToggles from '@/components/LayerToggles'
import { graph } from '@/data/graph'
import { DEFAULT_VISIBILITY, type LayerVisibility } from '@/lib/map/layers'

export default function App() {
  const [visibility, setVisibility] = useState<LayerVisibility>(DEFAULT_VISIBILITY)

  return (
    <main className="relative h-full">
      <h1 className="sr-only">Hidden Groves Trails</h1>
      <LayerToggles visibility={visibility} onChange={setVisibility} />
      <MapView graph={graph} routeEdgeKeys={[]} candidateIds={[]} visibility={visibility} />
    </main>
  )
}
