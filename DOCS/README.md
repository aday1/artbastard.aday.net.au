# ArtBastard Documentation Index

Reference set for v5.2.12.0 - Hard Version Bump. Reflects the
state of the system after the SuperControl layout rebuild, cream/synthwave
light theme, footer monitor consolidation, DMX Tracker feature flagging, and
APC40 ON/OFF button semantics on 2026-06-14.

## Start here

- INSTALL.md      - environment setup, launch scripts, and reset workflow.
- USAGE.md        - operator workflows, routes, timeline + clip launcher,
                    controller templates, troubleshooting.
- ACT_TIMELINE.md - act timeline editor, gaps, ACT triggers vs BPM vs Link.
- FEATURES.md     - feature inventory by subsystem.
- BRIDGE.md       - LAN / Pi bridge (cloud UI to home Art-Net + Link).
- FIXTURES.md     - fixture profiles, addressing, multi-universe planning.
- STAGE_CANVAS_TUTORIAL.md - map-first show creation from fixture placement
                    through groups, seeds, Super Control, APC40, and debugging.
- HELP.md         - offline mirror of the in-app HelpOverlay.
- SHORTCUTS.md    - master keyboard shortcut reference.

## Reference

- MIDI_TEMPLATES.md - X-Touch Mackie + APC40 MK1 mapping reference.
- APC40_CHEATSHEET.md - APC40 Deck A/B live controller reference.
- OSC_REFERENCE.md  - SuperControl OSC address grid.
- HISTORY.md        - theatrical project history.
- ../AGENTS.md      - cloud-agent / dev-environment crib sheet.

## Showcase and demos

- SHOWCASE.md       - how the public showcase + how-to videos are produced.
- DEMO_RECORDING.txt - capturing screenshots and videos.
- UI_UX_TOUR.txt    - per-screen action notes for the recorded tour.
- ../website/videos/ - six WebM operator clips + JPG posters.

## Operator video walkthrough

The ordered how-to video set is embedded on the public showcase site.
Watch order:

1. Stage Canvas and Super Control - place fixtures, build groups, drive roles.
2. DMX Control Home - use channel faders, filters, master, MIDI, and OSC.
3. Scenes and Clip Launcher - capture scenes and launch APC40 Deck A/B slots.
4. Acts Timeline - build show sequences with scene clips, gaps, MIDI, and OSC.
5. Mobile Control Surface - operate the touch-first remote surface.
6. Settings and In-App Help - configure network/theme/bridge and find help.

Release page:
https://github.com/aday1/artbastard.aday.net.au/releases/latest

Public showcase:
- Quick-jump hub: https://aday1.github.io/artbastard.aday.net.au/
- Full showcase: https://aday1.github.io/artbastard.aday.net.au/

## Validation commands

Run from the repository root:

- npm run build
- npm run test:api-contract
- npm run test:bridge-smoke
- npm run test:touchosc-workflow
- npm run demo:capture-screenshots
- npm run demo:capture-videos
- npm run demo:evidence
- npm run demo:evidence-full

`demo:evidence-full` is the new umbrella command that runs the smoke tests,
captures screenshots, and captures videos in one shot. Useful when
preparing release artefacts.

## In-app help

Inside the running app, open Settings > Help or press `Ctrl+H` from any
page. The help overlay covers the canvas-first fixture workflow, DMX basics,
MIDI, OSC, APC40 live mode, scenes, timeline, clip launcher, ACT triggers,
controller templates, factory reset, mobile surface, troubleshooting, keyboard
shortcuts, and the printable PDF address sheet.
