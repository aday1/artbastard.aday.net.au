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
| Scene 1-5              | Launch saved scene (or fill empty slot)             |
| REC (transport)        | Toggle SAVE mode → next scene-pad tap overwrites it |
| PLAY (transport)       | Toggle pick-A mode → next scene-pad tap = scene A   |
| STOP (transport)       | Toggle pick-B mode → next scene-pad tap = scene B   |
| Crossfader             | Blend between scene A and B                         |
| Channel faders 1-8     | Super Control: dim / pan / tilt / R / G / B / gobo / strobe |
| Master fader           | Global dimmer across every fixture                  |
| TRACK SELECT 1-8       | Pick fixture (or group) N                           |
| ACTIVATOR 1-8          | Toggle fixture N in multi-selection                 |
| SOLO 1-8               | Collapse selection to just fixture N                |
| PAN                    | Select all fixtures                                 |
| Nav ↑ / ↓              | Cycle fixtures                                      |
| Nav ← / →              | Cycle scenes                                        |
| SHIFT                  | Cancel any active mode                              |

LED meanings: scene pads green = saved, red-blink = active, orange-blink
= bound to crossfader A/B, green-blink = mode armed. Transport row LED
lights up to confirm which mode you're in (REC=save, PLAY=pickA, STOP=pickB).

## Notes

- Shortcuts that conflict with browser defaults (Ctrl+S, Ctrl+O, Ctrl+N)
  use `preventDefault` to keep the action inside the app.
- The `1-9` scene triggers fire only when no input is focused.
- Esc has different meanings depending on context (close help, deselect,
  stop playback, dismiss modal). The currently focused element wins.
