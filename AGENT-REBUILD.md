# AGENT-REBUILD — ArtBastard DMX512

Rebuild this project from scratch. Read this file and `docs/AGENT-REBUILD-REFERENCE.md` before writing code. Preserve all Non-negotiables.

## Canonical paths

| Field | Value |
| --- | --- |
| GitHub | https://github.com/aday1/artbastard.aday.net.au |
| Local | `C:/aday.repo/ArtBastard-DMX512` |
| Vault | YomikosPapers `09-network-homelab/PROJECT-Artbastard-DEV.md` |
| Cursor skill | YomikosPapers `.cursor/skills/regenerate-artbastard/` |

## Non-negotiables

| Layer | Requirement |
| --- | --- |
| Runtime | Node 20+, Express, Socket.IO |
| Frontend | Vite + React + TypeScript + Zustand |
| Styles | SCSS modules; Reason-rack skeuomorphism is product identity |
| Persistence | JSON under `data/` — no database |
| Port | 3030 default (`PORT` env) |
| Routing | Hash SPA (`#/dmx-control`, etc.) |
| Universe | Single 512-channel DMX array per session |
| Output | Art-Net via dmxnet; optional Pi LAN bridge (WSS outbound) |
| License | MIT under theatrical LICENSE prose |
| Tone | ArtSnob copy modes; no emoji in source |

## Build and run

    npm ci && npm --prefix react-app ci
    npm run build-backend-fast
    cd react-app && npx vite build
    node dist/server.js

CI / non-interactive (no MIDI prompt from start.sh):

    npm run build-backend-fast && node dist/server.js

Local HMR: `npm run local` from repo root (port 3001).

## Test gates

    npm run test:api-contract
    npm run test:bridge-smoke
    npm run demo:evidence
    cd react-app && npx vitest run

Kill port 3030 before smoke tests. Cloud deploy: Art-Net/MIDI unreachable without bridge — expected.

## Deploy

| Lane | Branch | URL |
| --- | --- | --- |
| Live | `main` | https://artbastard.aday.net.au |
| Dev | `dev` | https://artbastard-dev.aday.net.au |
| Pages hub | `main` (`website/`) | https://aday1.github.io/artbastard.aday.net.au/ |

Workflows: `artbastard-image` then `deploy-linode` via `workflow_run`. See `DOCS/` and vault deploy log.

## Visual contract (Reason rack)

Do not flatten rack chrome. SCSS order in `react-app/src/index.scss`: design-system, workbench-shell, reason-rack, metallic-range / skeuomorphic-controls.

Rack kit: `react-app/src/components/ui/rack/` (RackModule, RackTabStrip, RotaryKnob, RackLed, RackToggle).

Appearance: `GET/POST /api/appearance` -> `data/appearance.json`, socket `appearanceUpdated`.

## DMX contract

- `dmxChannels[0..511]` — OSC `/1/dmx{N}` default
- Socket: `setDmxChannel`, `dmx:batch`, scenes, appearance sync
- Bridge: `fanOutDmxChannel` / `fanOutFullUniverse` when cloud-hosted
- Fixtures: `data/fixtures/*.json`

## Feature parity rebuild order

1. Backend: server.ts, api.ts, 512ch engine (index.ts)
2. Socket.IO DMX + broadcast
3. Art-Net config + Settings ping
4. Hash router + Layout `ab-rack`
5. DmxChannelControlPage grid/faders
6. Fixtures + SuperControl
7. Scenes + timeline keyframes
8. Automation envelopes
9. Transition tracker
10. Acts timeline + clip launcher
11. MIDI Learn + OSC
12. Mobile `#/mobile`
13. Bridge agent smoke
14. Appearance + themes
15. Help + DOCS; demo evidence

Full checklist and file map: `docs/AGENT-REBUILD-REFERENCE.md`.

## Personality (ArtSnob)

- `FancyQuotes.tsx` — source of truth for quotes; sync via `node scripts/sync-docs-quotes.mjs`
- Theme modes: `artsnob` | `standard` | `minimal` in ThemeContext
- Do not rename SuperControl or ChromaticEnergyManipulator without explicit ask

## Anti-patterns

- No database/ORM
- No path routing migration without plan
- No emoji in code/HTML/SCSS
- No throwaway tests outside `temp_/`
- No extra markdown files in repo root
- Do not conflate `artbastard-nextjs-frontend/` or `face-tracker/` with production app

## Operator docs

`DOCS/FEATURES.md`, `DOCS/USAGE.md`, `DOCS/BRIDGE.md`, `AGENTS.md`
