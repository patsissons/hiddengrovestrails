# Agent Working Rules

After making changes from a prompt and BEFORE committing:

1. Author new tests covering the changes being made.
2. Update any documentation affected by the changes.
3. Run `pnpm format-and-validate` and repair any regressions in-line. This includes the
   Playwright e2e suite — never skip it.

## Project notes

- Trail data is generated: never hand-edit `src/data/graph.json`; change the curated files in
  `data/curated/` and run `pnpm data:build`.
- `data/raw/overpass.json` is a committed snapshot; builds and CI must never call the Overpass
  API. Refresh manually with `pnpm data:fetch`.
- Vitest runs with globals OFF — import `describe`/`it`/`expect` explicitly from `vitest`.
