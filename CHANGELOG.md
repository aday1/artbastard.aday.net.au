# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added

- Project YAML round-trip extended to a full backup/restore: new `config.yaml` (Art-Net/OSC), `layout.yaml` (stage map + master sliders), and `presets.yaml` (browser preset library) sections. `Download all (full backup)` button bundles all eight files so a clean install can be losslessly restored.
- Fixture docs reorganised by category (`DOCS/fixtures/{LASER,LED-EFFECT,MOVING-HEAD,PAR,UV}/`) so the catalog can be browsed by type. Favourites unaffected — they reference stable fixture id.
- New fixture profiles: **AB-FIX-014** Mini Moving Head Gobo Light (light strips, 10/12-channel) and **AB-FIX-015** Mini Moving Head Gobo Spot (9/11-channel).
- Backend fixture loader/saver now recursively scans `data/fixtures/<Category>/` subdirectories so fixtures can be organised on disk without code changes.
- APC40 out-of-box mapping behavior now auto-applies the APC40 template on controller detection when SuperControl mappings are empty, so first connect is immediately usable.
- SuperControl MIDI mappings now persist in local storage and survive refresh/restart.
- APC40 Manual now includes a one-click `Reset to APC defaults` action.
- APC40 Manual now has `Control Focus` modes (`Off`, `Mapped + touched`, `Touched only`) to reduce visual noise during live operation.
- APC40 Manual tooltips now show fixture target context (slot-targeted fixture or all selected fixtures).

### Changed

- APC40 mapping metadata is consolidated into a shared module (`apc40Metadata.ts`) used by template generation and APC UI surfaces.
- APC40 Manual and APC surface assignment board now show default APC mapping reference even when the controller is disconnected or live mappings are not yet applied.

### Fixed

- Factory reset now fully removes per-fixture files in `data/fixtures/*.json` and emits `fixtureLayoutUpdate` / `groupsUpdated` clears, preventing stale stage fixtures from reappearing after reset.
- `deploy-linode` workflow now honors the effective lane ref (`dev` for dev track, `main` for live track) instead of always resetting the VPS repo to `main`.

## [5.2.4.0] - 2026-06-09 - APC40 Deck A/B live controller refactor

### Added

- APC40 Clip Launch / Session View is now a 40-slot Deck A scene grid.
- Holding SHIFT switches the grid to an independent 40-slot Deck B scene grid.
- APC40 Record Arm buttons arm columns; the next grid pad saves current DMX into the current Deck A/B scene slot.
- APC40 Scene Launch buttons now launch ACTS 1-5.
- APC40 crossfader blends the active Deck A scene with the active Deck B scene.
- APC40 Device Control knobs resolve selected fixture/group DMX roles with gobo/effects priority; Cue Level pages role banks.
- APC40 Activator buttons toggle per-group auto control, Solo/Cue isolates fixtures inside selected groups, and Master Select is a FULL ON latch.

### Changed

- Updated APC40 LED feedback, in-app graphical manual, fixture setup help, MIDI template docs, shortcuts, and rebuild references for the new surface layout.
- APC40 fallback template no longer maps Cue Level or crossfader to SuperControl fine-pan/fine-tilt roles.

## [5.2.0.2] - 2026-06-08 - Gold standard release with improved discoverability

### Added

- **QUICKSTART.md**: Single entry point for local development, Docker deployment, and hot-reload workflows. Agents and new users can now easily discover how to build locally or deploy to servers.
- **docker-compose.yml**: Portable Docker Compose configuration for offline server deployment with persistent volumes and health checks. Enables `docker compose pull && docker compose up -d` for any environment.
- **.env.example**: Documented environment variables for configuration (PORT, DMX interfaces, Art-Net settings, bridge URL). Improves discoverability and reduces setup friction.

### Changed

- Updated README.md and LOCAL_DEV.txt links to point to new QUICKSTART.md as the primary entry point.

### Documentation

This release marks the **gold standard** for ArtBastard v5.2 with:
- Full production deployment on Linode (LIVE + DEV lanes)
- DMX activity glow replacing GPU-heavy Sparkles layer
- Improved agent/server deployment discoverability
- Comprehensive Docker and environment documentation
- Future enhancements and fixes will build on this baseline

## [5.2.0.1] - 2026-06-08 - DMX activity glow performance patch

### Changed

- Removed the GPU-heavy Sparkles particle layer entirely.
- Replaced Sparkles with a single lightweight page glow when DMX channel values change.
- Renamed the settings control to DMX Activity Glow and made off/low/medium/high control glow intensity only.

### Removed

- Removed Sparkles ON/OFF from the desktop navbar, mobile drawer, and app context menu.
- Removed the duplicated Sparkles render path inside the master fader.

## [5.2.0.0] - 2026-06-08 - Confirmed live/dev ArtBastard line

This is the current state-of-the-art ArtBastard build for both live and dev lanes. The separate beta identity is retired; develop on dev, promote to live, and keep both labels visibly tied to the same ArtBastard codebase.

### Added

- Compact DMX strip visibility: unused channels can be hidden while fixture-assigned, selected, pinned, active, named, MIDI, and OSC channels remain available.
- One-tap fallback to reopen the full 512-channel DMX strip.
- Independent toggles for the active-channel tracker strip, envelope editor, and DMX transition pattern tracker.

### Fixed

- Refreshed stale deploy wording from Beta/dev to Dev/live.
- Kept the fixture library and show-map work as the canonical built-in source of truth.

## [5.1.2.0] - 2026-05-19 — Stable hosted release (DMX512)

First **stable** line under dev / live lanes on Linode (GHCR). Version **5.1.2.0** nods to **DMX512** (5 · 1 · 2). Supersedes interim 5.1.2.x hotfix tags; develop on this line with fewer micro-releases.

### Added

- Official hosted stack: Linode compose, GHCR images, deploy-meta dev/live sync, Pi LAN bridge.
- Reason-style rack UI, Macroverse workbench envelopes, DMX transition tracker, live theme API.
- Channel role icons, fixture-aware tracker lanes, pinned sidebar notched faders.
- Resizable dock/floating panels; mobile defaults to Canvas DMX tab.

### Fixed

- Settings: theme preview no longer triggers React max update depth (#185).
- Layout: single main scrollbar; page bodies scroll inside the layout (flex min-height / overflow).
- Faders: larger channel and pinned vertical thumbs; fixture tick slot/fine/full triple.
- Touch: `touch-action` isolation on DMX faders so drags do not scroll the page; iOS drag guard.
- Range sliders: legacy 6px height conflict removed for `ab-dmx-range` horizontal faders.
- Pinned vertical faders keep usable track height; channel window handles improved for touch.

## Pre-release relics (development archaeology)

Interim version numbers below were never official shipping tags; they describe work consolidated into **5.1.2.0**.

See git history before the official hosted era for relic commit messages (DMX desk prototype through deploy-meta).
