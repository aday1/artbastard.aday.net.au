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

  RECORD ARM   [solo grp1] ... [solo grp8]   latched Solo-Group blackout of non-soloed fixtures
  SOLO/CUE     [fixture 1] ... [fixture 8]   select fixture N (positional)
  ACTIVATOR    [group 1]   ... [group 8]     select fixture group N (positional)
  TRACK SELECT [UNMAPPED ] ... [UNMAPPED ]   hardware CC bleed — selection lives on Solo/Cue + Activator
  CLIP STOP    [stop col1] ... [stop col8]   release current deck scene

  FADERS       [slot 1] ... [slot 8]         SuperControl dimmer per selected slot
  MASTER BTN   FREEZE DMX latch              press once to freeze rig at last value; press again to release + flush
  MASTER FADER selected DIMMER/masterDimmer  not a raw-all-channel fader

  CLIP GRID / SESSION VIEW
  Deck A by default: 40 ArtBastard scene slots
  Hold SHIFT:        40 independent Deck B scene slots

  SCENE LAUNCH 1-5   ACT 1-5 launch
  STOP ALL CLIPS     stop Deck A/B scenes and stop ACT playback
  CROSSFADER         blend active Deck A scene with active Deck B scene
  CUE LEVEL          UNMAPPED (Device Left/Right cycles Device Control role bank)
  PLAY               enable Auto Scene playback        (LED green-blink while running)
  STOP               disable Auto Scene playback       (LED red while running)
  REC                arm grid column for clip save     (LED red-blink while any column armed)
                     SHIFT+REC = roll fresh random look across all fixtures (preview only)
  SEND A             toggle Color modular automation   (SHIFT+SEND A cycles color pattern)
  SEND B             toggle Pan/Tilt modular auto      (SHIFT+SEND B cycles pan/tilt path)
  SEND C             toggle Effects modular auto       (SHIFT+SEND C cycles effect type)
  TAP TEMPO          tap to set Auto Scene BPM
  NUDGE -/+          decrement/increment manual BPM by 1
  CLIP/TRACK         FULL ON latch (raise all patched channels to 255)
  DEVICE ON/OFF      BLACKOUT latch (snapshot + zero all channels)
  DEVICE LEFT/RIGHT  cycle Device Control role bank
```

## At a glance

| Control | Function | LED feedback |
| --- | --- | --- |
| **Clip Launch / Session View 8x5** | Launch Deck A scene slots `APC40 Deck A 01` through `APC40 Deck A 40` | green = saved, orange-blink = active deck scene, off = empty |
| **SHIFT + Clip Grid** | Hold SHIFT to use Deck B scene slots `APC40 Deck B 01` through `APC40 Deck B 40` | SHIFT orange while held; grid repaints for Deck B |
| **REC (transport)** | Arm a grid column (cycles each press). Next grid pad in any armed column saves current DMX into the current deck slot. SHIFT+REC rolls a fresh random look across all fixtures (preview only — does not save). | red-blink on REC and every armed clip pad |
| **Record Arm 1-8 (top row)** | **SOLO GROUP N** latch. Snapshots DMX on first solo, blacks out fixtures not in soloed groups, restores snapshot when last solo released. | red-blink while soloed, off otherwise (MK1: single-color amber row) |
| **Scene Launch 1-5** | Launch ACT 1-5 | green = ACT exists, orange-blink = playing ACT |
| **Clip Stop row** | Stop/unselect the active scene for that column in the current deck | red while a deck scene is active |
| **Stop All Clips** | Stop Deck A scene, Deck B scene, scene timeline playback, and ACT playback | red while a deck scene or ACT is active |
| **Track Select 1-8** | **UNMAPPED** — APC40 hardware emits unreliable CCs in some modes (CC bleed). Selection lives on Solo/Cue + Activator. | LEDs always off |
| **Master Track Select** | **FREEZE DMX latch**: press to freeze rig at last value (store state still updates, hardware stays frozen); press again to release and flush store state to backend | red while frozen |
| **Faders 1-8** | SuperControl dimmer for selected fixture slot 1-8 | n/a |
| **Master fader** | SuperControl `masterDimmer`/DIMMER for current selection | n/a |
| **Device Control knobs 1-8** | Dynamic fixture role controls, prioritizing gobo/effects roles for the selected fixture/group | in-app APC40 manual labels current roles |
| **Cue Level** | **AUTOMATION DIRECTION** — endless rotary encoder. CW = forward, CCW = reverse. Inverts step direction in AutoScene index advance and pan/tilt autopilot track. Modular color/dimmer/effects phases run on wall-clock and are not affected. | n/a |
| **Solo/Cue 1-8** | Toggle fixture N in multi-selection (positional, one per column). Press to add, press again to remove. | lit when fixture is selected, off otherwise (MK1: single-color amber row) |
| **Activator 1-8** | Toggle fixture group N in multi-selection (positional, one per column). Press to add the whole group, press again to remove it. | lit when every fixture in the group is selected, off otherwise (MK1: single-color amber row) |
| **Crossfader** | Linear DMX blend between active Deck A and active Deck B scenes | n/a |
| **Nav up/down** | Previous/next fixture | n/a |
| **Nav left/right** | Previous/next ArtBastard scene | n/a |
| **Pan** | Select all fixtures | n/a |
| **PLAY** | Enable Auto Scene playback | green-blink while Auto Scene running |
| **STOP (transport)** | Disable Auto Scene playback | red while Auto Scene running |
| **SEND A** | Toggle Color modular automation. SHIFT+SEND A cycles color pattern. | orange-blink while engine enabled |
| **SEND B** | Toggle Pan/Tilt modular automation. SHIFT+SEND B cycles pan/tilt path. | orange-blink while engine enabled |
| **SEND C** | Toggle Effects modular automation (gobo/strobe/shutter). SHIFT+SEND C cycles effect type. | orange-blink while engine enabled |
| **Tap Tempo** | Tap to set Auto Scene BPM | n/a |
| **Nudge -/+** | Decrement/increment manual BPM by 1 (switches tempo source to manual) | n/a |
| **Clip/Track (DEVICE CONTROL block)** | FULL ON latch — raise patched channels to 255, snapshot prior DMX; press again to restore | red while latched |
| **Device On/Off** | BLACKOUT latch — snapshot DMX and zero all channels; press again to restore | red while latched |
| **Device Left/Right** | Cycle Device Control role banks | n/a |

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

See **Save scene workflow** below for the save procedure.

## Crossfader

Press a saved Deck A grid slot, then hold SHIFT and press a saved Deck B grid
slot. The crossfader blends the two active deck scenes channel by channel:

- 0 = full Deck A
- 127 = full Deck B
- middle values = linear DMX blend

The blend writes DMX directly through the batch DMX API. It does not rename or
delete scenes.

## Super Control

### Selection first

Use **Solo/Cue 1-8** to select an individual fixture, or **Activator 1-8** to
select a fixture group. The top Track Control encoder push/ring buttons no
longer act as select aliases (Track Select row is unmapped because of APC40
hardware CC bleed).

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

Turn the **Device Left/Right** buttons (DEVICE CONTROL block) to page through
additional roles if the selected fixture has more than eight useful DMX roles.

## Automation row

**Activator 1-8** selects a fixture group (positional). The legacy "per-group
auto controller" feature has been removed; modular automation now lives on
the SEND row instead:

- **SEND A** — toggle the modular **color** automation engine. SHIFT+SEND A
  cycles the color pattern (`rainbow`, `pulse`, `strobe`, `cycle`, `breathe`,
  `wave`, `random`).
- **SEND B** — toggle the modular **pan/tilt** automation engine. SHIFT+SEND B
  cycles the path (`circle`, `figure8`, `square`, `triangle`, `linear`,
  `custom`).
- **SEND C** — toggle the modular **effects** automation engine. SHIFT+SEND C
  cycles the effect type (`gobo_cycle`, `prism_rotate`, `iris_breathe`,
  `zoom_bounce`, `focus_sweep`).

The SEND-row LED is orange-blink while its engine is enabled.

## Save scene workflow

1. Choose the deck: leave SHIFT released for Deck A, hold SHIFT for Deck B.
2. Press **REC** (transport row) once per grid column you want armed. ArtBastard enters **SAVE MODE** and flashes those columns red.
3. Press a flashing red grid pad in any armed column. Empty pads are spare save targets; saved pads will be overwritten.
4. ArtBastard saves the current DMX state into that deck slot name.

To launch a scene, press any saved grid pad in the current deck.

## Roll dice — SHIFT+REC

Hold **SHIFT** and press **REC** to roll a fresh randomized look across every
fixture on stage. Each fixture gets a random hue (saturation 60-100%), a random
dimmer between 140 and 255, and random pan/tilt where present. Strobe and white
are forced to 0 so the roll never blasts the room.

The roll writes DMX **live for preview only** — no scene is saved. If you like
the look, follow the normal save workflow: press REC, then a flashing grid pad.
If you don't, roll again (SHIFT+REC) or launch any saved scene to clear it.

## FREEZE DMX latch

Press the **Master Select** button to freeze rig output at its current value.
The store keeps updating (so UI and automations still respond) but no bytes
ship to the DMX backend. Press Master Select again to release the latch —
the hook flushes the current store state to the backend so the rig catches
up to whatever you changed during the freeze.

## Solo Group latch

Press a **Record Arm** button (top row) to solo that group. The first press
in an empty solo set snapshots DMX and blacks out all fixtures that are not
in any soloed group. Additional presses add groups to the solo set. Pressing
a soloed group again removes it; releasing the last solo restores the
snapshot.

## Stop behavior

- **Clip Stop** stops the active scene for the current deck, scoped to the
  pressed column when possible.
- **Stop All Clips** clears Deck A and Deck B active scene assignments,
  stops scene timeline playback, and stops ACT playback.
- Stop All Clips does not delete saved scenes.

## LED overlays and screensaver

The MIDI/OSC hardware panel includes an **APC40 Demoscene** card for manual LED
tests and overlay preferences:

- **Flourishes** are short LED overlays for explicit actions such as fixture
  selection, clip launch, blackout, crossfade, and deck switching. Navigation
  and ROLI device-list changes do not auto-flash the grid by default.
- Each flourish type has its own selected animation. This is deterministic by
  default so the same action has the same visual signature every time.
- **Random flourishes** is opt-in. When enabled, each flourish type chooses from
  a curated pattern pool for that action rather than from the entire demoscene
  catalog.
- **Screensaver** defaults on and runs randomized demoscene patterns only while
  the browser tab is hidden. It stops when the tab becomes visible and normal
  APC40 feedback repaints.
- **XY crosshair** mirrors SuperControl pan/tilt XY movement, including ROLI
  Lightpad input, as a throttled crosshair on the APC40 clip grid. It has its
  own toggle and does not disable SuperControl or ROLI drawing when off.

## LED legend

| Velocity | Color | Meaning |
| --- | --- | --- |
| 0 | off | empty/inactive |
| 1 | green | saved deck slot, saved ACT, fixture/group selected (MK1 single-color rows display this as plain amber-on) |
| 2 | green-blink | PLAY while Auto Scene running |
| 3 | red | STOP active / FULL ON latched / Master Select frozen / active deck scene present (MK1 single-color rows display this as plain amber-on) |
| 4 | red-blink | record-armed save column (REC + armed clip pads) **or** Solo Group latched |
| 5 | orange | SHIFT latched |
| 6 | orange-blink | active deck scene, playing ACT, SEND-row engine enabled |

> **MK1 palette caveat:** only the 8×5 clip grid renders all three colors. The Solo/Cue, Activator, Record Arm, and Track Select rows are single-color amber pads — any non-zero velocity reads as "amber on", so this table's `green` vs `red` distinction only matters on the clip grid.

## Debugging

Open the in-app Help overlay and choose the APC40 visual reference. It shows
the live deck, Deck A/B scene names, armed columns, Device Control role labels,
ACT state, and the last MIDI messages received.
