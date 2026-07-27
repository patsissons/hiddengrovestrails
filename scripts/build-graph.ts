// Rebuilds src/data/graph.json from the committed raw snapshot + curated files.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { buildGraph } from '../src/lib/graph/build'
import type { CuratedData, OverpassData } from '../src/lib/graph/types'

const root = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url))

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(root(path), 'utf8')) as T
}

const raw = await readJson<OverpassData>('data/raw/overpass.json')
const curated: CuratedData = {
  junctions: await readJson('data/curated/junctions.json'),
  edgeTimes: await readJson('data/curated/edge-times.json'),
  exclusions: await readJson('data/curated/exclusions.json'),
  pois: await readJson('data/curated/pois.json'),
}

const { graph, warnings } = buildGraph(raw, curated)

const junctionCount = Object.keys(graph.junctions).length
const edgeCount = Object.keys(graph.edges).length
console.log(`graph: ${junctionCount} junctions, ${edgeCount} edges, ${graph.pois.length} POIs`)

if (warnings.length > 0) {
  console.warn(`\n${warnings.length} warnings:`)
  for (const w of warnings) console.warn(`  - ${w}`)
}

await mkdir(root('src/data'), { recursive: true })
await writeFile(root('src/data/graph.json'), JSON.stringify(graph, null, 1) + '\n')
console.log('\nwrote src/data/graph.json')

if (process.argv.includes('--strict') && warnings.length > 0) {
  console.error('\n--strict: failing due to warnings')
  process.exit(1)
}
