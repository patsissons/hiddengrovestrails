// Paper-map color label -> render hex. Labels come from OSM way names/descriptions
// ("Red", "Light Blue") or trail names where the way has no color word ("Main").
// Hexes are tuned by eye against docs/paper-map.jpg via the dev curation page.
const COLOR_HEX: Record<string, string> = {
  red: '#d92b21',
  yellow: '#eec927',
  blue: '#1d6fd0',
  'light blue': '#8fc3e8',
  teal: '#2f7f8a',
  green: '#3ecf3e',
  'dark green': '#1d5e2a',
  'light green': '#b3c98c',
  purple: '#c437c9',
  violet: '#c5a0e8',
  pink: '#f2a0b5',
  orange: '#f08019',
  black: '#1f1f1f',
  brown: '#8b1a2b',
  'light brown': '#b08d3e',
  'dark yellow': '#a89b2e',
  cyan: '#35d0e0',
  gray: '#7a7a7a',
}

export const UNKNOWN_COLOR_HEX = '#888888'

export function colorHexFor(color: string): { hex: string; known: boolean } {
  const hex = COLOR_HEX[color.trim().toLowerCase()]
  return hex ? { hex, known: true } : { hex: UNKNOWN_COLOR_HEX, known: false }
}
