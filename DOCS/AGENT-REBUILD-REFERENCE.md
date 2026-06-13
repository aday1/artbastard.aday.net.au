# ArtBastard rebuild reference

Start with `AGENT-REBUILD.md` at repo root for phases, MVP, and Done-when checks. This file is the appendix for architecture, file map, and contracts.

Canonical repo: `C:/aday.repo/ArtBastard-DMX512`

## Architecture diagram

```
Browser clients
  live/dev desktop -> #/fixture by default
  direct channel work -> #/dmx-control
  phones/touch tablets -> #/mobile
  external console / scenes / acts
        | REST /api/* + Socket.IO
        v
  dist/server.js
    src/server.ts              Express + Socket.IO bootstrap
    src/api.ts                 REST router
    src/index.ts               DMX / MIDI / OSC engine (512ch)
    src/effects.ts             Effects
    src/fixturesPersistence.ts Runtime fixture JSON
        | dmxnet Art-Net
        v
  LAN node when reachable

Optional:
  bridge-agent/ (Pi) --WSS outbound--> cloud --fan-out--> local Art-Net + Ableton Link
```

## Current lane model

| Host | Branch/tag | Label | Default |
| --- | --- | --- | --- |
| `artbastard.aday.net.au` | `main` / `:live` | `LIVE` | `#/fixture` on refreshed desktop |
| `artbastard-dev.aday.net.au` | `dev` / `:dev` | `DEV` | `#/fixture` on refreshed desktop |
| `artbastard-beta...` | retired | n/a | 301 to dev |

Key files:

- `react-app/src/components/layout/DeployLaneBadge.tsx`
- `react-app/src/utils/deviceSurface.ts`
- `react-app/src/main.tsx`
- `react-app/src/context/RouterContext.tsx`
- `react-app/src/styles/index.scss`

## Backend modules

| File | Role |
| --- | --- |
| `src/server.ts` | HTTP server, Socket.IO wiring, clock broadcasts |
| `src/index.ts` | DMX universe, MIDI, OSC, scene application |
| `src/api.ts` | REST endpoints: fixtures, scenes, config, appearance, bridge tokens |
| `src/core.ts` | Re-exports to break circular deps |
| `src/bridgeRegistry.ts` | Cloud to Pi DMX fan-out |
| `src/bridgeHandlers.ts` | Bridge socket handlers |
| `src/sessionManager.ts` | Shared show session (`DEFAULT_SESSION_ID` today) |
| `src/clockManager.ts` | Master clock, Ableton Link bridge |
| `src/effects.ts` | Channel effects |
| `bridge-agent/` | Pi-side outbound WSS + local Art-Net |

## Persistence layout

```
data/
  appearance.json
  config.json
  fixtures/*.json     runtime saved fixtures
  scenes/
  acts/
```

No database. Factory reset via `--reset` / `-Reset` on start scripts.

## Fixture library source of truth

Library fixtures are code, not runtime JSON:

| Path | Role |
| --- | --- |
| `react-app/src/fixtures/library/types.ts` | Fixture profile schema |
| `coreFixtureLibrary.ts` | Generic core fixtures |
| `importedFixtureBatch.ts` | User-owned DMX hardware batch |
| `entries.ts` / `index.ts` | Registry exports |
| `validation.ts` | Channel/address sanity checks |
| `DOCS/fixtures/*.md` | Cleaned manuals and fixture docs |
| `react-app/public/fixtures/*.jpg` | Gallery/reference photos |

Important owned fixtures currently include twinkling laser RGY, MiniBeam moving head, mini LED moving head wash, UV DMX LED par, small moving head spot, full-colour animation laser, tiny moving head wash, Mini Spider Light, and Event Lighting EL1000RGB.

## Show-map planning

| File | Role |
| --- | --- |
| `react-app/src/fixtures/showBuilder/showPlan.ts` | Address allocation and warnings |
| `showPlan.test.ts` | Address planning tests |
| `react-app/src/components/fixtures/ShowBuilderPanel.tsx` | UI for multiples, groups, address plan |
| `react-app/src/components/fixtures/FixtureSetup.tsx` | Fixture workbench host |
| `react-app/src/components/ui/PdfAddressSheet.tsx` | Printable/exportable patch sheet |

Show-map rules:

- allocate DMX addresses sequentially unless user overrides
- never silently overlap addresses
- support multiples of the same fixture
- allow grouping and split control across address spaces
- expose the physical address values the operator must set on hardware

## Socket events (partial)

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

Bridge-specific handlers live in `bridgeHandlers.ts` and `sessionHandlers.ts`.

## REST API (partial)

| Endpoint | Purpose |
| --- | --- |
| `GET/POST /api/appearance` | Theme HSL + rack preset persistence |
| `POST /api/fixtures` | Bulk runtime fixture save |
| `POST /api/fixtures/:id` | Single runtime fixture save |
| `DELETE /api/fixtures/:id` | Delete runtime fixture |
| `POST /api/midi/controller-template` | Apply X-Touch / APC40 template |
| Bridge token endpoints | Pi pairing, see `DOCS/BRIDGE.md` |

Full inventory: `DOCS/FEATURES.md`; smoke script: `scripts/api-contract-smoke.js`.

## Frontend routing

`react-app/src/context/RouterContext.tsx`:

| ViewType | Hash |
| --- | --- |
| `fixture` | `#/fixture` |
| `dmxControl` | `#/dmx-control` |
| `scenesActs` | `#/scenes-acts` |
| `acts` | `#/acts` |
| `misc` | `#/settings` |
| `mobile` | `#/mobile` |
| `planner` | `#/planner` |

Aliases: `#/main`, `#/external-console`, `#/experimental` -> dmxControl.

Default policy:

- phone / touch tablet -> `#/mobile`
- refreshed live/dev desktop -> `#/fixture`
- explicit hash always wins

## Zustand slices and stores

`react-app/src/store/store.ts` remains the central store:

- `dmxSlice` - channel values, names, ranges
- `fixtureSlice` - profiles, groups, SuperControl state
- `sceneSlice` - scenes, capture/recall
- `automationSlice` - envelopes, workbench UI
- `transitionTrackerSlice` - pattern grid, pages, lanes
- `clipLauncherStore` - session grid
- `timeline.ts` - scene/act timeline state
- `midiSlice`, `oscSlice`, `universeSlice`, `uiSlice`

Engines that must stay mounted in `App.tsx`:

- `envelopeEngine.ts`
- `transitionTrackerEngine.ts`
- `artbastardEasing.ts`
- `useApc40Workflow.ts`

## Rack UI file map

| Path | Role |
| --- | --- |
| `react-app/src/styles/index.scss` | Global host classes and refreshed lane tint |
| `react-app/src/styles/reason-rack.scss` | `--rk-*`, `.ab-rack-module`, screw corners |
| `react-app/src/styles/workbench-shell.scss` | Wired Atelier / workbench chrome |
| `react-app/src/styles/skeuomorphic-controls.scss` | Shared control chrome |
| `react-app/src/styles/metallic-range.scss` | Metallic fader CSS |
| `react-app/src/components/ui/rack/RackModule.tsx` | Module shell |
| `react-app/src/components/ui/rack/RotaryKnob.tsx` | Rotary control |
| `react-app/src/components/ui/controls/DmxVerticalFader.tsx` | Vertical fader |
| `react-app/src/components/ui/controls/MasterStyledSlider.tsx` | Shared horizontal slider |
| `react-app/src/components/ui/controls/ArtbastardXYPad.tsx` | Pan/tilt pad |
| `react-app/src/utils/themeUtils.ts` | Presets, HSL application, refreshed rack chrome |

## Touch/mobile surfaces

| Path | Role |
| --- | --- |
| `react-app/src/pages/MobilePage.tsx` | Mobile page shell |
| `react-app/src/components/fixtures/MobileFixtureRack.tsx` | Touch fixture rack |
| `react-app/src/components/ui/ChannelMonitorDock.tsx` | Compact activity monitor |
| `react-app/src/components/automation/EnvelopeDrawCanvas.tsx` | Envelope editor |

Mobile requirements:

- scroll works inside the envelope editor and page body
- activity indicators never block the right side
- controls are modular, hideable, resizable/movable where supported
- horizontal slider mode must expose a visible way back to vertical mode

## MIDI and APC40

| Path | Role |
| --- | --- |
| `react-app/src/midi/apc40.ts` | APC40 MK1/MK2 source detection + message decoder (notes, CCs, transport, navigation) |
| `react-app/src/hooks/useApc40Workflow.ts` | Live scene/fixture workflow: grid = Deck A scenes, SHIFT+grid = Deck B scenes, REC then Clip saves deck slots, Record Arm = Solo Group, Scene Launch = ACTS, Clip Stop/Stop All release scenes/acts, faders = SuperControl dimmers, Device Control = dynamic gobo/effects roles, Activator = group select, Solo/Cue = fixture select |
| `react-app/src/hooks/useApc40LedFeedback.ts` | LED state: deck grid saved/active/save-mode slots, ACT launch state, solo group row, selected fixtures/groups, FULL ON latch, STOP ALL, SHIFT held deck mode, hot-plug repaint |
| `react-app/src/components/fixtures/Apc40WorkflowPanel.tsx` | Fixture-page APC40 status/help |
| `react-app/src/components/midi/midiControllerTemplates.ts` | X-Touch/APC40 templates (backwards-compatible fallback under the live integration) |
| `react-app/src/hooks/useRoliLightpad.ts` + `react-app/src/engines/roliLightpad.ts` | Bidirectional XY-pad path mirror to Roli Lightpad Block (touch in, LED out, continuous 15x15 LED paths) |
| `DOCS/APC40_CHEATSHEET.md` | Single-page button/LED/mode reference (linked from `DOCS/MIDI_TEMPLATES.md`, `DOCS/SHORTCUTS.md`, in-app Help "APC40 Live" tab, and the showcase docs grid) |
| `DOCS/MIDI_TEMPLATES.md` | Template apply flow (POST `/api/midi/controller-template`) |

APC40 must be practical, not decorative: Clip Launch / Session View is the 40-slot Deck A scene grid, SHIFT exposes the independent 40-slot Deck B grid, REC then Clip saves the current DMX look, SHIFT+REC rolls random DMX for preview only, Scene Launch fires ACTS 1-5, channel faders walk selected fixture dimmers through Super Control, Device Control follows selected fixture gobo/effects roles, Activator selects groups, Solo/Cue selects fixtures, Record Arm soloes groups, Master Select is FREEZE DMX, and the crossfader blends active Deck A/B scenes. The Help overlay (Ctrl+H → APC40 Live) and `DOCS/APC40_CHEATSHEET.md` are the operator reference.

## Show sequencing subsystems

| Subsystem | Key files | Notes |
| --- | --- | --- |
| Scenes | sceneSlice, DmxSceneControls | Snapshot channel values |
| Scene timeline | timeline editors under automation | DMX keyframes 0-255 |
| Acts | `DOCS/ACT_TIMELINE.md` | Clips, gaps, MIDI/OSC lanes |
| Clip launcher | clipLauncherStore.ts | Ableton-style grid |
| Transition tracker | DmxTransitionTracker.tsx, transitionTrackerSlice.ts | Renoise-inspired grid |
| Envelopes | envelopeEngine.ts | Shift-click arming, PLAY/EDIT |

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
| `DOCS/fixtures/README.md` | Fixture manual index |
| `AGENTS.md` | CI/cloud agent notes |

## Demo evidence pipeline

| Command | Output |
| --- | --- |
| `npm run demo:capture-screenshots` | PNGs across routes |
| `npm run demo:capture-videos` | WebM in `website/videos/` |
| `npm run demo:evidence` | smoke + screenshots |
| `npm run demo:evidence-full` | smoke + screenshots + videos |

## Deployment

- GHCR `:live` / `:dev` on push main/dev
- Linode via `deploy-linode`
- Pages: `website/` showcase
- After a live promotion, verify both `/deploy-meta.json` files and browser-rendered labels

## Secondary packages

| Path | Role |
| --- | --- |
| `artbastard-nextjs-frontend/` | Experiment - not production |
| `face-tracker/` | OpenCV sidecar |
