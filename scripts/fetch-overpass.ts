// Refreshes the committed OpenStreetMap snapshot (data/raw/overpass.json).
// Builds and CI never call Overpass — run manually via `pnpm data:fetch`.
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

// All hiking paths in the Hidden Groves / Sechelt Heritage Forest area,
// with per-way node ids and geometry (`out geom`).
const QUERY = `[out:json][timeout:90];
way["highway"~"path|footway"](49.515,-123.78,49.55,-123.72);
out geom;`

const OUT_PATH = fileURLToPath(new URL('../data/raw/overpass.json', import.meta.url))

interface OverpassResponse {
  version: number
  osm3s?: { timestamp_osm_base?: string }
  elements: unknown[]
}

async function fetchFromMirror(mirror: string): Promise<OverpassResponse> {
  const res = await fetch(mirror, {
    method: 'POST',
    body: new URLSearchParams({ data: QUERY }),
  })
  if (!res.ok) throw new Error(`${mirror}: HTTP ${res.status}`)
  const json = (await res.json()) as OverpassResponse
  if (!Array.isArray(json.elements) || json.elements.length === 0) {
    throw new Error(`${mirror}: response has no elements`)
  }
  return json
}

async function main() {
  let lastError: unknown
  for (const mirror of MIRRORS) {
    try {
      console.log(`Fetching from ${mirror}…`)
      const data = await fetchFromMirror(mirror)
      await writeFile(OUT_PATH, JSON.stringify(data, null, 1) + '\n')
      console.log(
        `Wrote ${OUT_PATH} (${data.elements.length} ways, OSM data date ${data.osm3s?.timestamp_osm_base ?? 'unknown'})`,
      )
      return
    } catch (error) {
      lastError = error
      console.warn(String(error))
    }
  }
  throw new Error(`All Overpass mirrors failed; last error: ${String(lastError)}`)
}

await main()
