# ArtBastard Documentation Index

Reference set for v5.15.0 - Tracker Columns Edition. Reflects the
state of the system after the rebuild consolidation (2026-02-27 onward)
and the operator UI remaster (2026-05-16).

## Start here

- INSTALL.md      - environment setup, launch scripts, and reset workflow.
- USAGE.md        - operator workflows, routes, timeline + clip launcher,
                    controller templates, troubleshooting.
- ACT_TIMELINE.md - act timeline editor, gaps, ACT triggers vs BPM vs Link.
- FEATURES.md     - feature inventory by subsystem.
- BRIDGE.md       - LAN / Pi bridge (cloud UI to home Art-Net + Link).
- FIXTURES.md     - fixture profiles, addressing, multi-universe planning.
- HELP.md         - offline mirror of the in-app HelpOverlay.
- SHORTCUTS.md    - master keyboard shortcut reference.

## Reference

- MIDI_TEMPLATES.md - X-Touch Mackie + APC40 MK1 mapping reference.
- OSC_REFERENCE.md  - SuperControl OSC address grid.
- HISTORY.md        - theatrical project history.
- ../AGENTS.md      - cloud-agent / dev-environment crib sheet.

## Showcase and demos

- SHOWCASE.md       - how the public showcase + demo reel are produced.
- DEMO_RECORDING.txt - capturing screenshots and videos.
- UI_UX_TOUR.txt    - per-screen action notes for the recorded tour.
- ../website/videos/ - five WebM demo clips + JPG posters.

## Release walkthrough

The ordered demo reel is also embedded on the public showcase site and
hosted with the v5.15.0 release. Tour order:

1. DMX Control Home
2. Fixture Setup and Super Control
3. Scenes and Acts
4. Mobile Control Surface
5. Settings and In-App Help

Release page:
https://github.com/aday1/artbastard.aday.net.au/releases/tag/v5.15.0

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
page. The help overlay covers DMX basics, MIDI, OSC, TouchOSC, scenes,
timeline, clip launcher, ACT triggers, controller templates, factory
reset, mobile / external console, troubleshooting, keyboard shortcuts,
and the printable PDF address sheet.
