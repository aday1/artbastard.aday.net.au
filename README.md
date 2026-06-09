# ArtBastard DMX512

ArtBastard is a TypeScript-based DMX lighting controller with a React
frontend and Node / Socket.IO backend.

Current package version: 5.2.4.0

## Showcase

- Quick-jump hub: https://aday1.github.io/artbastard.aday.net.au/
- Full showcase (Photonic Tour + features + docs):
  https://aday1.github.io/artbastard.aday.net.au/
- Live app: https://artbastard.aday.net.au
- Dev pre-prod lane (same Docker service `artbastard_test`, image `:dev`):
  - https://artbastard-dev.aday.net.au

The showcase page hosts a "Photonic Tour" demo reel: six short WebM
clips of every current primary surface (DMX Control, Fixture Setup,
Scenes and Clip Launcher, Acts Timeline, Mobile, Settings and In-App Help). Recorded
straight off the running app via `npm run demo:capture-videos`. See
DOCS/SHOWCASE.md for details.

## Current status (2026-06)

### Confirmed live/dev line (v5.2.0.0)

- Dev and live now use the same refreshed ArtBastard code line; the retired
  beta identity is no longer part of the app shell.
- DMX strips can hide unused anonymous channels while keeping fixture-assigned,
  active, selected, pinned, named, MIDI, and OSC channels available.
- The active-channel tracker strip, envelope editor, and DMX transition pattern
  tracker can be toggled independently to keep the desk clear.

### APC40 live controller refactor (v5.2.4.0)

- APC40 Clip Launch / Session View is now Deck A scene slots 1-40; hold SHIFT
  for independent Deck B slots 1-40.
- Scene Launch buttons fire ACTS 1-5; Record Arm saves the next grid pad into
  the current deck.
- Device Control knobs follow selected fixture/group gobo, wheel, prism, focus,
  zoom, strobe, and other DMX roles; Cue Level pages role banks.
- Crossfader blends active Deck A and Deck B scenes; Master Select is FULL ON.

### Tracker columns and live theme (v5.15.0)

- Transition tracker grid columns match the active page chip list only (no implicit
  CH 1-8). **Clear all**, collapsible fixture lanes, optional **+ Pinned**.
- Settings theme (HSL + rack presets) applies live; debounced `POST /api/appearance`.

### Rack UI, automation workbench, and theme mastering (May 2026, v5.13.0+)

- Reason-style skeuomorphic rack modules (`reason-rack.scss`, `RackModule`,
  rotary knobs, LEDs, tab strips) across DMX, Super Control, and settings.
- **Automation** workbench: envelope automation plus a Renoise-inspired
  **DMX transition tracker** (pattern lines, scene/FX columns, BPM/LPB playback).
- **Theme presets** (Macroverse-style): rack chrome + HSL palettes, server
  persistence at `GET/POST /api/appearance`, multi-client sync via
  `appearanceUpdated` socket events. Settings > Theme > Rack presets.

### Operator UI remaster (May 2026)

Primary control surfaces now use a shared control kit under
`react-app/src/components/ui/controls/`:

- `VerticalBabydinoSlider` and `HorizontalFader` (gold pill faders)
- `ArtbastardXYPad` for pan/tilt and autopilot track centers
- `RangeWindowControl` for dual-handle min/max windows
- `SteppedGoboSlider` for discrete gobo steps
- Envelope automation uses anime.js `outExpo` easing via `envelopeEngine.ts`

Wired across the DMX grid (`DmxChannelCard`), Super Control, fixture
canvas, Chromatic Energy manipulator, scenes, mobile/touch routes, BPM
dashboard, and envelope/modular automation panels. Legacy native
`input[type=range]` remains only in settings, face-tracker debug, and
low-traffic act editors.

### LAN / Pi Bridge (cloud to home Art-Net)

When using the hosted app at artbastard.aday.net.au, the cloud server cannot
reach Art-Net on your private LAN (for example 192.168.1.*). Run the
`bridge-agent` on a Raspberry Pi on that network; it connects outbound over
WSS and sends Art-Net locally. Optional Ableton Link on the Pi syncs tempo
with Live on the same LAN.

- Setup: Settings > Network > LAN Bridge (token + Art-Net target)
- Operator guide: DOCS/BRIDGE.md
- Multiple browsers can control the show at once; all clients share one DMX
  state and every change is forwarded to the bridge. Isolated multi-session /
  multi-tenant shows are planned for a later release.

### Production deploy (Linode)

The app runtime is on Linode Docker Compose, not Fly.io. GitHub Pages
hosts only the static showcase (`website/`).

1. Push `main` (or `dev` for pre-prod).
2. `artbastard-image` builds and pushes
   `ghcr.io/aday1/artbastard.aday.net.au/artbastard:live` (or `:dev`).
3. `deploy-linode` SSHs to the VPS, updates
   `~/compose/macroverse.aday.net.au`, and runs `docker compose pull` +
   `up` (services `artbastard_live` / `artbastard_test`).

Manual redeploy: GitHub Actions -> `deploy-linode` -> Run workflow.

### Rebuild baseline

The system rebuild is complete and production paths are consolidated:

- Single backend runtime lifecycle in the server entry path.
- Unified fixture persistence service used by API and runtime.
- API contract aligned for state, config, scenes, and factory reset flows.
- Super Control scene behaviour unified and scene capture indexing
  corrected.
- Timeline, clip launcher, and ACT trigger reliability fixes in place.
- DMX control page modularized for improved maintainability and
  large-universe usability.
- MIDI controller templates added:
  - Behringer X-Touch (Mackie mode + scribble strip SysEx labels)
  - Akai APC40 MK1
- Comprehensive in-app help, offline help mirror, and demo video pipeline
  shipped as part of the showcase refresh.
- Operator UI remaster with shared XY pads and styled faders (May 2026).

## UI/UX tour screens (release assets)

Ordered walkthrough labels:

1. DMX Control Home
2. Fixture Setup and Super Control
3. Scenes and Clip Launcher
4. Acts Timeline
5. Mobile Control Surface
6. Settings and In-App Help

Release page:
https://github.com/aday1/artbastard.aday.net.au/releases/latest

## Quick start

Requirements:

- Node.js 20+
- npm 10+

Install and run:

- `npm ci`
- `npm --prefix react-app ci`
- `./start.sh` (Linux / macOS) or `.\start.ps1` (Windows)

Reset to a fresh state:

- `./start.sh --reset`
- `.\start.ps1 -Reset`

App URL: http://localhost:3030

## In-app help

Press `Ctrl+H` from any page, or open Settings > Help. Covers DMX
basics, MIDI / OSC setup, scenes, timeline, clip launcher,
ACT triggers, controller templates, factory reset, mobile surface,
troubleshooting, keyboard shortcuts, and the printable
PDF address sheet. Offline mirror lives at DOCS/HELP.md.

## Useful scripts

- `npm run build`
- `npm run build-backend-fast`
- `npm run test:api-contract`
- `npm run test:touchosc-workflow`
- `npm run demo:capture-screenshots`
- `npm run demo:capture-videos`
- `npm run demo:evidence`
- `npm run demo:evidence-full`

## Documentation

- DOCS/README.md            - documentation index
- DOCS/INSTALL.md           - install + reset workflow
- DOCS/USAGE.md             - operator workflows
- DOCS/FEATURES.md          - feature inventory
- DOCS/FIXTURES.md          - fixture profiles + planning
- DOCS/HELP.md              - offline mirror of in-app help
- DOCS/SHORTCUTS.md         - master keyboard shortcut reference
- DOCS/MIDI_TEMPLATES.md    - X-Touch + APC40 mappings
- DOCS/APC40_CHEATSHEET.md  - APC40 Deck A/B live controller reference
- DOCS/OSC_REFERENCE.md     - SuperControl OSC address grid
- DOCS/SHOWCASE.md          - how the showcase + demo reel are built
- DOCS/HISTORY.md           - theatrical project history
