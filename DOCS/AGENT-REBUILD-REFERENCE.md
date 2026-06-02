# ArtBastard rebuild reference

**Start with `AGENT-REBUILD.md` at repo root** for from-scratch phases, MVP, and Done-when checks. This file is the deep appendix (architecture, sockets, file map).

Canonical repo: `C:/aday.repo/ArtBastard-DMX512`

## Architecture diagram

```
Browser clients (desktop / #/mobile / external console)
        |  REST /api/*  +  Socket.IO
        v
  dist/server.js
    src/server.ts    Express + Socket.IO bootstrap
    src/api.ts       REST router
    src/index.ts     DMX / MIDI / OSC engine (512ch)
    src/effects.ts   Effect engine
    src/fixturesPersistence.ts
        |  dmxnet Art-Net
        v
  LAN node (or unreachable in cloud)

Optional:
  bridge-agent/ (Pi) --WSS outbound--> cloud --fan-out--> local Art-Net + Ableton Link
```

## Backend modules

| File | Role |
| --- | --- |
| `src/server.ts` | HTTP server, Socket.IO wiring, clock broadcasts |
| `src/index.ts` | DMX universe, MIDI, OSC, scene application |
| `src/api.ts` | REST endpoints (fixtures, scenes, config, appearance, bridge tokens) |
| `src/core.ts` | Re-exports to break circular deps |
| `src/bridgeRegistry.ts` | Cloud -> Pi DMX fan-out |
| `src/bridgeHandlers.ts` | Bridge socket handlers |
| `src/sessionManager.ts` | Shared show session (DEFAULT_SESSION_ID today) |
| `src/clockManager.ts` | Master clock, Ableton Link bridge |
| `src/effects.ts` | Channel effects |
| `bridge-agent/` | Pi-side outbound WSS + local Art-Net |

## Persistence layout

```
data/
  appearance.json
  config.json (via loaders)
  fixtures/*.json     one file per fixture
  scenes/
  acts/
```

No database. Factory reset via `--reset` / `-Reset` on start scripts.

## Socket events (partial — see server.ts for full list)

| Event | Direction | Purpose |
| --- | --- | --- |
| `setDmxChannel` | client -> server | Single channel update |
| `dmx:batch` | client -> server | Batch channel update |
| `dmxStateRestored` | server -> clients | Full state sync |
| `updateArtNetConfig` | client -> server | Art-Net interface config |
| `artnetStatus` | server -> client | Config/connection status |
| `appearanceUpdated` | server -> clients | Theme sync |
| `masterClockUpdate` | server -> clients | Clock state |
| `setMasterClockSource` | client -> server | Clock source select |
| `browserMidiMessage` | client -> server | Web MIDI input |
| Scene save/load events | both | Scene snapshots |

Bridge-specific handlers in `bridgeHandlers.ts` and `sessionHandlers.ts`.

## REST API (partial — see api.ts)

| Endpoint | Purpose |
| --- | --- |
| `GET/POST /api/appearance` | Theme HSL + rack preset persistence |
| `POST /api/fixtures` | Bulk fixture save |
| `POST /api/fixtures/:id` | Single fixture save |
| `DELETE /api/fixtures/:id` | Delete fixture |
| `POST /api/midi/controller-template` | Apply X-Touch / APC40 template |
| Bridge token endpoints | Pi pairing (see DOCS/BRIDGE.md) |

Full inventory: `DOCS/FEATURES.md`, smoke script `scripts/api-contract-smoke.js`.

## Frontend routing

`react-app/src/context/RouterContext.tsx`:

| ViewType | Hash |
| --- | --- |
| dmxControl | `#/dmx-control` |
| fixture | `#/fixture` |
| scenesActs | `#/scenes-acts` |
| misc | `#/settings` |
| mobile | `#/mobile` |
| planner | `#/planner` |

Aliases: `#/main`, `#/external-console`, `#/experimental` -> dmxControl.

Mobile default: narrow viewports open `#/mobile` unless hash already set.

## Zustand slices and stores

`react-app/src/store/store.ts` — primary monolithic store:

- `dmxSlice` — channel values, names, ranges
- `fixtureSlice` — profiles, groups, SuperControl state
- `sceneSlice` — scenes, capture/recall
- `automationSlice` — envelopes, workbench UI
- `transitionTrackerSlice` — pattern grid, pages, lanes
- `clipLauncherStore` — session grid
- `timeline.ts` — scene/act timeline state
- `midiSlice`, `oscSlice`, `universeSlice`, `uiSlice`

Engines (keep mounted in App.tsx):

- `envelopeEngine.ts` — per-channel automation playback
- `transitionTrackerEngine.ts` — tracker playback
- `artbastardEasing.ts` — outExpo easing (anime.js)

## Rack UI file map

| Path | Role |
| --- | --- |
| `react-app/src/styles/reason-rack.scss` | `--rk-*`, `.ab-rack-module`, screw corners |
| `react-app/src/styles/workbench-shell.scss` | Wired Atelier copper/amber |
| `react-app/src/styles/skeuomorphic-controls.scss` | Shared control chrome |
| `react-app/src/styles/metallic-range.scss` | Gold fader CSS |
| `react-app/src/components/ui/rack/RackModule.tsx` | Module shell |
| `react-app/src/components/ui/rack/RotaryKnob.tsx` | Rotary control |
| `react-app/src/components/ui/controls/DmxVerticalFader.tsx` | Vertical fader |
| `react-app/src/components/ui/controls/ArtbastardXYPad.tsx` | Pan/tilt pad |
| `react-app/src/utils/themeUtils.ts` | Presets + HSL application |

## Show sequencing subsystems

| Subsystem | Key files | Notes |
| --- | --- | --- |
| Scenes | sceneSlice, DmxSceneControls | Snapshot channelValues[] |
| Scene timeline | timeline editors under automation/ | DMX keyframes 0-255 |
| Acts | DOCS/ACT_TIMELINE.md | Clips, gaps, MIDI/OSC lanes |
| Clip launcher | clipLauncherStore.ts | Ableton-style grid |
| Transition tracker | DmxTransitionTracker.tsx, transitionTrackerSlice.ts | Renoise-inspired hex grid |
| Envelopes | envelopeEngine.ts | Shift+click arming, PLAY/EDIT |

## Personality / brand files

| File | Content |
| --- | --- |
| `react-app/src/components/layout/FancyQuotes.tsx` | luxuryQuotes source of truth |
| `DOCS/showcase-quotes-data.js` | Synced JS bundle for static sites |
| `scripts/sync-docs-quotes.mjs` | FancyQuotes -> DOCS sync |
| `DOCS/HISTORY.md` | Origin story |
| `LICENSE` | MIT + manifesto |
| `react-app/src/context/ThemeContext.tsx` | artsnob / standard / minimal |

## Operator docs

| Doc | Topic |
| --- | --- |
| `DOCS/FEATURES.md` | Feature inventory |
| `DOCS/USAGE.md` | Operator workflows |
| `DOCS/BRIDGE.md` | Pi LAN bridge |
| `AGENTS.md` | CI/cloud agent notes |

## Demo evidence pipeline

| Command | Output |
| --- | --- |
| `npm run demo:capture-screenshots` | PNGs across routes |
| `npm run demo:capture-videos` | WebM in `website/videos/` |
| `npm run demo:evidence` | smoke + screenshots |

## Deployment

- GHCR `:live` / `:dev` on push main/dev
- Linode via `deploy-linode`
- Pages: `website/` showcase

## Secondary packages (not main app)

| Path | Role |
| --- | --- |
| `artbastard-nextjs-frontend/` | Experiment — not production |
| `face-tracker/` | OpenCV sidecar |
