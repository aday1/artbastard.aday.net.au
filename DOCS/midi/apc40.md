---
spec: apc40
version: 1
models:
  - id: apc40-mk1
    detect: ['apc40', 'apc 40']
  - id: apc40-mk2
    detect: ['apc40 mkii', 'apc40 mk2', 'apc40ii']
init:
  sendDeviceInquiry: true
  modeInitSysExHex: 'F0 47 7F 73 60 00 04 40 09 04 01 F7'
grid:
  rows: 5
  cols: 8
  slotsPerDeck: 40
sceneNaming:
  pattern: 'APC40 Deck {deck} {slot:02}'
  decks: ['A', 'B']
transport:
  shift: 0x62
  play: 0x5b
  stop: 0x5c
  record: 0x5d
  recordAlt: 0x66
  detailView: 0x3e
  recQuantization: 0x3f
  midiOverdub: 0x40
  metronome: 0x41
  navFixturePrev: 0x5e
  navFixtureNext: 0x5f
  navScenePrev: 0x60
  navSceneNext: 0x61
  selectAll: 0x57
  stopAll: 0x51
  masterButton: 0x33 # channel 8 note fallback; Ch 9 CC20 burst toggles DMX FREEZE in some modes
master:
  master: 0x0e
  crossfader: 0x0f
  cue: 0x2f
---

# Akai APC40 Spec

This file is the source of truth for APC40 MK1/MK2 detection, init,
addressing, and message decoding. Edits regenerate
`react-app/src/midi/generated/apc40Spec.ts`.

The control surface, deck behavior, and recovery procedures for operators
live in `DOCS/APC40_CHEATSHEET.md` and `DOCS/APC40_GOLD_STANDARD.md`. This
file describes *what the bytes mean*; those describe *what the operator sees*.

## Note bindings

`channels` is either an inclusive range `0..7` or a single integer. `action`
must match a variant of `Apc40Action` (see `react-app/src/midi/apc40.ts`).
`velocityCheck: gt0` requires `velocity > 0` (filters note-off via note-on).

| controlKey      | channels | note   | action          | velocityCheck |
|-----------------|----------|--------|-----------------|---------------|
| clip-mk1        | 0..7     | 0x35   | clip-launch     | gt0           |
| clip-mk1        | 0..7     | 0x36   | clip-launch     | gt0           |
| clip-mk1        | 0..7     | 0x37   | clip-launch     | gt0           |
| clip-mk1        | 0..7     | 0x38   | clip-launch     | gt0           |
| clip-mk1        | 0..7     | 0x39   | clip-launch     | gt0           |
| record-arm      | 0..7     | 0x30   | solo-group      | press-release |
| select-fixture  | 0..7     | 0x31   | select-fixture  | press-release |
| select-group    | 0..7     | 0x32   | select-group    | press-release |
| track-stop      | 0..7     | 0x34   | track-stop      | gt0           |
| full-on         | 0        | 0x3a   | full-on         | press-release |
| blackout        | 0        | 0x3b   | blackout        | press-release |
| bank-prev       | 0        | 0x3c   | bank-prev       | gt0           |
| bank-next       | 0        | 0x3d   | bank-next       | gt0           |
| freeze-dmx      | 0        | 0x3e   | freeze-dmx      | press-release |
| record          | 0        | 0x3f   | record          | gt0           |
| stop-all-clips  | 0        | 0x40   | stop-all-clips  | gt0           |
| tap-tempo       | 0        | 0x41   | tap-tempo       | gt0           |
| scene-launch    | 0        | 0x52   | scene-launch    | gt0           |
| scene-launch    | 0        | 0x53   | scene-launch    | gt0           |
| scene-launch    | 0        | 0x54   | scene-launch    | gt0           |
| scene-launch    | 0        | 0x55   | scene-launch    | gt0           |
| scene-launch    | 0        | 0x56   | scene-launch    | gt0           |
| stop-all-clips  | 0        | 0x51   | stop-all-clips  | gt0           |
| shift           | any      | 0x62   | shift           | press-release |
| play            | any      | 0x5b   | play            | gt0           |
| stop            | any      | 0x5c   | stop            | gt0           |
| record          | any      | 0x5d   | record          | gt0           |
| record          | any      | 0x66   | record          | gt0           |
| nav-fixture     | any      | 0x5e   | nav-fixture-prev| gt0           |
| nav-fixture     | any      | 0x5f   | nav-fixture-next| gt0           |
| nav-scene       | any      | 0x60   | nav-scene-prev  | gt0           |
| nav-scene       | any      | 0x61   | nav-scene-next  | gt0           |
| select-all      | any      | 0x57   | select-all      | press-release |
| toggle-color-auto    | any | 0x58   | toggle-color-auto    | press-release |
| toggle-pan-tilt-auto | any | 0x59   | toggle-pan-tilt-auto | press-release |
| toggle-effect-auto   | any | 0x5a   | toggle-effect-auto   | press-release |
| tap-tempo       | any      | 0x63   | tap-tempo       | gt0           |
| nudge-up        | any      | 0x64   | nudge-up        | gt0           |
| nudge-down      | any      | 0x65   | nudge-down      | gt0           |

The two `clip-mk1` overloads describe the MK1 grid layout (note `0x35 + row`,
channel = column). For MK2 the grid lives at note `0x00..0x27` on channel 0 —
encoded by the model-specific decoder rather than table rows because the
mapping is purely arithmetic.

## CC bindings

`action` is the `Apc40Action` variant. Output rows marked `(out)` are LED
feedback sends, not inputs; they are listed here to keep all CC addressing
in one table.

| controlKey       | channels | cc       | action          | direction |
|------------------|----------|----------|-----------------|-----------|
| channel-fader    | 0..7     | 0x07     | channel-fader   | in        |
| master-fader     | 0        | 0x0e     | master-fader    | in        |
| crossfader       | 0        | 0x0f     | crossfader      | in        |
| device-control   | 0        | 0x10     | device-control  | in        |
| device-control   | 0        | 0x11     | device-control  | in        |
| device-control   | 0        | 0x12     | device-control  | in        |
| device-control   | 0        | 0x13     | device-control  | in        |
| device-control   | 0        | 0x14     | device-control  | in        |
| device-control   | 0        | 0x15     | device-control  | in        |
| device-control   | 0        | 0x16     | device-control  | in        |
| device-control   | 0        | 0x17     | device-control  | in        |
| device-ring      | 0        | 0x18     | ring-led        | out       |
| device-ring      | 0        | 0x19     | ring-led        | out       |
| device-ring      | 0        | 0x1a     | ring-led        | out       |
| device-ring      | 0        | 0x1b     | ring-led        | out       |
| device-ring      | 0        | 0x1c     | ring-led        | out       |
| device-ring      | 0        | 0x1d     | ring-led        | out       |
| device-ring      | 0        | 0x1e     | ring-led        | out       |
| device-ring      | 0        | 0x1f     | ring-led        | out       |
| track-control    | 0        | 0x30     | track-control   | in        |
| track-control    | 0        | 0x31     | track-control   | in        |
| track-control    | 0        | 0x32     | track-control   | in        |
| track-control    | 0        | 0x33     | track-control   | in        |
| track-control    | 0        | 0x34     | track-control   | in        |
| track-control    | 0        | 0x35     | track-control   | in        |
| track-control    | 0        | 0x36     | track-control   | in        |
| track-control    | 0        | 0x37     | track-control   | in        |
| track-ring       | 0        | 0x38     | ring-led        | out       |
| track-ring       | 0        | 0x39     | ring-led        | out       |
| track-ring       | 0        | 0x3a     | ring-led        | out       |
| track-ring       | 0        | 0x3b     | ring-led        | out       |
| track-ring       | 0        | 0x3c     | ring-led        | out       |
| track-ring       | 0        | 0x3d     | ring-led        | out       |
| track-ring       | 0        | 0x3e     | ring-led        | out       |
| track-ring       | 0        | 0x3f     | ring-led        | out       |

The track-control encoder ring LEDs (0x38-0x3f) are output-only. The
hardware also emits CC presses on these same addresses when the encoders
are pushed, but we intentionally do **not** map the push CC aliases: the
APC40's mode behavior in that range is unreliable and would silently
rewrite DMX. Fixture/group selection lives on the Solo/Cue and Activator
rows instead. The physical Track Select note row selects fixed Color Wheel
slots for the selected color-wheel fixture.

## Device knob role assignments (default)

Device Control knobs map to fixture-role slots when no per-fixture override
is in effect. `controlName` must be a SuperControl role name from
`react-app/src/components/midi/midiControllerTemplates.ts`.

| slot | cc   | controlName    | roleLabel       |
|------|------|----------------|-----------------|
| 0    | 0x10 | gobo           | Gobo            |
| 1    | 0x11 | gobo_rotation  | Gobo Rotate     |
| 2    | 0x12 | color_wheel    | Color Wheel     |
| 3    | 0x13 | prism          | Prism           |
| 4    | 0x14 | iris           | Iris            |
| 5    | 0x15 | focus          | Focus           |
| 6    | 0x16 | zoom           | Zoom            |
| 7    | 0x17 | strobe         | Strobe/Shutter  |

## Operator-facing control catalog

`category` is one of: `selection`, `scene`, `transport`, `utility`, `nav`.

| key            | category   | label                                | description                                                                                                                                          |
|----------------|------------|--------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| clipGrid       | scene      | Clip Grid / Session View (8x5)       | Launch 40 Deck A scene slots. Hold SHIFT to launch/save the matching 40 Deck B scene slots.                                                          |
| sceneLaunch    | scene      | Scene Launch (1-5)                   | Launch ACT 1-5. Stop All Clips stops any currently playing ACT.                                                                                      |
| recordArm      | selection  | Record Arm row \u2014 SOLO GROUP (1-8)  | Latch: solo group N. Snapshots DMX on first solo, blacks out fixtures not in soloed groups, restores snapshot when last solo released.            |
| selectFixture  | selection  | Solo/Cue (1-8) \u2014 select FIXTURE      | Select fixture N (positional). Each column maps to `fixtures[N]`.                                                                                    |
| selectGroup    | selection  | Activator (1-8) \u2014 select GROUP       | Select fixture group N (positional). Each column maps to `groups[N]`.                                                                                |
| trackSelect    | effect     | Track Select (1-8) \u2014 Color Wheel slots | Select fixed color-wheel slots for the selected MiniBeam / color-wheel fixture. Buttons spread across the fixture's available fixed wheel colours.    |
| trackStop      | utility    | Clip Stop row                        | Stop/unselect the active scene in that column for the current deck.                                                                                  |
| stopAll        | utility    | Stop All Clips                       | Stop all Deck A/B scenes and ACT playback.                                                                                                           |
| masterButton   | utility    | Master Select \u2014 FREEZE DMX           | Press once to freeze DMX output and light the Master LED; press again to unfreeze and flush current store state. APC40 MK1 may emit this as Ch 9 CC20 instead of Note 0x33. |
| fullOn         | effect     | Clip/Track \u2014 FULL ON                | ON raises patched fixture channels to 255 and snapshots prior DMX; OFF restores the snapshot.                                                        |
| blackout       | effect     | Device On/Off \u2014 BLACKOUT             | ON snapshots DMX and zeros all channels; OFF restores. LED on the device lights while latched.                                                       |
| freezeDmx      | utility    | Detail View \u2014 FREEZE DMX             | ON freezes DMX output while UI/store continues; OFF releases and flushes current state to backend.                                                   |
| recQuant       | scene      | Rec Quantization \u2014 save mode         | Alias for REC save mode.                                                                                                                             |
| midiOverdub    | utility    | MIDI Overdub \u2014 panic stop            | Alias for Stop All Clips.                                                                                                                            |
| metronome      | transport  | Metronome \u2014 tap tempo                | Alias for Tap Tempo.                                                                                                                                 |
| deviceBank     | device     | Device Left / Right \u2014 bank cycle    | Cycle the Device Control role bank backwards/forwards (replaces Cue Level for this purpose).                                                         |
| cueLevel       | scene      | Cue Level \u2014 automation direction    | Endless rotary; CW step sets global automationDirection=forward, CCW step sets reverse. Inverts AutoScene index advance and pan/tilt autopilot track. |
| transport      | scene      | PLAY \u2014 start Auto Scene             | PLAY enables Auto Scene playback (uses the existing list and tempo source). STOP disables it. Stop All Clips is the panic-safe stop.                |
| stopTransport  | scene      | STOP \u2014 stop Auto Scene              | STOP disables Auto Scene playback. Stop All Clips still clears Deck A/B and ACT playback.                                                            |
| tapTempo       | transport  | Tap Tempo                            | Tap on the beat. Each tap records a tempo sample and switches the Auto Scene tempo source to Tap Tempo.                                              |
| nudge          | transport  | Nudge\u2212 / Nudge+                       | Decrease or increase the Auto Scene manual BPM by 1. Switches tempo source to Manual BPM.                                                            |
| colorAuto      | effect     | SEND A \u2014 Color Automation          | ON enables color automation; OFF disables it. SHIFT+SEND A cycles the color pattern.                                                                  |
| panTiltAuto    | effect     | SEND B \u2014 Pan/Tilt Automation       | ON enables pan/tilt automation; OFF disables it. SHIFT+SEND B cycles the pan/tilt path.                                                               |
| effectsAuto    | effect     | SEND C \u2014 Effects Automation        | ON enables effects automation; OFF disables it. SHIFT+SEND C cycles the effect type.                                                                  |
| record         | scene      | REC \u2014 save mode / roll dice        | Plain press enters/exits clip-grid save mode. SHIFT+REC rolls a fresh randomized look (random hue + dimmer + pan/tilt per fixture) live to DMX for preview \u2014 nothing is saved until the operator presses REC, then a clip pad. Hold SHIFT only for the clip-pad press to save Deck B. |
| navFixture     | nav        | Up / Down arrows                     | Cycle through fixtures: Up = previous, Down = next.                                                                                                  |
| navScene       | nav        | Left / Right arrows                  | Cycle through scenes: Left = previous, Right = next.                                                                                                 |
| selectAll      | selection  | Pan button                           | ON selects all fixtures; OFF clears fixture selection.                                                                                                |
| clear          | selection  | Clear Selection                      | Deselects all fixtures.                                                                                                                              |
| shift          | utility    | Shift                                | Modifier reserved for shift-combos and Deck A/B toggle on the clip grid.                                                                             |
