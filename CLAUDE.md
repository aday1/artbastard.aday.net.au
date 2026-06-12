# ArtBastard agent notes

## Data-driven spec convention

All feature content lives in markdown under `DOCS/`, never in hardcoded TS
arrays. `scripts/buildSpecs.mjs` is the umbrella codegen runner. Each domain
is a builder in `scripts/specs/{domain}.mjs`:

| Source | Generates | Domain |
|---|---|---|
| `DOCS/midi/*.md` | `react-app/src/midi/generated/*.ts` | midi |
| `DOCS/fixtures/library/*.md` | `react-app/src/fixtures/library/generated/mdFixtureLibraryEntries.ts` | fixtureLibrary |
| `DOCS/scenes/packs/*.md` | `react-app/src/scenes/generated/seedPacks.ts` | scenes |
| `DOCS/acts/packs/*.md` | `react-app/src/acts/generated/seedPacks.ts` | acts |

To regenerate: `node scripts/buildSpecs.mjs` (or a single domain:
`node scripts/buildSpecs.mjs scenes`). The vite plugin
`react-app/vite.specs.plugin.mjs` watches all four trees and regenerates on
change during dev.

When adding a new feature whose content might change (templates, presets,
catalog entries, seed packs): write it as MD under `DOCS/` and add a codegen
domain. Do not hand-edit the `generated/*.ts` files.

## Project YAML round-trip

Live rig state (`fixtures`, `groups`, `scenes`, `acts`, `bindings`, `config`,
`layout`, `presets`) is exposed via per-section YAML import/export at
`Settings → Project YAML` and the backend `/api/project/export?section=…` +
`/api/project/import` endpoints. `presets` is client-only (Zustand
localStorage); the other seven are server-backed and re-broadcast live on
import. See `DOCS/PROJECT_IO.md`. Groups reference fixtures by stable `id`,
not positional index — the legacy `fixtureIndices` is kept as a runtime
mirror for the existing socket paths but YAML is id-based.

## Build

```bash
npm run build                # full backend + react-app build
cd react-app && npx vite build   # react-app only (faster)
node scripts/buildSpecs.mjs       # regen MD codegen only
```

On Windows: shell is bash, but paths in tools use forward slashes (`/dev/null`,
not `NUL`). Use `cd react-app && npx vite build` rather than
`./node_modules/.bin/vite build`.

## Store

The Zustand store is a single monolith at `react-app/src/store/store.ts`.
`react-app/src/store/slices/` is dead code — do not put new slices there.
