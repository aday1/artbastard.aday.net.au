# Changelog

All notable changes to this project are documented here.

## [Unreleased]

## [5.1.2] - 2026-05-19 — Official hosted release (DMX512)

First release under controlled **dev** / **live** lanes on Linode (GHCR images).
Version **5.1.2** is a deliberate nod to **DMX512**.

### Added

- Resizable dock/floating panels, seamless scroll polish, site branding link component.

### Fixed

- Pinned sidebar channel faders use full 0-255 range with notched/ticks mode.
- Mobile touch surface opens on **Canvas DMX** instead of Super Control.

### Changed

- Channel role icons, DMX Tracker UX, live theme tuning, fixture-aware tracker lanes,
  Macroverse-style workbench envelopes, LAN bridge, deploy-meta live/dev sync (relic-era
  work consolidated from pre-release development).

## Pre-release relics (development archaeology)

The following interim version numbers were never official shipping tags; they describe
the relic era before 5.1.2.

### Relic era — 5.16.x snapshot (2026-05-19)

## [5.16.0] - 2026-05-19

### Added

- Channel role icons on DMX channel strips, pinned sidebar, and DMX Tracker (pan/tilt,
  RGB, dimmer, gobo, strobe, etc.) from fixture channel types.
- **+ Selection** and **+ Pinned** buttons add desk selection / pinned channels to the
  tracker page; context menu **Add to DMX Tracker** on channels.

### Changed

- Tracker grid shows only page columns; factory CH 1-8 default stripped on load.
- Tab label **DMX Tracker** (replaces Renoise tracker); improved grid text contrast.

## [5.15.0] - 2026-05-19

### Added

- Live theme tuning in Settings: HSL sliders and rack presets apply to the UI
  immediately; changes debounce to `POST /api/appearance` (Sync now / Reload UI).
- Tracker channel picker: **Clear all**, collapsible fixture lanes, optional
  **+ Pinned** to merge sidebar-pinned channels into the grid.

### Changed

- Tracker grid columns match the active page chip list only (no implicit CH 1-8).
- New pattern pages start with zero columns until you add channels (number + Add,
  + Selection, or fixture lanes).
- Empty tracker page shows guidance for trimming legacy default columns.

### Fixed

- Grid no longer showed CH 1-8 plus extra pinned columns (e.g. 17-18) when the
  page list was smaller than the old default merge.

## [5.14.0] - 2026-05-19

### Added

- Fixture-aware Renoise tracker: lane buttons for Pan/Tilt, RGB, color wheel, gobo,
  dimmer, beam, FX, and full moving-head columns with fixture scope (all / selected / movers).
- Tracker pages (up to 64 columns), live hex preview, preview row, and envelope sync
  (Env to grid / Grid to env) on tracker and envelope tabs.
- Per-channel envelope strip under DMX faders: PLAY/EDIT, mode buttons that arm without
  auto-loop (Shift+click to start), inline waveform editor.

### Changed

- Transition pattern model: pages, tracks, channelsLocked; migration for saved patterns.
- Grid headers show fixture name and channel role with lane color coding.

## [5.13.0] - 2026-05-19

### Added

- Reason-style rack design system (`reason-rack.scss`, `RackModule`, rotary knobs,
  LEDs, tab strips) across DMX, Super Control, and settings surfaces.
- Automation workbench on the DMX page: envelope automation plus a Renoise-inspired
  DMX transition tracker (pattern grid, BPM/LPB playback, scene/FX columns).
- Macroverse-style theme mastering: rack chrome presets, HSL palettes,
  `GET/POST /api/appearance`, multi-client `appearanceUpdated` sync.
- Vitest coverage for `transitionTrackerEngine` scheduling helpers.

### Changed

- DMX sidebar panel label **Automation** (envelopes + transition tracker).
- Scene timeline pattern drawer; act steps may reference transition patterns.
- README, DOCS, and GitHub Pages showcase updated for v5.13.0.

### Earlier unreleased (showcase / docs)

### Added

- Showcase demo reel: eight WebM clips and JPG posters of every major
  surface (DMX Control, Fixture Setup and SuperControl, Scenes and Acts,
  Experimental Lab, TouchOSC, External Console, Mobile, Settings and
  In-App Help) under `website/videos/`.
- `scripts/capture-demo-videos.sh`: Xvfb + ffmpeg + xdotool +
  google-chrome pipeline that records, encodes, and posters each clip.
  Pre-seeds Chrome preferences to grant MIDI consent so the running
  surface is always visible.
- `npm run demo:capture-videos` and `npm run demo:evidence-full` scripts.
- "Photonic Tour" section on the public showcase (`website/index.html`)
  with lazy-loaded video tiles and poster fallbacks.
- DOCS/HELP.md - offline mirror of the in-app HelpOverlay.
- DOCS/SHORTCUTS.md - master keyboard shortcut reference.
- DOCS/MIDI_TEMPLATES.md - X-Touch Mackie + APC40 MK1 mapping reference.
- DOCS/OSC_REFERENCE.md - SuperControl OSC address grid.
- DOCS/SHOWCASE.md - how the showcase page is produced and deployed.
- HelpOverlay tabs: TouchOSC workflow, controller templates, ACT
  triggers, factory reset, mobile and external console, troubleshooting,
  video tour.

### Changed

- `website/index.html` rewritten with the Photonic Tour, an updated
  feature grid for v5.12.0 (modular DMX page, timeline editor, clip
  launcher, MIDI controller templates, TouchOSC workflow, network
  detection, theme system, in-app help, smoke + demo tooling), and a
  refreshed documentation grid linking the new docs.
- `website/styles.css` gains video-grid, video-tile, mobile portrait
  variant, prefers-reduced-motion guard, and code/kbd helpers.
- `website/script.js` rewritten as a small, lint-friendly bootstrap with
  IntersectionObserver-driven lazy video loading.
- `index.html` (root) and `DOCS/index.html` updated to point at the
  showcase, demo reel, and the new doc pages.
- DOCS/README.md, FEATURES.md, USAGE.md, INSTALL.md, FIXTURES.md,
  DEMO_RECORDING.txt, UI_UX_TOUR.txt all refreshed for v5.12.0 and the
  new demo evidence pipeline.
- Root README.md updated with showcase URL, demo reel pointer, in-app
  help shortcut, and the new doc index.

### Removed

- `.github/workflows/pages.yml` removed: it conflicted with
  `deploy-website.yml` on the `pages` concurrency group and pointed at a
  `docs/` folder with no `index.html`. Public Pages publishing now flows
  exclusively through `deploy-website.yml`.

### Notes

- Total committed media added under `website/videos/` is approximately
  6 MB across 8 WebM clips plus 8 JPG posters.

## [Unreleased - earlier dedupe pass]

### Removed

- Dead duplicate component react-app/src/components/fixtures/SuperControl.tsx (canonical lives at components/dmx/SuperControl.tsx).
- Stale SuperControl backup copies: .broken, .current-backup, .minimal, .syntax-broken.
- Dead duplicate react-app/src/components/scenes/ChromaticEnergyManipulatorMini.{tsx,module.scss} (canonical lives at components/fixtures/ChromaticEnergyManipulatorMini.tsx).
- Unused legacy style snapshots react-app/src/styles/index_old.scss and index_clean.scss.
- Orphan Zustand store slices that were never imported (dmxSlice, fixtureSlice, midiSlice, oscSlice, sceneSlice, uiSlice, universeSlice, slices/timeline.ts, types/timeline.ts). Only automationSlice and types/index.ts remain.
- Orphan stylesheet react-app/src/pages/ActsPage.module.scss (no matching ActsPage component).
- Unreferenced root scripts watchdog.js (depended on a missing start-server.js) and build-without-typechecking.js (never invoked).
- Unused FixtureLibrary and ChannelDataImporter classes that had been embedded inside build-backend.js.
- Frontend-only packages from the backend's root package.json: @fortawesome trio, framer-motion, konva, react-konva, lucide-react, react-draggable, react-grid-layout, react-toastify, and @types/react-grid-layout.

### Changed

- Moved @types/cors, @types/ping, and concurrently from root dependencies to devDependencies.
- Regenerated root package-lock.json from a clean install after dedupe.

Net diff across nine commits: 24 files changed, 97 insertions, 14,389 deletions.

## [5.12.0] - 2026-02-27

### Added

- MIDI controller templates for:
  - Behringer X-Touch Mackie mode
  - Akai APC40 MK1
- X-Touch scribble strip update support via SysEx.
- Pitch-bend MIDI mapping support in backend and frontend processing paths.
- API endpoint for controller template application:
  - POST /api/midi/controller-template
- Regression tests for:
  - TouchOSC export generation
  - Scene capture indexing
  - ACT trigger action handling
  - Clip launcher helper logic
  - DMX filtering behavior
- Smoke scripts:
  - API contract smoke
  - TouchOSC workflow smoke
- Demo screenshot capture workflow and consolidated demo evidence command.

### Changed

- Backend lifecycle ownership consolidated to a single runtime path.
- Fixture persistence unified across runtime and API modules.
- DMX control page refactored into modular subcomponents and shared filters.
- SuperControl wrappers aligned to canonical control implementation.
- Timeline playback channel updates batched for smoother playback behavior.
- Router and experimental tabs support hash-based deep linking.
- TouchOSC XML generation path unified to canonical exporter implementation.

### Fixed

- API contract mismatches across /api/state, /api/config, /api/scenes.
- Factory reset marker check flow and reset consistency.
- Scene capture off-by-one indexing issues.
- ACT next/previous trigger behavior.
- Clip follow/loop determinism.
- CI backend npm install peer-dependency failure caused by root-level dependency conflict.

