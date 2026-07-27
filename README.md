# Hidden Groves Trails

A stateless route planner for the [Hidden Groves](https://hiddengroves.ca/) trail network in
Sechelt, BC. Pick a starting intersection number from the official trail map, extend your route
number-by-number along connected trails, and share the whole route as a URL.

Trail geometry comes from OpenStreetMap (mapped by the Sechelt Groves Society); intersection
numbers and per-segment walking times are hand-curated from the official paper map.

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
