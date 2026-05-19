# Changelog

All notable changes to this project are documented here.

## [Unreleased]

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
