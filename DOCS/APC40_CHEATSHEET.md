# APC40 MK1 Cheatsheet

The APC40 live integration runs through `react-app/src/hooks/useApc40Workflow.ts`
and `react-app/src/hooks/useApc40LedFeedback.ts`. It is designed for the AKAI
APC40 MK1 factory MIDI mode and works without applying a MIDI template.

## Surface map

```
                TRACK CONTROL KNOBS        DEVICE CONTROL KNOBS
                leftover SuperControl      selected fixture DMX roles
                pan/tilt/RGB/W/strobe      gobo, wheel, prism, iris,
                speed                      focus, zoom, effects

  RECORD ARM   [arm col 1] ... [arm col 8]   next grid press saves current deck
  SOLO/CUE     [fixture 1] ... [fixture 8]   solo inside selected fixture group
  ACTIVATOR    [auto grp1] ... [auto grp8]   per-group auto visual control
  TRACK SELECT [group 1] ... [group 8]       fixture group selection
  CLIP STOP    [stop col1] ... [stop col8]   release current deck scene

  FADERS       [slot 1] ... [slot 8]         SuperControl dimmer per selected slot
  MASTER BTN   FULL ON latch                 press again restores previous DMX
  MASTER FADER selected DIMMER/masterDimmer  not a raw-all-channel fader

  CLIP GRID / SESSION VIEW
  Deck A by default: 40 ArtBastard scene slots
  Hold SHIFT:        40 independent Deck B scene slots

  SCENE LAUNCH 1-5   ACT 1-5 launch
  STOP ALL CLIPS     stop Deck A/B scenes and stop ACT playback
  CROSS FADER        blend active Deck A scene with active Deck B scene
  CUE LEVEL          page Device Control role banks
```

## At a glance

| Control | Function | LED feedback |
| --- | --- | --- |
| **Clip Launch / Session View 8x5** | Launch Deck A scene slots `APC40 Deck A 01` through `APC40 Deck A 40` | green = saved, orange-blink = active deck scene, off = empty |
| **SHIFT + Clip Grid** | Hold SHIFT to use Deck B scene slots `APC40 Deck B 01` through `APC40 Deck B 40` | SHIFT orange while held; grid repaints for Deck B |
| **Record Arm 1-8** | Arm a grid column. Next grid pad in that column saves current DMX into the current deck slot | red on armed columns; armed grid pads blink |
| **Scene Launch 1-5** | Launch ACT 1-5 | green = ACT exists, orange-blink = playing ACT |
| **Clip Stop row** | Stop/unselect the active scene for that column in the current deck | red while a deck scene is active |
| **Stop All Clips** | Stop Deck A scene, Deck B scene, scene timeline playback, and ACT playback | red while a deck scene or ACT is active |
| **Track Select 1-8** | Select fixture group 1-8; falls back to fixture 1-8 | green when that group/fixture is selected |
| **Master Track Select** | FULL ON latch: sends 255 to fixture output channels, excluding lamp/reset/function controls | red while FULL ON is latched |
| **Faders 1-8** | SuperControl dimmer for selected fixture slot 1-8 | n/a |
| **Master fader** | SuperControl `masterDimmer`/DIMMER for current selection | n/a |
| **Device Control knobs 1-8** | Dynamic fixture role controls, prioritizing gobo/effects roles for the selected fixture/group | in-app APC40 manual labels current roles |
| **Cue Level** | Pages Device Control role banks | n/a |
| **Solo/Cue 1-8** | Solo fixture 1-8 inside the currently selected group; press same solo again to restore selection | momentary |
| **Activator 1-8** | Toggle APC40 auto control for fixture group 1-8 | green = group exists, orange-blink = auto active |
| **Crossfader** | Linear DMX blend between active Deck A and active Deck B scenes | n/a |
| **Nav up/down** | Previous/next fixture | n/a |
| **Nav left/right** | Previous/next ArtBastard scene | n/a |
| **Pan** | Select all fixtures | n/a |

## Scene decks

Deck scene names are stable and explicit:

- Deck A slot 1: `APC40 Deck A 01`
- Deck A slot 40: `APC40 Deck A 40`
- Deck B slot 1: `APC40 Deck B 01`
- Deck B slot 40: `APC40 Deck B 40`

Use **Seed Scenes** after placing fixtures on the stage canvas to fill these
slots quickly:

- **Smart Starter 40** fills one deck with fixture-aware looks like `Red Slow`,
  `Wash Fast`, `Gobo Texture`, and `Strobe All Move 90`.
- **Smart A+B 80** fills both decks with crossfader-friendly variants.
- **Compact Starter 16** fills the first 16 slots only.
- Optional automated timelines use safe fixture roles for dimmer pulses,
  movement, color cycling, gobo rotation, and strobe movement.

Generated scenes keep the APC40 slot names for live-mode compatibility, while
the Scene Gallery displays the readable template label. Reseeding replaces only
generated scenes; handmade slot scenes are skipped and kept.

After scenes exist, use **Seed ACTS** in `#/acts` if you want optional ACTS for
the APC40 Scene Launch row. **Starter ACTS 5** creates five ready-made ACTS
mapped naturally to Scene Launch 1-5: Color Warmup, Red Slow, Wash Fast, Gobo
Texture, and Strobe Move 90. **Performance ACTS 8** adds longer show-section
ACTS. Reseeding refreshes generated ACTS only; handmade ACTS are kept. You can
ignore ACT seeds completely when building a show from scratch.

To save a scene:

1. Choose the deck: leave SHIFT released for Deck A, hold SHIFT for Deck B.
2. Press **Record Arm** for the grid column you want to save into.
3. Press a grid pad in that armed column.
4. ArtBastard saves the current DMX state into that deck slot name.

To launch a scene, press any saved grid pad in the current deck. Empty pads
warn instead of silently creating scenes; that keeps accidental scene capture
from happening during a show.

## Crossfader

Press a saved Deck A grid slot, then hold SHIFT and press a saved Deck B grid
slot. The crossfader blends the two active deck scenes channel by channel:

- 0 = full Deck A
- 127 = full Deck B
- middle values = linear DMX blend

The blend writes DMX directly through the batch DMX API. It does not rename or
delete scenes.

## Super Control

### Faders

Channel faders are intentionally simple:

| Fader | SuperControl target |
| --- | --- |
| 1 | Selected fixture slot 1 DIMMER |
| 2 | Selected fixture slot 2 DIMMER |
| 3 | Selected fixture slot 3 DIMMER |
| 4 | Selected fixture slot 4 DIMMER |
| 5 | Selected fixture slot 5 DIMMER |
| 6 | Selected fixture slot 6 DIMMER |
| 7 | Selected fixture slot 7 DIMMER |
| 8 | Selected fixture slot 8 DIMMER |
| Master | Current selection `masterDimmer` / DIMMER |

### Device Control

Device Control knobs resolve roles from the currently selected fixture/group.
Gobo and visual-effect roles come first so the operator can see where the gobo
or wheel position is when a fixture group is selected.

Priority order begins with:

`gobo`, `gobo_rotation`, `color_wheel`, `prism`, `iris`, `focus`, `zoom`,
`strobe`, `macro`, `speed`, then fine pan/tilt and color channels.

Turn **Cue Level** to page through additional roles if the selected fixture
has more than eight useful DMX roles.

## Automation row

**Activator 1-8** toggles a small APC40-local auto controller for fixture group
1-8. The auto controller chooses a visual role for that group, preferring
gobo/effect/color-wheel/prism/strobe channels. If a group has none of those,
it falls back to a dimmer breathe.

This is separate from scene playback and can be stopped by pressing the same
Activator again.

## Stop behavior

- **Clip Stop** stops the active scene for the current deck, scoped to the
  pressed column when possible.
- **Stop All Clips** clears Deck A and Deck B active scene assignments,
  stops scene timeline playback, and stops ACT playback.
- Stop All Clips does not delete saved scenes.

## LED legend

| Velocity | Color | Meaning |
| --- | --- | --- |
| 0 | off | empty/inactive |
| 1 | green | saved deck slot or saved ACT/group exists |
| 2 | green-blink | empty grid slot in an armed record column |
| 3 | red | record arm, stop-all, or full-on active |
| 4 | red-blink | saved grid slot in an armed record column |
| 5 | orange | SHIFT/full deck context |
| 6 | orange-blink | active deck scene, playing ACT, or active group auto |

## Debugging

Open the in-app Help overlay and choose the APC40 visual reference. It shows
the live deck, Deck A/B scene names, armed columns, Device Control role labels,
ACT state, and the last MIDI messages received.
