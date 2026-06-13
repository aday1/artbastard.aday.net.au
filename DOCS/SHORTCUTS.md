# ArtBastard Keyboard Shortcuts

Master shortcut reference for v5.12.0. The same content is reachable in-app
from Help > Shortcuts (Ctrl+H to open Help).

## General

| Shortcut         | Action                                          |
| ---------------- | ----------------------------------------------- |
| Ctrl + H         | Toggle the Help overlay                         |
| Ctrl + /         | Focus the search box inside Help                |
| Esc              | Close Help / cancel current action              |
| ?                | Show keyboard shortcuts modal                   |
| F11              | Toggle fullscreen                               |
| Space            | Emergency blackout (or play/pause in timeline)  |
| Ctrl + Z         | Undo                                            |
| Ctrl + Y         | Redo                                            |
| Ctrl + Shift + Z | Redo (alt)                                      |
| Ctrl + C / V / X | Copy / Paste / Cut                              |

## Navigation

| Shortcut       | Action                              |
| -------------- | ----------------------------------- |
| 1              | Go to DMX Control                   |
| 2              | Go to Scenes & Acts                 |
| 3              | Go to Fixture Setup                 |
| 4              | Go to MIDI / OSC                    |
| Tab            | Cycle through panels                |
| Ctrl + Tab     | Switch panel focus                  |
| Ctrl + F       | Find / filter fixtures              |

## Scenes

| Shortcut         | Action                       |
| ---------------- | ---------------------------- |
| Ctrl + S         | Quick save scene             |
| Ctrl + O         | Load scene                   |
| Ctrl + N         | Create new scene             |
| 1 - 9            | Trigger scene 1-9            |
| Ctrl + 1-9       | Save to scene slot 1-9       |
| Shift + 1-9      | Delete scene 1-9             |

## DMX Control

| Shortcut         | Action                          |
| ---------------- | ------------------------------- |
| B                | Toggle blackout                 |
| M                | Toggle Master Fader             |
| 0                | Zero all faders                 |
| Ctrl + A         | Select all channels             |
| Esc              | Deselect all channels           |
| Up / Down        | Adjust selected fader           |
| Shift + Up/Down  | Fine-adjust selected fader      |

## Timeline Editor

| Shortcut             | Action                                   |
| -------------------- | ---------------------------------------- |
| Space                | Play / Pause timeline                    |
| Esc                  | Stop timeline playback                   |
| Home                 | Jump to start                            |
| End                  | Jump to end                              |
| Shift + Left/Right   | Nudge playhead or selected keyframes     |
| K                    | Add keyframe at the playhead             |
| Ctrl + C             | Copy selected keyframes                  |
| Ctrl + V             | Paste keyframes                          |
| Delete               | Delete selected keyframes                |
| Ctrl + Z / Y         | Undo / Redo timeline change              |
| Ctrl + A             | Select all keyframes                     |
| Ctrl + + / -         | Zoom in / out                            |
| Ctrl + 0             | Reset zoom                               |
| F11                  | Toggle fullscreen timeline               |

## Automation

| Shortcut | Action              |
| -------- | ------------------- |
| A        | Toggle automation   |
| P        | Toggle autopilot    |

## APC40 MK1 (hardware shortcuts)

The APC40's live integration mirrors a lot of the app onto the surface.
Full reference: [APC40_CHEATSHEET.md](APC40_CHEATSHEET.md). Quick gestures:

| Button                 | Action                                              |
| ---------------------- | --------------------------------------------------- |
| Clip grid 8x5          | Launch 40 Deck A scene slots                        |
| SHIFT + clip grid      | Launch/save 40 Deck B scene slots                   |
| REC then clip grid     | Save current DMX into the pressed deck slot         |
| SHIFT+REC              | Roll random DMX values for preview only             |
| Record Arm 1-8         | Solo Group latch                                    |
| Scene Launch 1-5       | Launch ACT 1-5                                      |
| Stop All Clips         | Stop Deck A/B scenes and ACT playback               |
| Clip Stop row          | Stop/unselect current deck scene                    |
| Crossfader             | Blend active Deck A scene with active Deck B scene  |
| Channel faders 1-8     | Super Control: selected fixture slot dimmers        |
| Master fader           | Super Control: selected DIMMER/masterDimmer         |
| Master Select          | FREEZE DMX latch; press again unfreezes output      |
| Device Control 1-8     | Dynamic gobo/effects/DMX roles for selection        |
| Cue Level              | Page Device Control role banks                      |
| TRACK SELECT 1-8       | Pick fixture group N                                |
| ACTIVATOR 1-8          | Toggle APC40 auto mode for group N                  |
| SOLO/CUE 1-8           | Solo fixture N inside the selected group            |
| PAN                    | Select all fixtures                                 |
| Nav ↑ / ↓              | Cycle fixtures                                      |
| Nav ← / →              | Cycle scenes                                        |
| SHIFT                  | Hold for Deck B                                     |

LED meanings: grid pads green = saved, orange-blink = active deck scene,
red-blink = record-armed save column. Scene Launch pads green = ACT exists,
orange-blink = ACT playing. Activator orange-blink = group auto active.

## Notes

- Shortcuts that conflict with browser defaults (Ctrl+S, Ctrl+O, Ctrl+N)
  use `preventDefault` to keep the action inside the app.
- The `1-9` scene triggers fire only when no input is focused.
- Esc has different meanings depending on context (close help, deselect,
  stop playback, dismiss modal). The currently focused element wins.
