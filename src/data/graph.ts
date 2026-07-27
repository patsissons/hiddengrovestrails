import type { TrailGraph } from '../lib/graph/types'
import rawGraph from './graph.json'

export const graph = rawGraph as unknown as TrailGraph
