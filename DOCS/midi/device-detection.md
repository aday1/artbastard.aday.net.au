---
spec: device-detection
version: 1
---

# Device Detection Spec

Maps MIDI device names (lowercased substring match) to controller kinds.
Multiple patterns per kind; first match wins; order in the table is the
match priority.

Edits regenerate `react-app/src/midi/generated/deviceDetectionSpec.ts`.

## Patterns

| kind          | pattern       |
|---------------|---------------|
| apc40         | apc40         |
| apc40         | apc 40        |
| roli-lightpad | lightpad      |
| roli-lightpad | roli          |
| roli-lightpad | block         |
| roli-lightpad | seaboard      |

## Template hints

Detection only chooses a `kind`. The auto-template apply layer
(`useGlobalBrowserMidi.ts:61-92`) maps a kind plus a name further into a
`MidiControllerTemplateId`. The patterns below mirror that mapping today;
extend here when adding new templates.

| pattern  | templateId      |
|----------|-----------------|
| x-touch  | x_touch_mackie  |
| x touch  | x_touch_mackie  |
| xtouch   | x_touch_mackie  |
| apc40    | apc40_mk1       |
| apc 40   | apc40_mk1       |
