# AGENT-REBUILD — ArtBastard DMX512

Rebuild this project from scratch. Read this file and `DOCS/AGENT-REBUILD-REFERENCE.md` before writing code. Preserve all Non-negotiables.

This document is a **from-scratch rebuild runbook**, not a high-level summary. Follow the phases below in order.

## Rebuild from scratch

### Prerequisites

- Node.js 20+, npm
- Optional for full parity: Linux or VM with Xvfb/ffmpeg for demo capture; LAN for Art-Net/MIDI tests
- Port 3030 free (or set `PORT`)

### Path A (recommended): clone and strip

Use when you need accurate contracts fast:

    git clone https://github.com/aday1/artbastard.aday.net.au.git ArtBastard-DMX512
    cd ArtBastard-DMX512

Regenerate in place using the **Phased rebuild** below. Do not delete `DOCS/`, `LICENSE`, or `data/` fixture examples until replacements exist.

### Path B: empty directory

Use only when GitHub is unavailable. Create this tree first:

    artbastard-dmx512/
      package.json          # root scripts: build-backend-fast, start
      build-backend-fast.js
      tsconfig.json         # backend compile -> dist/
      src/
        server.ts           # Express + Socket.IO listen
        api.ts              # REST router
        index.ts            # 512ch DMX engine
        core.ts
      react-app/
        package.json        # Vite + React + TS
        vite.config.ts
        index.html
        src/
          main.tsx
          App.tsx
          index.scss
      data/
        appearance.json
        fixtures/           # at least one .json profile
      public/               # static fallback if needed

Install deps:

    npm init -y   # only if no package.json yet
    npm install express socket.io dmxnet osc midi ...
    cd react-app && npm create vite@latest . -- --template react-ts

Then execute the same phases as Path A.

### Phased rebuild (implement in order)

| Phase | What to build | Done when |
| --- | --- | --- |
| 0 | Root `package.json`, `build-backend-fast.js`, backend `tsconfig`, empty `data/` | `npm run build-backend-fast` produces `dist/server.js` |
| 1 | `src/index.ts`: `dmxChannels[512]`, init defaults; `src/server.ts`: HTTP + Socket.IO on PORT | `node dist/server.js` listens; curl returns 200 on `/` or health route |
| 2 | Socket handlers `setDmxChannel`, `dmx:batch`, broadcast full state on connect | Two browser tabs or `scripts/api-contract-smoke.js` show synced channel changes |
| 3 | `src/api.ts`: `GET/POST /api/appearance`, fixture CRUD stubs; persist JSON under `data/` | POST appearance writes `data/appearance.json` |
| 4 | Art-Net via dmxnet in `index.ts`; `updateArtNetConfig` socket; `artnetStatus` emit | Settings or API can set universe IP; status event fires (LAN may show connected) |
| 5 | `react-app`: Vite build, hash router (`RouterContext`), `Layout` with `ab-rack` class | `npm run local` or built assets load `#/dmx-control` |
| 6 | SCSS: `design-system`, `workbench-shell`, `reason-rack`, `skeuomorphic-controls` per load order in `index.scss` | Page visibly uses rack chrome (not flat Material UI) |
| 7 | `DmxChannelControlPage`: grid + `DmxVerticalFader`; Zustand `dmxSlice` wired to sockets | Dragging fader updates server and other clients |
| 8 | Fixtures: `fixturesPersistence.ts`, SuperControl page `#/fixture` | Save/load fixture JSON in `data/fixtures/` |
| 9 | Scenes: capture/recall channel arrays; `#/scenes-acts` | Scene save restores 512 values |
| 10 | Automation envelopes + transition tracker + acts/clip launcher | Subsystems in FEATURE PARITY list below work per `DOCS/FEATURES.md` |
| 11 | MIDI Learn, OSC, `#/mobile` route | Templates from `DOCS/MIDI_TEMPLATES.md` apply |
| 12 | `bridge-agent/` + `bridgeRegistry.ts` cloud fan-out | `npm run test:bridge-smoke` passes |
| 13 | ArtSnob: `FancyQuotes.tsx`, ThemeContext modes, `sync-docs-quotes.mjs` | Showcase quote wall matches app quotes |
| 14 | `website/` hub, `npm run demo:evidence` | All test gates green |

**MVP (ship-blocking minimum):** phases 0-7. User can open `#/dmx-control`, move faders, persist appearance, optional Art-Net on LAN.

**Full parity:** phases 8-14 and the numbered list in the next section.

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

Full checklist and file map: `DOCS/AGENT-REBUILD-REFERENCE.md`.

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
