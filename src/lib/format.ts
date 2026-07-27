export function formatDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`
}

/** "Blue (Monty's Way)" — the marker color hikers follow, plus the trail name. */
export function describeEdge(color: string, name?: string): string {
  return name ? `${color} (${name})` : color
}
