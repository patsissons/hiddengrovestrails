// Renders a shared route as a social-preview image: the chosen path drawn in
// its trail colors over the dimmed network, with start/end markers. Pure
// pixel-pushing (no canvas) so it runs inside a Cloudflare Pages Function.
import type { TrailGraph } from '../graph/types'
import type { Route } from '../route/validate'
import { encodePng } from './png'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

const BG = hexToRgb('#eef2e9')
const NETWORK = hexToRgb('#c3cabe')
const CASING = hexToRgb('#1a1a2e')
const START = hexToRgb('#2e7d32')
const END = hexToRgb('#d92b21')
const WHITE = hexToRgb('#ffffff')

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

interface Frame {
  raster: Uint8Array
  width: number
  height: number
  project: (lng: number, lat: number) => [number, number]
}

const brushCache = new Map<number, [number, number][]>()

function brush(radius: number): [number, number][] {
  let offsets = brushCache.get(radius)
  if (!offsets) {
    offsets = []
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) offsets.push([dx, dy])
      }
    }
    brushCache.set(radius, offsets)
  }
  return offsets
}

function stamp(frame: Frame, x: number, y: number, radius: number, [r, g, b]: Rgb): void {
  for (const [dx, dy] of brush(radius)) {
    const px = Math.round(x) + dx
    const py = Math.round(y) + dy
    if (px < 0 || py < 0 || px >= frame.width || py >= frame.height) continue
    const i = (py * frame.width + px) * 4
    frame.raster[i] = r
    frame.raster[i + 1] = g
    frame.raster[i + 2] = b
    frame.raster[i + 3] = 255
  }
}

function drawPolyline(frame: Frame, coords: [number, number][], radius: number, color: Rgb): void {
  for (let i = 1; i < coords.length; i++) {
    const [x0, y0] = frame.project(coords[i - 1][0], coords[i - 1][1])
    const [x1, y1] = frame.project(coords[i][0], coords[i][1])
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)))
    for (let s = 0; s <= steps; s++) {
      stamp(frame, x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps, radius, color)
    }
  }
}

export async function renderRouteOg(graph: TrailGraph, route: Route): Promise<Uint8Array> {
  const width = OG_WIDTH
  const height = OG_HEIGHT
  const raster = new Uint8Array(width * height * 4)
  for (let i = 0; i < raster.length; i += 4) {
    raster[i] = BG[0]
    raster[i + 1] = BG[1]
    raster[i + 2] = BG[2]
    raster[i + 3] = 255
  }

  // Fit the route bounds (with margin); the rest of the network gives context.
  const routeCoords = route.steps.flatMap((s) => s.edge.coords)
  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const [lng, lat] of routeCoords) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  const latScale = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
  const spanX = Math.max((maxLng - minLng) * latScale, 1e-5)
  const spanY = Math.max(maxLat - minLat, 1e-5)
  const margin = 60
  const scale = Math.min((width - 2 * margin) / spanX, (height - 2 * margin) / spanY)
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2
  const project = (lng: number, lat: number): [number, number] => [
    offsetX + (lng - minLng) * latScale * scale,
    height - offsetY - (lat - minLat) * scale,
  ]

  const frame: Frame = { raster, width, height, project }

  for (const trail of graph.trails) drawPolyline(frame, trail.coords, 2, NETWORK)

  for (const step of route.steps) drawPolyline(frame, step.edge.coords, 7, CASING)
  for (const step of route.steps) {
    drawPolyline(frame, step.edge.coords, 4, hexToRgb(step.edge.colorHex))
  }

  const start = graph.junctions[String(route.start)]
  const last = route.steps[route.steps.length - 1]
  const end = graph.junctions[String(last.to)]
  for (const [junction, color] of [
    [start, START],
    [end, END],
  ] as const) {
    if (!junction) continue
    const [x, y] = project(junction.lng, junction.lat)
    stamp(frame, x, y, 13, CASING)
    stamp(frame, x, y, 11, WHITE)
    stamp(frame, x, y, 7, color)
  }

  return encodePng(width, height, raster)
}
