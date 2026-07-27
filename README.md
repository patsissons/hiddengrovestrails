# Hidden Groves Trails

A stateless route planner for the [Hidden Groves](https://hiddengroves.ca/) trail network in
Sechelt, BC. Pick a starting intersection number from the official trail map, extend your route
number-by-number along connected trails, and share the whole route as a URL.

Trail geometry comes from OpenStreetMap (mapped by the Sechelt Groves Society); intersection
numbers and per-segment walking times are hand-curated from the official paper map.

## Using the app

- **Build a route**: tap any numbered intersection on the map to start, then extend the route by
  tapping a highlighted adjacent intersection (or picking from the "Continue from" list). Only
  directly-connected intersections can be added, so every route is walkable.
- **Follow the colors**: each leg names the marker color to follow on the ground (colored posts at
  every intersection), e.g. "follow Blue (Monty's Way)". Where two trails connect the same pair of
  intersections, each appears as its own "via" option.
- **Share**: the whole route lives in the URL (`?r=1.30.32.33`) — copy it with the Share button.
  A lowercase suffix picks a parallel trail (`70.71b` = take the Rock Loop instead of Main).
- **Layers**: the Trails, Junctions, and Route overlays can each be toggled on/off; the Route
  overlay highlights your chosen path over the dimmed network.
- **Location**: the target button (top right) shows your live GPS position on the trail map.

## Setup

```sh
pnpm install
pnpm exec playwright install chromium   # once, for e2e tests
pnpm dev
```

## Scripts

| Script                     | What it does                                                            |
| -------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                 | Run the app locally with Vite                                           |
| `pnpm build`               | Type-check and build the production bundle                              |
| `pnpm preview`             | Serve the production build locally                                      |
| `pnpm test`                | Run unit tests (Vitest)                                                 |
| `pnpm test:e2e`            | Run Playwright e2e tests                                                |
| `pnpm validate:quick`      | Format check + type check + lint + unit tests                           |
| `pnpm validate`            | `validate:quick` + e2e tests (CI)                                       |
| `pnpm format-and-validate` | Prettier write, then full `validate`                                    |
| `pnpm data:fetch`          | Refresh the raw OpenStreetMap snapshot (`data/raw/overpass.json`)       |
| `pnpm data:build`          | Rebuild the trail graph (`src/data/graph.json`) from raw + curated data |

## Deployment

Pushes to `main` run `pnpm validate` (format, types, lint, unit, e2e) and then deploy `dist/` to
Cloudflare Pages via GitHub Actions. One-time setup:

1. Create a Cloudflare Pages project named `hiddengrovestrails` (Workers & Pages → Create →
   Pages → Direct upload).
2. Add two GitHub Actions secrets: `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN` (a token
   with the "Cloudflare Pages — Edit" permission).
