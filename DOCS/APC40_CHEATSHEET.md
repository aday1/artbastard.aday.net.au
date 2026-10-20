# APC40 MK1 Cheatsheet

The APC40 live integration runs through `react-app/src/hooks/useApc40Workflow.ts`
and `react-app/src/hooks/useApc40LedFeedback.ts`. Browser MIDI and the server
initialize the AKAI APC40 MK1 to **Alternate Ableton Live Mode 2 (`0x42`)**.
The dedicated integration works without manually applying a MIDI template.

**Tap to toggle:** Solo/Cue, Activator, Record Arm, PAN, SEND A/B/C, FULL ON,
BLACKOUT, Master Select, and Detail View keep their state after release.
Press again to toggle them back; holding a button longer does not change this.
SHIFT and the CC64 footswitch remain momentary.

This guide describes MK1 behavior. MK2 keeps its existing decoding and
explicit ON/OFF handling; the MK1 mode command does not initialize MK2.
The [MIDI protocol reference](midi/apc40.md#mk1-initialization-and-button-state)
explains initialization and the bounded bank-snapshot guard.

## Surface map

```
                TRACK CONTROL KNOBS        DEVICE CONTROL KNOBS
                leftover SuperControl      selected fixture DMX roles
                pan/tilt/RGB/W/strobe      gobo, wheel, prism, iris,
                speed                      focus, zoom, effects

  RECORD ARM   [solo grp1] ... [solo grp8]   latched Solo-Group blackout of non-soloed fixtures
  SOLO/CUE     [fixture 1] ... [fixture 8]   select fixture N (positional)
  ACTIVATOR    [group 1]   ... [group 8]     select fixture group N (positional)
  TRACK SELECT [colour 1] ... [colour 8]    fixed colour-wheel slots
  CLIP STOP    [stop col1] ... [stop col8]   release current deck scene

  FADERS       [slot 1] ... [slot 8]         SuperControl dimmer per selected slot
  MASTER BTN   FREEZE DMX                    LED on = frozen; press again to unfreeze
  MASTER FADER selected DIMMER/masterDimmer  not a raw-all-channel fader

  CLIP GRID / SESSION VIEW
  Deck A by default: 40 ArtBastard scene slots
  Hold SHIFT:        40 independent Deck B scene slots

  SCENE LAUNCH 1-5   ACT 1-5 launch
  STOP ALL CLIPS     stop Deck A/B scenes and stop ACT playback
  CROSSFADER         blend active Deck A scene with active Deck B scene
  CUE LEVEL          automation direction (CW forward / CCW reverse)
  PLAY               enable Auto Scene playback        (LED green-blink while running)
  STOP               disable Auto Scene playback       (LED red while running)
  REC                enter clip-grid save mode         (LED red-blink while save mode active)
                     SHIFT+REC = roll fresh random look across all fixtures (preview only)
  SEND A             tap to toggle Color automation    (SHIFT+SEND A cycles color pattern)
  SEND B             tap to toggle Pan/Tilt automation (SHIFT+SEND B cycles pan/tilt path)
  SEND C             tap to toggle Effects automation  (SHIFT+SEND C cycles effect type)
  TAP TEMPO          tap to set Auto Scene BPM
  NUDGE -/+          decrement/increment manual BPM by 1
  CLIP/TRACK         FULL ON latch (excludes reset/lamp/function channels)
  DEVICE ON/OFF      BLACKOUT latch (snapshot + zero all channels)
  DEVICE LEFT/RIGHT  cycle Device Control role bank
  DETAIL VIEW        FREEZE DMX latch
  REC QUANTIZATION   REC/save-mode alias
  MIDI OVERDUB       panic stop alias
  METRONOME          tap tempo alias
```

## At a glance

| Control | Function | LED feedback |
| --- | --- | --- |
| **Clip Launch / Session View 8x5** | Launch Deck A scene slots `APC40 Deck A 01` through `APC40 Deck A 40` | green = saved, orange-blink = active deck scene, off = empty |
| **SHIFT + Clip Grid** | Hold SHIFT to use Deck B scene slots `APC40 Deck B 01` through `APC40 Deck B 40` | SHIFT orange while held; grid repaints for Deck B |
| **REC (transport)** | Enter/exit save mode for the clip grid. Next clip-grid pad saves current DMX into that deck slot; hold SHIFT only for the pad press to save Deck B. SHIFT+REC rolls a fresh random look across all fixtures (preview only, does not save). | red-blink on REC and every save-mode clip pad |
| **Record Arm 1-8 (top row)** | **SOLO GROUP N** latch. First solo snapshots DMX and dims other fixtures to zero. Tap again to remove that group; removing the last solo restores the snapshot. Release keeps the solo active. | lit while soloed, off otherwise (MK1: single-color row) |
| **Scene Launch 1-5** | Launch ACT 1-5 | green = ACT exists, orange-blink = playing ACT |
| **Clip Stop row** | Stop/unselect the active scene for that column in the current deck | red while a deck scene is active |
| **Stop All Clips** | Stop Deck A scene, Deck B scene, scene timeline playback, and ACT playback | red while a deck scene or ACT is active |
| **Track Select 1-8** | Choose fixed colour-wheel slots. Targets selected colour-wheel fixtures, or all patched colour-wheel fixtures when the selection contains none. | available slots lit; MK1 single-color LEDs do not distinguish current from other available slots |
| **Master Track Select** | **FREEZE DMX latch** — tap to freeze rig output; tap again to unfreeze and flush current store state. MK1 input and LED use note `0x50`. Release keeps the state. | lit while frozen, off while live |
| **Faders 1-8** | SuperControl dimmer for selected fixture slot 1-8 | n/a |
| **Master fader** | SuperControl `masterDimmer`/DIMMER for current selection | n/a |
| **Device Control knobs 1-8** | Dynamic fixture role controls, prioritizing gobo/effects roles for the selected fixture/group | in-app APC40 manual labels current roles |
| **Cue Level** | **AUTOMATION DIRECTION** — endless rotary encoder. CW = forward, CCW = reverse. Inverts step direction in AutoScene index advance and pan/tilt autopilot track. Modular color/dimmer/effects phases run on wall-clock and are not affected. | n/a |
| **Solo/Cue 1-8** | Tap to add fixture N to multi-selection; tap again to remove it. Release keeps the selection. | lit when fixture is selected, off otherwise (MK1: single-color row) |
| **Activator 1-8** | Tap to add fixture group N; tap again to remove it. Release keeps the selection. | lit when every fixture in the group is selected, off otherwise (MK1: single-color row) |
| **Crossfader** | Linear DMX blend between active Deck A and active Deck B scenes | n/a |
| **Nav up/down** | Previous/next fixture | n/a |
| **Nav left/right** | Previous/next ArtBastard scene | n/a |
| **Pan** | Tap to select all fixtures; tap again to clear selection | lit while all fixtures are selected |
| **PLAY** | Enable Auto Scene playback | green-blink while Auto Scene running |
| **STOP (transport)** | Disable Auto Scene playback | red while Auto Scene running |
| **SEND A** | Tap to toggle Color automation. SHIFT+SEND A cycles its pattern without changing enabled state. | lit while engine enabled |
| **SEND B** | Tap to toggle Pan/Tilt automation. SHIFT+SEND B cycles its path without changing enabled state. | lit while engine enabled |
| **SEND C** | Tap to toggle Effects automation. SHIFT+SEND C cycles its effect type without changing enabled state. | lit while engine enabled |
| **Tap Tempo** | Tap to set Auto Scene BPM | n/a |
| **Nudge -/+** | Decrement/increment manual BPM by 1 (switches tempo source to manual) | n/a |
| **Clip/Track (DEVICE CONTROL block)** | Tap to latch FULL ON: snapshot DMX and raise patched channels to 255, excluding reset/lamp/function channels. Tap again to restore. Release does not restore. | lit while latched |
| **Device On/Off** | Tap to latch BLACKOUT: snapshot DMX and zero all channels. Tap again to restore. Release does not restore. | lit while latched |
| **Device Left/Right** | Cycle Device Control role banks | n/a |
| **Detail View** | Tap to toggle the same FREEZE state as Master Select. Release does not unfreeze. | lit while frozen |
| **Footswitch 1 (CC64)** | Hold to freeze DMX; release to resume and flush current store state. | FREEZE indicators follow state |
| **Rec Quantization** | REC/save-mode alias | red-blink while save mode active |
| **MIDI Overdub** | Stop All Clips / panic stop alias | red while deck scene or ACT active |
| **Metronome** | Tap Tempo alias | n/a |

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

Tap **Solo/Cue 1-8** to add an individual fixture, or **Activator 1-8** to add
a fixture group. Release the button before moving a fader; selection stays
latched. Tap the same button again to remove its fixture or group.
**Track Select 1-8** chooses colour-wheel slots, not fixture selection.
Track Control ring CCs are LED feedback, not selection-button aliases.
Faders and role knobs require a fixture/group selection.

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

Press the **Device Left/Right** buttons (DEVICE CONTROL block) to page through
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

1. Press **REC** on the transport row. ArtBastard enters **SAVE MODE** and flashes the clip grid red.
2. Choose the deck when pressing the pad: leave SHIFT released for Deck A, or hold SHIFT while pressing the clip-grid pad for Deck B.
3. Press the clip-grid pad you want to save into. Empty pads are spare save targets; saved pads will be overwritten.
4. ArtBastard saves the current DMX state into that deck slot name.

To launch a scene, press any saved grid pad in the current deck.

## Roll dice — SHIFT+REC

Hold **SHIFT** and press **REC** to roll a fresh randomized look across every
fixture on stage. Each fixture gets a random hue (saturation 60-100%), a random
dimmer between 140 and 255, and random pan/tilt where present. Strobe and white
are forced to 0 so the roll never blasts the room.

The roll writes DMX **live for preview only** — no scene is saved. If you like
the look, release SHIFT, press REC, then press a flashing grid pad. For Deck B,
hold SHIFT only for the grid-pad press.
If you don't, roll again (SHIFT+REC) or launch any saved scene to clear it.

## FREEZE DMX latch

Press **Master Select** to freeze rig output at its current value. The Master
LED turns on while output is frozen; press **Master Select** again to unfreeze
and flush the current store state. **Detail View** toggles the same freeze
state. Releasing either button leaves the latch unchanged.
The store keeps updating (so UI and automations still respond) but DMX writes
are held from the backend. The next tap on either button resumes output and
flushes the current store state, including changes made during the freeze.
The CC64 footswitch is different: press/hold freezes, release resumes.

## Solo Group latch

Press a **Record Arm** button (top row) to solo that group. The first press
in an empty solo set snapshots DMX and blacks out all fixtures that are not
in any soloed group. Additional presses add groups to the solo set. Pressing
a soloed group again removes it; removing the last solo restores the
snapshot. Releasing a Record Arm button does not remove its group.

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
| 3 | red | STOP active / FULL ON latched / Detail View frozen / active deck scene present (MK1 single-color rows display this as plain amber-on) |
| 4 | red-blink | REC save mode / armed clip pads **or** Solo Group latched |
| 5 | orange | SHIFT held |
| 6 | orange-blink | active deck scene, playing ACT, SEND-row engine enabled |

> **MK1 palette caveat:** only the 8×5 clip grid renders all three colors. The Solo/Cue, Activator, Record Arm, and Track Select rows are single-color amber pads — any non-zero velocity reads as "amber on", so this table's `green` vs `red` distinction only matters on the clip grid.

## Debugging

Open the in-app Help overlay and choose the APC40 visual reference. It shows
the live deck, Deck A/B scene names, save-mode targets, Device Control role labels,
ACT state, and the last MIDI messages received.

The factory Generic Mode sends eight stored Device knob values on a Track
Select bank change. These are not knob gestures or Master FREEZE presses.
ArtBastard selects Mode 2 on connection/reconnection and additionally drops
only a complete, ordered CC16–23 frame from one MK1 source/channel within
20 ms. Incomplete or slower input passes; a lone CC16 can wait 20 ms.
See the [protocol reference](midi/apc40.md#mk1-initialization-and-button-state)
and [Akai's official protocol](https://cdn.inmusicbrands.com/akai/apc40/APC40_Communications_Protocol_rev_1.pdf_1db97c1fdba23bacf47df0f9bf64e913.pdf).
An “APC40 identified” notification confirms identity, not mode acknowledgement.
