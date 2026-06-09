# AGENT-REBUILD - ArtBastard DMX512

Rebuild this project from scratch by re-deriving the current live implementation, not by copying an old UI shell forward. Read this file and `DOCS/AGENT-REBUILD-REFERENCE.md` before writing code. Preserve all Non-negotiables.

This document is a from-scratch rebuild runbook. Follow the phases in order and keep the app usable at the end of each phase.

## Current baseline

| Field | Value |
| --- | --- |
| Live | https://artbastard.aday.net.au |
| Dev | https://artbastard-dev.aday.net.au |
| Retired beta | `artbastard-beta...` redirects to dev; do not recreate a separate beta lane unless asked |
| Current aligned commit | `5c7dc6a7e681` on 2026-06-08 (v5.2.3.1) |
| Live label | `LIVE` |
| Dev label | `DEV` |
| Refreshed host class | `ab-refresh-host` |
| Default refreshed route | `#/fixture` on desktop/tablet, `#/mobile` on phone/touch tablet |

If a retake starts from an empty directory, use this baseline as the product contract. The old orange-only live DMX wall is retired.

## Voice and aesthetics

- Family: Reason rack + ArtSnob, with artistic French elitism and theatrical control-room language.
- Visual identity: skeuomorphic rack modules, screws, LED ladders, metal faders, cyan/gold refreshed rack accent, compact dense operator surfaces.
- Touchscreen direction: fixture modules should feel like Reason devices in a rack. Controls must be large enough to grab, scrollable, and not buried in menu-diving.
- Copy: Franglish nav, aristocrat quotes (`FancyQuotes.tsx`), theatrical LICENSE/HISTORY, accurate DMX specs underneath.
- Preferences: no emoji; scratch under `temp_/`; no new root markdown files unless replacing an existing contract.

## Product shape

ArtBastard is a live DMX operator system:

- 512-channel DMX universe with Socket.IO sync.
- Art-Net output directly where possible, plus optional Pi LAN bridge for cloud-to-local Art-Net and Ableton Link.
- Fixture-first workflow: fixture profiles, physical address planning, grouping, multiples of the same fixture, and show-map generation.
- DMX page: direct channel work, pinned controls, fader orientation, monitoring.
- Mobile page: touch-optimized fixture rack and scrollable control modules.
- Scenes/acts: scene capture, recalls, automation, envelopes, clip launcher, MIDI/OSC actions.
- MIDI: MIDI Learn plus APC40/X-Touch templates and native APC40 scene/fixture workflow.

## Rebuild from scratch

### Prerequisites

- Node.js 20+, npm
- Optional parity: Linux/VM with Xvfb/ffmpeg for demo capture; LAN for Art-Net/MIDI/bridge tests
- Port 3030 free, or set `PORT`

### Path A: clone and strip

Use this when GitHub is available and you want an accurate retake:

    git clone https://github.com/aday1/artbastard.aday.net.au.git ArtBastard-DMX512
    cd ArtBastard-DMX512

Regenerate in place using the Phased rebuild below. Keep `DOCS/`, `LICENSE`, fixture-library source, and `data/` examples until replacements exist.

### Path B: empty directory

Use only when GitHub is unavailable. Create this skeleton first:

    artbastard-dmx512/
      package.json
      build-backend-fast.js
      tsconfig.json
      src/
        server.ts
        api.ts
        index.ts
        core.ts
        fixturesPersistence.ts
        bridgeRegistry.ts
      react-app/
        package.json
        vite.config.ts
        index.html
        src/
          main.tsx
          App.tsx
          context/RouterContext.tsx
          styles/index.scss
          fixtures/library/
          fixtures/showBuilder/
      data/
        appearance.json
        fixtures/
        scenes/
      public/

Install dependencies using the repo package manifests when available. If starting empty, use Express, Socket.IO, dmxnet, osc, midi, Vite, React, TypeScript, Zustand, and Vitest.

### Phased rebuild

| Phase | What to build | Done when |
| --- | --- | --- |
| 0 | Root scripts, backend TS build, empty `data/` | `npm run build-backend-fast` produces `dist/server.js` |
| 1 | `src/index.ts` 512-channel DMX engine; `src/server.ts` HTTP + Socket.IO | server listens and health/root route returns 200 |
| 2 | Socket handlers `setDmxChannel`, `dmx:batch`, connect full-state sync | two clients or API smoke show synced channel changes |
| 3 | REST in `src/api.ts`: appearance, fixtures, scenes, config | POST appearance persists `data/appearance.json` |
| 4 | Art-Net via dmxnet; `updateArtNetConfig`; `artnetStatus` | config can set universe/IP and status event fires |
| 5 | React/Vite app, hash router, `Layout`, `DeployLaneBadge`, `ab-refresh-host` tagging | live renders `LIVE`, dev renders `DEV`, desktop default opens `#/fixture` |
| 6 | Reason rack SCSS and controls: rack chrome, sliders, LEDs, XY pad, buttons | page visibly reads as Reason-rack hardware, not flat dashboard UI |
| 7 | DMX control page: direct channels, pinned controls, horizontal/vertical sliders, compact monitor dock | moving a fader updates server and another client |
| 8 | Fixture library single source of truth under `react-app/src/fixtures/library` | built-in and imported fixtures resolve from one typed registry |
| 9 | Fixture setup/workbench: fixture cards, multiples, grouping, show-map generation | app tells the operator which physical DMX addresses to assign |
| 10 | Mobile fixture rack and touch UI | `#/mobile` scrolls correctly; monitors do not block controls; controls are touch-sized |
| 11 | Scenes and SuperControl: grouped fixture driving, pan/tilt, RGB, gobo/effects | selected fixtures/groups can be driven without menu-diving |
| 12 | Automation envelopes, transition tracker, acts timeline, clip launcher | play/edit flows are scrollable and usable on mobile and desktop |
| 13 | MIDI Learn, OSC, APC40/X-Touch templates, APC40 live workflow hook + LED feedback, Roli Lightpad XY-pad mirror | APC40 grid = Deck A scenes, SHIFT+grid = Deck B scenes, Scene Launch = ACTS, Record Arm saves deck slots, crossfader blends A/B, Device Control follows gobo/effects roles; Roli Lightpad pad mirrors and edits the React XY-pad path |
| 14 | Bridge agent and cloud fan-out | `npm run test:bridge-smoke` passes where practical |
| 15 | ArtSnob layer and docs/site: quotes, help, fixture docs, showcase | docs and app copy match; no stale beta/live labels |

MVP: phases 0-9. A user must be able to add owned fixtures, generate a physical address map, open live control, and move DMX.

Full parity: phases 10-15 and the file map in `DOCS/AGENT-REBUILD-REFERENCE.md`.

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
| Persistence | JSON under `data/` - no database |
| Port | 3030 default (`PORT` env) |
| Routing | Hash SPA (`#/fixture`, `#/dmx-control`, `#/mobile`, `#/scenes-acts`) |
| Universe | Single 512-channel DMX array per session |
| Fixture library | Typed source under `react-app/src/fixtures/library`; docs under `DOCS/fixtures`; assets under `react-app/public/fixtures` |
| Show map | Generate physical DMX address plans, support multiples and grouping |
| Output | Art-Net via dmxnet; optional Pi LAN bridge via WSS outbound |
| MIDI | MIDI Learn, OSC, APC40/X-Touch templates, APC40 live integration (`useApc40Workflow`, `useApc40LedFeedback`) with Deck A/B scene grid, ACT launch buttons, Record Arm save, Device Control role feedback, FULL ON latch, and crossfader blend, Roli Lightpad path mirror |
| Lane labels | live is `LIVE`; dev is `DEV`; no visible `BETA` in the current app shell |
| License | MIT under theatrical LICENSE prose |
| Tone | ArtSnob copy modes; no emoji in source |

## Build and run

    npm ci && npm --prefix react-app ci
    npm run build-backend-fast
    cd react-app && npx vite build
    node dist/server.js

Local HMR: `npm run local` from repo root, usually Vite on port 3001.

Reset state: `./start.sh --reset` or `.\start.ps1 -Reset`.

## Test gates

Use the narrow gates first, then the full build:

    cd react-app && npx vitest run src/fixtures src/midi
    npm run test:api-contract
    npm run test:bridge-smoke
    npm run build

When touching UI, verify with a browser on desktop and mobile widths:

- live root: `https://artbastard.aday.net.au/` -> `LIVE`, `#/fixture`, refreshed rack chrome
- dev root: `https://artbastard-dev.aday.net.au/` -> `DEV`, `#/fixture`, refreshed rack chrome
- mobile: `#/mobile` scrolls and monitors do not cover controls

## Deploy

| Lane | Branch | GHCR tag | URL |
| --- | --- | --- | --- |
| Live | `main` | `:live` | https://artbastard.aday.net.au |
| Dev | `dev` | `:dev` | https://artbastard-dev.aday.net.au |
| Retired beta | n/a | n/a | redirects to dev |
| Pages hub | `main` (`website/`) | n/a | https://aday1.github.io/artbastard.aday.net.au/ |

Workflows: `artbastard-image` then `deploy-linode`. Promote by fast-forwarding `main` from `dev` after dev verification. After promotion, rebuild/deploy dev once more if its embedded lane metadata still shows stale ahead/behind counts.

## Visual contract

Do not flatten rack chrome. Keep:

- `react-app/src/styles/index.scss` host classes and theme variable overrides
- `react-app/src/styles/reason-rack.scss`, `workbench-shell.scss`, `metallic-range.scss`, `skeuomorphic-controls.scss` when present
- `react-app/src/utils/themeUtils.ts` rack presets and `RACK_REFRESHED`
- `react-app/src/components/ui/controls/*` faders, LED meters, XY pads
- `react-app/src/components/layout/DeployLaneBadge.tsx`

Touch/mobility requirements:

- no fixed activity monitor column blocking the right side
- envelope editor and module surfaces scroll on phones
- horizontal sliders keep visible handles and a visible path back to vertical mode
- layout controls belong in module/card context, not one bloated global strip

## Fixture and show-map contract

Owned DMX hardware must be represented as typed fixture profiles:

- `react-app/src/fixtures/library/types.ts`
- `entries.ts`, `coreFixtureLibrary.ts`, `importedFixtureBatch.ts`
- individual focused profiles/tests where useful (`laserTwinklingRgy.ts`, `miniBeamMovingHead.ts`)
- docs in `DOCS/fixtures/*.md`
- gallery images in `react-app/public/fixtures/*.jpg`

The show builder (`react-app/src/fixtures/showBuilder/showPlan.ts` and `ShowBuilderPanel.tsx`) must:

- allocate addresses without overlaps
- warn when the universe overflows
- allow multiples of the same fixture
- allow grouping or splitting fixture instances across address spaces
- provide a physical patch/address sheet the operator can follow

## DMX contract

- `dmxChannels[0..511]`
- Socket: `setDmxChannel`, `dmx:batch`, scenes, appearance sync
- OSC defaults: `/1/dmx{N}` style mappings
- Bridge: `fanOutDmxChannel` and `fanOutFullUniverse` when cloud-hosted
- Fixtures: runtime saved fixtures under `data/fixtures/*.json`; library definitions are source code

## Feature parity rebuild order

1. Backend server/API/DMX engine
2. Socket.IO DMX sync
3. Art-Net config and status
4. Router/layout/lane labels/host classes
5. Reason rack design system
6. Fixture library and show-map generator
7. Fixture setup and SuperControl
8. DMX direct channel control
9. Mobile fixture rack
10. Scenes and scene controls
11. Automation envelopes
12. Transition tracker
13. Acts timeline and clip launcher
14. MIDI Learn, OSC, APC40/X-Touch
15. Pi bridge agent
16. ArtSnob copy, help, fixture docs, showcase

## Personality

- `FancyQuotes.tsx` is the source of truth for quotes; sync via `node scripts/sync-docs-quotes.mjs`
- Theme modes: `artsnob`, `standard`, `minimal`
- Do not rename SuperControl or ChromaticEnergyManipulator without explicit ask

## Anti-patterns

- database/ORM
- path-routing migration without a plan
- visible `BETA` badge in the current live/dev app shell
- separate "built-in" and "fixture library" truth sources
- flat Material UI replacement for rack modules
- menu-diving for core live workflows
- throwaway tests outside `temp_/`
- extra markdown files in repo root
- using `artbastard-nextjs-frontend/` or `face-tracker/` as the production app

## Operator docs

`DOCS/FEATURES.md`, `DOCS/USAGE.md`, `DOCS/BRIDGE.md`, `DOCS/fixtures/README.md`, `DOCS/APC40_CHEATSHEET.md`, `DOCS/MIDI_TEMPLATES.md`, `DOCS/SHORTCUTS.md`, `AGENTS.md`
