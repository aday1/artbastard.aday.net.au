# ArtBastard Features (v5.2.13.0)

Feature inventory after the rebuild consolidation. Subsystem first, then
notable shipped features.

## Release highlight: v5.2.13.0 joined ROLI server topology

- Server-owned joined ROLI Lightpad BLOCK topology splits a physically chained
  one-USB pair into two logical pads: primary XY and colour-wheel.
- ROLI LED drawing is ACK-paced per pad with independent packet counters,
  clean crosshair frames, colour strip frames, and role-specific idle motion.
- ROLI auto-connect ignores non-ROLI ports such as Holybell10 when the blocks
  are unplugged.

## Release highlight: v5.2.12.0 hard version bump

- SuperControl card layout rebuild with a top-spanning Selection card,
  filled Stage Map / Monitor areas, card width controls, and hidden-card restore.
- Softer cream/synthwave light theme with stronger cyan, magenta, and amber
  accents across DMX, SuperControl, monitors, footer controls, and deploy metadata.
- BPM dashboard restored to the top header with tempo source, BPM value, and
  play/stop state visible while operating the desk.
- Footer-level MIDI, OSC, DMX, Help, theme, ArtSnob, and Reset controls keep
  monitoring tools available without permanently occupying the show surface.
- Experimental DMX Tracker is feature-flagged; stable envelopes and channel
  controls stay the production default.

## APC40 MK1 stateful live surface (v5.2.12.0)

- APC40 hardware buttons now use explicit ON/OFF semantics instead of blind
  toggles. Immediate note-off / velocity-zero releases are ignored; delayed
  velocity-zero events are treated as the hardware OFF state.
- Record Arm 1-8 is Solo Group: ON snapshots DMX and blacks out non-soloed
  fixtures, OFF releases the group and restores when the last solo ends.
- Solo/Cue 1-8 selects fixture N on ON and removes it on OFF. Activator 1-8
  adds/removes fixture group N the same way.
- PAN ON selects all fixtures; PAN OFF clears fixture selection. SEND A/B/C
  ON enables Color, Pan/Tilt, and Effects automation; OFF disables each engine.
- Clip/Track is FULL ON, Device On/Off is BLACKOUT, Master Select is FREEZE DMX,
  Rec Quantization aliases REC, MIDI Overdub aliases Stop All Clips, and
  Metronome aliases Tap Tempo.
- Track Select is the remaining unmapped button row; its LEDs stay off by design
  because APC40 hardware can emit unreliable CC bleed in some modes.
- APC40 LEDs mirror selected fixtures/groups, Solo Group, PAN, SEND A/B/C,
  FULL ON, BLACKOUT, FREEZE, REC/save mode, PLAY/STOP, Deck A/B clip state,
  ACT launch state, and Stop All Clips.

## Control and runtime

- 512-channel DMX universe control with fixture / group abstractions.
- Art-Net output across multiple universes.
- Real-time socket state synchronisation between backend and every
  connected client (desktop app and mobile surface). Multiple
  operators can work concurrently; one shared DMX universe is broadcast to
  all clients and to the active LAN bridge when connected.
- LAN / Pi bridge (`bridge-agent/`): outbound WSS from a home-network host
  to drive Art-Net on 192.168.1.* (and similar) when the UI runs on the
  cloud. Ableton Link can run on the bridge for Live tempo sync. One bridge
  per show today; separate isolated sessions per tenant are future work.
- Consolidated backend lifecycle and unified fixture persistence service.
- Network interface auto-detection with ICMP ping verification.

## Rack UI and automation (v5.14.0+)

- Reason-style rack modules (`reason-rack.scss`, `components/ui/rack/`).
- DMX page **Automation** workbench: envelopes + **transition tracker**
- DMX page **Visibility** controls: hide unused channel strips, reopen all 512
  channels instantly, and toggle the active-channel tracker strip when it gets
  in the way.
  (pattern lines, scene/FX/easing columns, hex channel values, BPM/LPB play).
- Fixture-aware tracker lanes (pan/tilt, RGB, color wheel, gobo, dimmer, beam,
  FX, full mover) with scope All / Selected / Moving heads.
- Tracker **pages** (up to 64 channel columns), live hex preview row, envelope
  sync (**Env to grid** / **Grid to env**).
- Per-channel envelope strip under faders: PLAY/EDIT, mode buttons that arm
  without auto-loop (Shift+click to start).

### Tracker channel columns (v5.15.0)

- Grid columns match the active page chip list only (no implicit CH 1-8).
- Add channels: number + Add, **+ Selection**, or collapsible fixture lanes.
- Remove: **x** on a chip or **Clear all**; optional **+ Pinned** merges
  sidebar-pinned channels into the grid.
- New pages start empty; saved patterns from older builds may still list CH 1-8
  until you trim them.

## Theme mastering (Macroverse-style)

- Rack chrome presets (Reason Rack, Wired Atelier, Synthwave, Ocean, etc.).
- HSL palette + rack tokens apply **live** as you adjust sliders (v5.15.0);
  debounced `POST /api/appearance` (`data/appearance.json` on the server).
- **Sync now** pushes appearance immediately; **Reload UI** reapplies server state.
- Other clients receive `appearanceUpdated` and reload shared appearance.

## Operator UI (remaster, May 2026)

Shared controls in `react-app/src/components/ui/controls/`:

- `ArtbastardXYPad` - pan/tilt and autopilot track centers
- `VerticalBabydinoSlider` / `HorizontalFader` - styled gold faders
- `RangeWindowControl` - dual-handle min/max windows
- `SteppedGoboSlider` - discrete gobo steps
- `RemasterPanel` - glass panel shell for automation surfaces
- Envelope engine with anime.js `outExpo` (`utils/envelopeEngine.ts`)

Surfaces using the kit: DmxChannelCard grid, Super Control, stage canvas,
Chromatic Energy manipulator, scenes, mobile/touch, BPM dashboard, envelope
and modular automation. Settings and face-tracker debug still use native
ranges where low traffic warrants it.

## Canvas-first fixture setup

- Fixture Setup opens on a 1000x600 stage map instead of a menu-first form.
- Drag or tap a fixture library profile onto the map to create a real patched
  fixture with the next safe DMX start address.
- The inspector handles exact address edits, naming, rotation, scale, group
  membership, conflict warnings, and advanced batch tools.
- Top and Side view share the same saved `fixtureLayout` coordinates.
- Map selection is global: Super Control, APC40 fixture/group selection, and
  Fixture Setup all use the same selected fixtures.
- Smart Groups adds capability groups plus map-aware Stage Left, Center,
  Stage Right, Upstage, and Downstage groups.
- Seed Scenes, Seed ACTS, and Giddy Up are available from the fixture workflow
  once fixtures exist, but all generated material remains optional.

## DMX workflow and UX

- Modular DMX Control page architecture:
  - Header with master fader and global state
  - Filters and fixture selector
  - Channels viewport and channel cards (grid or list)
  - Pinned channels summary
  - Scene controls
  - MIDI connections panel
  - Footer / status row
- Channel and fixture filtering utilities with regression tests.
- Pinned channel summaries and active channel visibility helpers.
- Theme system with HSL controls, typography scale, spacing tokens, rack
  presets, and server-synced appearance (`/api/appearance`).

## Scenes, acts, and timelines

- Scene save / load / delete from the canonical SuperControl flow.
- Scene timeline playback with batched channel updates.
- Scene timeline editor (DAW-style) with:
  - Multi-track view, mute / solo / collapse per track
  - Keyframes that show actual DMX values (0-255) and percentages
  - Easing types: linear, ease-in, ease-out, smooth, step
  - Snapping, drag preview, undo / redo, copy / paste
- Act timeline editor (show sequencing):
  - Scene clips with absolute start times, gaps, resize, playhead scrub
  - +2s gap / extend timeline tools; playback waits through gaps
  - MIDI and OSC lanes with scheduled events at ms offsets
  - Sync to BPM (app tempo / bar multiplier); see DOCS/ACT_TIMELINE.md
- Clip launcher (Ableton-style) with:
  - Customisable grid (default 4x4)
  - Visual states: playing, queued, recording, empty
  - Loop toggle per clip and Stop All
- ACT triggers: play, pause, stop, next, previous, toggle (act transport).
- Ableton Link (via Pi bridge): shared BPM with Link peers; not Live transport.

## Mobile and legacy surface aliases

- Mobile Control Surface route (`#/mobile`).
- Hash-based deep linking everywhere.
- Current primary routes: `#/dmx-control`, `#/fixture`, `#/scenes-acts`,
  `#/acts`, `#/mobile`, and `#/settings`.
- Legacy aliases (`#/external-console`, `#/experimental`) resolve back to
  `#/dmx-control` for compatibility and are not part of the current tour.

## OSC tablet workflows

- OSC clients can drive SuperControl, scenes, ACT triggers, master controls,
  fixtures, and direct DMX channels; see DOCS/OSC_REFERENCE.md.
- Legacy TouchOSC XML generator code is no longer a primary routed surface;
  use the API contract smoke and in-app OSC monitor while maintaining tablet
  workflows.

## MIDI and OSC

- MIDI Learn for note, CC, and pitch-bend mappings.
- Pitch-bend-to-DMX processing path in backend and frontend.
- MIDI controller templates:
  - Behringer X-Touch (Mackie mode)
  - Akai APC40 MK1
- X-Touch scribble strip SysEx labels updated on template apply and on
  channel rename.
- Controller template REST endpoint:
  `POST /api/midi/controller-template { template: 'xtouch' | 'apc40' }`.
- OSC integration covering SuperControl axes, scenes, ACT triggers, master
  controls, and per-fixture / per-channel direct control.

## Help and discoverability

- HelpOverlay accessible by Ctrl+H or from Settings > Help.
- Tabs: Getting Started, DMX Control, Address Sheet, DIP Simulator, MIDI
  Setup, OSC Integration, Scene Management, Timeline, Clip Launcher,
  Shortcuts.
- Live MIDI Monitor and OSC Monitor embedded in the help tabs.
- DIP Switch Calculator and PDF Address Sheet generator.

## Settings and reset

- API contract support for:
  - `/api/state` GET / POST / DELETE
  - `/api/config` GET / POST / DELETE
  - `/api/scenes` GET / POST / DELETE
- Factory reset marker check endpoint:
  - `/api/factory-reset-check`
- Launcher reset flags: `./start.sh --reset` and `.\start.ps1 -Reset`.

## Testing and evidence tooling

- Unit / regression tests for:
  - TouchOSC export
  - Scene capture indexing
  - ACT trigger handling
  - Clip launcher helper logic
  - DMX filtering behaviour
- Smoke scripts:
  - API contract smoke (`test:api-contract`)
  - Bridge smoke (`test:bridge-smoke`)
- Demo evidence pipeline:
  - Automated screenshot capture (`demo:capture-screenshots`)
  - Automated video capture (`demo:capture-videos`)
  - Combined evidence run (`demo:evidence` / `demo:evidence-full`)
