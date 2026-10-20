# ArtBastard APC40 Gold Standard

This is the plain-English target for how ArtBastard should feel with an Akai APC40 connected: plug it in, open ArtBastard, and the controller immediately becomes a live lighting surface for fixture groups, scenes, acts, dimmers, decks, and contextual feedback.

The operator layout below describes **MK1 in Alternate Ableton Live Mode 2
(`0x42`)**, initialized by browser or server MIDI on each connection.
Selection, solo, automation, FULL ON, BLACKOUT, and FREEZE buttons toggle on
each distinct positive press. Release never changes their latch state,
regardless of hold duration. SHIFT and the CC64 footswitch remain momentary.
MK2 keeps its existing explicit ON/OFF handling and is not initialized by
the MK1 product-ID command. See the [protocol reference](midi/apc40.md#mk1-initialization-and-button-state).

## APC40 surface map (ASCII)

This drawing is the operator-facing mental model for the ArtBastard APC40 layout. It is shaped like the APC40 MK1 in the reference photo: clip/session grid on the left, Scene Launch buttons beside it, faders below, Track Control and Device Control on the right, and transport/crossfader at the lower right.

```text
AKAI APC40 / ArtBastard live surface

+-----------------------------------------------------------------------------------------------------------+  +------------------------------------+
| CLIP LAUNCH / SESSION OVERVIEW                                                                            |  | TRACK CONTROL                       |
| Deck A by default. Hold SHIFT for Deck B. REC save mode flashes pads; saved pads launch.                   |  | fixed live fixture roles            |
|                                                                                                           |  |                                    |
|  COL 1     COL 2     COL 3     COL 4     COL 5     COL 6     COL 7     COL 8        SCENE LAUNCH          |  |   (1)PAN   (2)TILT  (3)RED   (4)GRN |
| +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+     +-----------+         |  |   (5)BLUE  (6)WHT   (7)STRB  (8)SPD |
| |A01/B01| |A02/B02| |A03/B03| |A04/B04| |A05/B05| |A06/B06| |A07/B07| |A08/B08|     | ACT 1     |         |  |                                    |
| +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+     +-----------+         |  | buttons below knobs:                |
| |A09/B09| |A10/B10| |A11/B11| |A12/B12| |A13/B13| |A14/B14| |A15/B15| |A16/B16|     | ACT 2     |         |  | [PAN]=tap select all/clear          |
| +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+     +-----------+         |  | [SEND A]=tap toggle Color auto      |
| |A17/B17| |A18/B18| |A19/B19| |A20/B20| |A21/B21| |A22/B22| |A23/B23| |A24/B24|     | ACT 3     |         |  | [SEND B]=tap toggle Pan/Tilt auto   |
| +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+     +-----------+         |  | [SEND C]=tap toggle Effects auto    |
| |A25/B25| |A26/B26| |A27/B27| |A28/B28| |A29/B29| |A30/B30| |A31/B31| |A32/B32|     | ACT 4     |         |  | (SHIFT+SEND cycles patterns)        |
| +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+     +-----------+         |  +------------------------------------+
| |A33/B33| |A34/B34| |A35/B35| |A36/B36| |A37/B37| |A38/B38| |A39/B39| |A40/B40|     | ACT 5     |         |  +------------------------------------+
| +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+     +-----------+         |  | BANK SELECT / UTILITY               |
|                                                                                         STOP ALL CLIPS    |  | [UP]=prev fixture [DOWN]=next       |
| CLIP STOP      [STOP1]  [STOP2]  [STOP3]  [STOP4]  [STOP5]  [STOP6]  [STOP7]  [STOP8]  [STOP ALL]         |  | [LEFT]=prev scene [RIGHT]=next      |
|                                                                                                           |  | [SHIFT]=hold Deck B                 |
| TRACK SELECTION [WHEEL1] [WHEEL2] [WHEEL3] [WHEEL4] [WHEEL5] [WHEEL6] [WHEEL7] [WHEEL8] [MASTER=FREEZE]   |  | TAP TEMPO=Auto Scene BPM tap        |
| ACTIVATOR       [GRP1]   [GRP2]   [GRP3]   [GRP4]   [GRP5]   [GRP6]   [GRP7]   [GRP8]                     |  | NUDGE -/+ = manual BPM delta        |
| SOLO / CUE      [FIX1]   [FIX2]   [FIX3]   [FIX4]   [FIX5]   [FIX6]   [FIX7]   [FIX8]                     |  +------------------------------------+
| RECORD ARM      [SOLO-G1][SOLO-G2][SOLO-G3][SOLO-G4][SOLO-G5][SOLO-G6][SOLO-G7][SOLO-G8]                  |  +------------------------------------+
|                                                                                                           |  | DEVICE CONTROL                      |
| FADERS          [DIM1]   [DIM2]   [DIM3]   [DIM4]   [DIM5]   [DIM6]   [DIM7]   [DIM8]   [MASTER DIMMER]  |  | context-aware fixture capabilities  |
| CUE LEVEL knob  Automation direction (CW forward / CCW reverse)                                           |  |                                    |
+-----------------------------------------------------------------------------------------------------------+  |   (D1)     (D2)     (D3)     (D4)   |
                                                                                                              |   (D5)     (D6)     (D7)     (D8)   |
                                                                                                              | Device Left/Right = cycle role bank |
                                                                                                              | Clip/Track = FULL ON latch          |
                                                                                                              | Device On/Off = BLACKOUT latch      |
                                                                                                              +------------------------------------+
                                                                                                              +------------------------------------+
                                                                                                              | TRANSPORT / CROSSFADER             |
                                                                                                              | PLAY=enable Auto Scene             |
                                                                                                              | STOP=disable Auto Scene            |
                                                                                                              | REC=clip-grid save mode            |
                                                                                                              | CROSSFADER: Deck A <-> Deck B      |
                                                                                                              +------------------------------------+
```

### APC40 control legend, by physical area

#### Clip/session area

| APC40 hardware label | ArtBastard meaning | LED feedback |
| --- | --- | --- |
| Clip Launch pads `A01`-`A40` | Deck A scene slots. Press a saved slot to launch it. Press an armed slot to save current DMX into that slot. | Off empty, green saved, orange blink active, red blink when armed for saving. |
| Clip Launch pads `B01`-`B40` while holding `SHIFT` | Deck B scene slots. Same save/launch behavior, but on Deck B. | Red saved, orange blink active, red blink in save mode. |
| Scene Launch buttons 1-5 | Launch ACT 1-5. | Green when ACT exists, orange blink when that ACT is playing. |
| Clip Stop 1-8 | Stop the active Deck A/B scene for that column; if no column match, stop the active deck scene. | Red while the active deck has a scene. |
| Stop All Clips | Panic-stop Deck A/B scenes and ACT playback. | Red while any Deck scene or ACT playback is active. |

#### Track strips and faders

| APC40 hardware label | ArtBastard meaning | LED feedback |
| --- | --- | --- |
| Track Selection 1-8 | Fixed colour-wheel slots for selected colour-wheel fixtures; falls back to all patched colour-wheel fixtures when the selection contains none. | Available slots lit. MK1 single-color LEDs do not distinguish current from other available slots. |
| Master Track Selection | **FREEZE DMX latch.** Tap to freeze rig output; tap again to unfreeze and flush current store state. MK1 uses note `0x50`. Release keeps the state. | Lit while frozen, off while live. |
| Activator 1-8 | Tap to add fixture group N to multi-selection; tap again to remove it. Release keeps selection. | Lit when every fixture in the group is selected, off otherwise. |
| Solo/Cue 1-8 | Tap to add fixture N to multi-selection; tap again to remove it. Release keeps selection. | Lit when the fixture is selected, off otherwise. |
| Record Arm 1-8 | **SOLO GROUP N latch.** First solo snapshots DMX and dims other fixtures to zero. Tap again to remove that group; removing the last solo restores the snapshot. Release keeps the solo active. | Lit while group is soloed, off otherwise. |
| Track faders 1-8 | Dimmer/intensity for selected fixture slot 1-8. If no fixture is selected, the fader intentionally does nothing. | No motor/LED feedback on APC40 MK1 faders. |
| Master fader | Master dimmer for the selected lighting context. If no fixture is selected, it intentionally does nothing. | No motor/LED feedback on APC40 MK1 fader. |

#### Right-side knobs, utility, and transport

| APC40 hardware label | ArtBastard meaning | LED feedback |
| --- | --- | --- |
| Track Control encoder ring CCs 1-8 | Output-only LED ring/control feedback CCs in this build; not counted as assignable button surfaces. | Rings mirror the current DMX value for that role only when the selected fixture/group has that capability; otherwise off. |
| Track Control knob 1 | Pan for selected fixtures/groups; requires selection. | Ring mirrors current pan DMX value when available, otherwise off. |
| Track Control knob 2 | Tilt for selected fixtures/groups; requires selection. | Ring mirrors current tilt DMX value when available, otherwise off. |
| Track Control knob 3 | Red color channel for selected fixtures/groups. | Ring mirrors current red DMX value when available, otherwise off. |
| Track Control knob 4 | Green color channel for selected fixtures/groups. | Ring mirrors current green DMX value when available, otherwise off. |
| Track Control knob 5 | Blue color channel for selected fixtures/groups. | Ring mirrors current blue DMX value when available, otherwise off. |
| Track Control knob 6 | White/amber/UV style color channel where the fixture supports it. | Ring mirrors current white/UV-style DMX value when available, otherwise off. |
| Track Control knob 7 | Strobe/shutter role where the fixture supports it. | Ring mirrors current strobe/shutter DMX value when available, otherwise off. |
| Track Control knob 8 | Speed/rate/effect-speed role where the fixture supports it. | Ring mirrors current speed/rate DMX value when available, otherwise off. |
| Track Control `PAN` button | Tap to select all fixtures; tap again to clear selection. | Lit while all fixtures are selected. |
| Track Control `SEND A` button | Toggle modular **Color** automation engine. SHIFT+SEND A cycles color pattern. | Orange-blink while engine is enabled. |
| Track Control `SEND B` button | Toggle modular **Pan/Tilt** automation engine. SHIFT+SEND B cycles pan/tilt path. | Orange-blink while engine is enabled. |
| Track Control `SEND C` button | Toggle modular **Effects** automation engine (gobo/strobe/shutter). SHIFT+SEND C cycles effect type. | Orange-blink while engine is enabled. |
| Device Control knobs 1-8 | Context-aware fixture capabilities. Default priority is Gobo, Gobo Rotate, Color Wheel, Prism, Iris, Focus, Zoom, Strobe, then adapts to selected fixtures. | Rings mirror current DMX values for available selected-fixture capabilities; unavailable slots stay off. |
| Cue Level knob | **AUTOMATION DIRECTION.** Endless rotary encoder. CW step flips global automation direction to forward, CCW step flips to reverse. Inverts AutoScene index advance and pan/tilt autopilot track. Modular color/dimmer/effects phases are wall-clock based and unaffected. | n/a |
| Device Left / Right (Device Control block) | Cycle Device Control role bank backwards/forwards without wrapping. | Momentary orange while moving; red when held at first/last bank. |
| Clip/Track (Device Control block) | Tap to latch FULL ON: snapshot DMX and raise patched channels to 255, excluding reset/lamp/function channels. Tap again to restore; release does not restore. | Lit while latched. |
| Device On/Off (Device Control block) | Tap to latch BLACKOUT: snapshot DMX and zero all channels. Tap again to restore; release does not restore. | Lit while latched. |
| Bank Select Up/Down | Previous/next fixture selection. | No active ArtBastard feedback. |
| Bank Select Left/Right | Previous/next saved scene selection. | No active ArtBastard feedback. |
| `SHIFT` | Hold for Deck B grid layer. Release returns to Deck A. | Orange while held. |
| Tap Tempo | Tap on the beat. Switches Auto Scene tempo source to Tap Tempo. | n/a |
| Nudge -, Nudge + | Decrement/increment Auto Scene manual BPM by 1; switches tempo source to manual. | n/a |
| Detail View | Tap to toggle the same FREEZE state as Master Select. Release does not unfreeze. | Lit while frozen. |
| Footswitch 1 (CC64) | Hold to freeze DMX; release to resume and flush current store state. | FREEZE indicators follow state. |
| Rec Quantization | Alias for REC save mode. | Same as REC save mode. |
| MIDI Overdub | Panic stop alias for Stop All Clips. | Same as Stop All Clips. |
| Metronome | Tap Tempo alias. | n/a |
| Transport `PLAY` | Enable Auto Scene playback. | Green-blink while Auto Scene is running. |
| Transport `STOP` | Disable Auto Scene playback. | Red while Auto Scene is running. |
| Transport `REC` | Enter/exit clip-grid save mode. Hold SHIFT with REC for roll-dice preview instead. | Red blink while save mode is active. |
| Crossfader | Blend Deck A scene values on the left with Deck B scene values on the right. Center is a 50/50 blend. | No APC40 LED feedback. |

### LED legend

| LED state | Meaning |
| --- | --- |
| Off | Empty/unavailable slot, unarmed button, or no active state. |
| Green | Saved Deck A scene/ACT or selected fixture/group. |
| Orange blink | Currently active scene/ACT, or enabled SEND automation engine. |
| Green blink | PLAY while Auto Scene is running. |
| Red blink | REC and clip pads in save mode; pressing a pad saves current DMX there. |
| Red solid | Saved Deck B scene while SHIFT is held, FULL ON/BLACKOUT/FREEZE latch, or stop indicator depending on the control. |

Only the MK1 clip grid displays the full color palette. Single-color rows
display nonzero LED values as lit; use the in-app state for distinctions the
hardware cannot show.

## Out-of-box connection

- ArtBastard must detect APC40 MIDI inputs and outputs automatically from browser Web MIDI or the local server bridge.
- The APC40 template must auto-apply without manual setup when the expected APC mappings are missing or stale.
- The MIDI monitor must show every incoming APC40 message with source, channel, note/CC, and value.
- APC40 output LEDs must connect automatically when a matching MIDI output is available.
- MK1 browser and server outputs send the same Mode 2 introduction, including after reconnection. A device inquiry reply confirms identity, not successful mode selection.
- Manual mapping is still allowed, but the default experience should be usable immediately.

## Global monitors

- MIDI, OSC, and DMX monitors are floating, persistent, and visible on every page.
- The monitor stack must not be hidden by fixture pages, help buttons, build badges, or deploy badges.
- The MIDI monitor should retain enough history for real debugging, not just the last few messages.
- The DMX monitor should narrate changed fixture, role, value, group/selection context, DMX channel, and recent APC40 source control.
- ACT triggers and other processors should receive the same global MIDI message stream that the monitor displays.

## APC40 live surface

### Clip grid

- The 8x5 clip grid controls Deck A by default.
- Holding SHIFT switches grid operations to Deck B.
- Pressing a saved slot launches that deck scene.
- Pressing a flashing red save-mode slot saves the current lighting state into that deck slot.
- REC enters save mode; Record Arm buttons do not save clips.
- To save Deck B, press REC first, then hold SHIFT while pressing the clip-grid pad.
- LEDs are contextual:
  - Off = empty slot.
  - Green = saved scene.
  - Orange blink = active scene for the current deck.
  - Red blink = save mode on REC and clip pads, or solo-group latch on Record Arm.

### Scene Launch buttons

- Scene Launch 1-5 launch ACT 1-5.
- LEDs show saved ACT state and the currently playing ACT.

### Fixture groups and selection

- Solo/Cue 1-8 toggle fixture N in multi-selection. Releasing the button keeps the selection.
- Activator 1-8 toggle fixture group N in multi-selection; they do not enable automation.
- Record Arm 1-8 toggle the Solo Group latch; removing the last solo restores its DMX snapshot.
- Track Select 1-8 choose fixed colour-wheel slots. They do not select fixtures or groups.
- Track Stop 1-8 stops the active scene in that column when it matches the current deck; otherwise it stops the current deck scene.
- Stop All Clips stops Deck A/B scenes and ACT playback; transport STOP disables Auto Scene playback.
- Master Track Select is the primary DMX FREEZE latch: LED on means frozen, pressing again unfreezes.

### Faders and knobs

- Track faders 1-8 control dimmer/intensity for selected fixture slot 1-8. If no fixture is selected, these faders intentionally do nothing rather than guessing.
- The master fader controls master dimmer for all selected fixtures. If no fixture is selected, it intentionally does nothing.
- Track Control knobs use the fixed roles Pan, Tilt, Red, Green, Blue, White, Strobe, and Speed. They require selected fixtures.
- Device Control knobs follow selected fixture roles and require a fixture/group selection:
  - pan, tilt, fine pan, fine tilt
  - red, green, blue, white/amber/UV
  - gobo, gobo rotation, color wheel
  - prism, iris, focus, zoom
  - macro, speed, shutter, strobe
- Device Left/Right page through the Device Control role list. Cue Level sets automation direction.
- Unknown fixture capabilities should fail visibly in the monitor, not silently.

### Crossfader and decks

- The crossfader blends Deck A and Deck B scenes.
- Deck state should be visible in the UI and reflected by grid LEDs.
- SHIFT makes it obvious whether the operator is touching A or B deck controls.

## Visual feedback

- The APC40 visual diagram should always show the last touched control.
- The APC40 visual diagram should also show the last meaningful change: fixture, scene, device role, effect, selection, or transport action.
- The touched control should flash immediately when a MIDI message arrives.
- The visual state should show current deck, save-mode targets, saved slots, active scenes, ACT state, selected groups, and whether FULL ON/SHIFT is latched.
- If a MIDI message is seen in the monitor but not reflected in the visual, that is a bug.
- The DMX Activity monitor should display the same last APC40 change context and attach recent APC40 source context to DMX rows.

## Reliability rules

- MIDI routing must be single-path: one incoming hardware movement should not apply the same DMX change twice.
- Browser MIDI, server MIDI, ACT triggers, monitors, SuperControl, APC workflow, and LED feedback should share consistent message semantics.
- Channel `0` is a valid MIDI channel and must never be treated as missing.
- Note Off and zero-velocity Note On must not accidentally launch scenes.
- MK1 latch buttons use press edges, not release timing. Repeated positive messages while held do not toggle twice; a new press after release does.
- The MK1 input gate buffers only an ordered CC16–23 candidate from one source/channel. A complete frame within 20 ms is discarded as a Generic Mode bank snapshot; incomplete, interrupted, or slower sequences pass. A lone CC16 waits at most 20 ms, and faders are immediate.
- Hardware absence should not break the app; it should simply show no connected APC outputs.

Generic Mode's bank reports and Mode 2's momentary controls are documented in
[Akai's official MK1 protocol](https://cdn.inmusicbrands.com/akai/apc40/APC40_Communications_Protocol_rev_1.pdf_1db97c1fdba23bacf47df0f9bf64e913.pdf).
The narrow snapshot guard protects startup or failed initialization; it does
not establish that Mode 2 was accepted.

## Current implementation map

This section is the code-backed truth table for the current app. If the implementation changes, update this table at the same time.
Button latch behavior below is MK1-specific unless a row explicitly names MK2.

| Hardware control | MIDI signature currently decoded | App code path | Current behavior |
| --- | --- | --- | --- |
| Clip grid, APC40 MK1 | Notes `0x35`-`0x39`, MIDI channel = column | `decodeApc40Message` -> `clip-launch` -> `useApc40Workflow` | Launches/saves `APC40 Deck A/B 01` through `40`, depending on SHIFT/deck and whether REC save mode is active. |
| Clip grid, APC40 MK2 | Notes `0x00`-`0x27` | `decodeApc40Message` -> `clip-launch` -> `useApc40Workflow` | Same scene-slot model as MK1, with row/column derived directly from note number. |
| Scene Launch 1-5 | Notes `0x52`-`0x56` | `scene-launch` -> `playAct` | Launches ACT 1-5 when the corresponding ACT exists. |
| Record Arm 1-8 | Note `0x30`, MIDI channel = column | `solo-group` -> Solo Group latch | Tap to add/remove group N from the solo set. First solo snapshots DMX; removing the last restores it. Release keeps the latch. |
| REC transport | Note `0x5d` or `0x66` | `record` -> clip-grid save mode, or `buildRandomLookUpdates` when SHIFT is held | Plain press enters/exits clip-grid save mode. SHIFT+REC rolls a fresh randomized look (random hue + dimmer + pan/tilt per fixture) and writes it live to DMX — preview only, no scene save. |
| Track faders 1-8 | CC `0x07`, MIDI channel = track index | `channel-fader` -> `applySuperControlMidi('dimmer', slotIndex)` | Dims selected fixture slot 1-8. Requires selected fixtures. |
| Master fader | CC `0x0e`, channel `0` | `master-fader` -> `applySuperControlMidi('masterDimmer')` | Dims all selected fixtures. Requires selected fixtures. |
| Track Control knobs 1-8 | CC `0x30`-`0x37`, channel `0` | `track-control` -> `APC40_TRACK_CONTROL_ROLES` -> `buildRoleUpdates` | Fixed roles: Pan, Tilt, Red, Green, Blue, White, Strobe, Speed. Requires selected fixtures. |
| Track Control LED rings 1-8 | CC `0x38`-`0x3f`, channel `0` | output-only ring LED CCs | Ring-style feedback, not button presses. |
| Device Control knobs 1-8 | CC `0x10`-`0x17`, channel `0` | `device-control` -> `resolveApc40DeviceRoleSlots` -> `buildRoleUpdates` | Context-aware roles from selected fixture capabilities; requires selected fixtures. Complete MK1 bank snapshots are filtered before role writes. |
| Cue Level | CC `0x2f`, channel `0` | `cue-level` -> `setAutomationDirection` | Endless rotary; value 1-63 = CW (forward), 65-127 = CCW (reverse), 0/64 = no-movement. Flips AutoScene index step and pan/tilt autopilot direction. |
| Device Left / Right | Notes `0x3c` / `0x3d`, channel `0` | `bank-prev` / `bank-next` | Cycle Device Control role bank backwards/forwards. |
| Clip/Track (Device block) | Note `0x3a`, channel `0` | `full-on` -> FULL ON latch | Tap to snapshot and raise patched channels to 255, excluding reset/lamp/function channels; tap again to restore. Release keeps state. |
| Device On/Off (Device block) | Note `0x3b`, channel `0` | `blackout` -> BLACKOUT latch | Tap to snapshot DMX and zero all channels; tap again to restore. Release keeps state. |
| Crossfader | CC `0x0f`, channel `0` | `crossfader` -> `blendApc40DeckScenes` | Blends the currently assigned Deck A and Deck B scenes. If either deck has no scene, there is no DMX blend update. |
| Track Select 1-8 | Note `0x33`, MIDI channels `0`-`7` | `color-wheel-slot` | Choose a fixed colour-wheel slot for selected colour-wheel fixtures, falling back to all patched colour-wheel fixtures when the selection contains none. |
| Master Select, MK1 | Note `0x50`, channel ignored | `toggle-freeze-dmx` -> `setDmxFrozen(!dmxFrozen)` | Tap to freeze; tap again to unfreeze and flush current state. Input and LED use `0x50`. Release and Generic Mode bank CCs never toggle FREEZE. |
| Master Select, legacy MK2 decoder | Note `0x33`, MIDI channel `8` | Existing MK2 fallback | Preserved compatibility mapping; not the official MK1 Master signature or an MK2 protocol correction. |
| Detail View, MK1 | Note `0x3e`, channel `0` | `freeze-dmx` | Tap to toggle the same freeze state; release keeps state. |
| Footswitch 1 | CC `0x40` (64) | `foot-freeze-dmx` | Press freezes; release resumes and flushes current store state. |
| Solo/Cue 1-8 | Note `0x31`, MIDI channel = track index | `select-fixture` | Tap to add/remove fixture N. Release keeps selection. |
| Activator 1-8 | Note `0x32`, MIDI channel = track index | `select-group` | Tap to add/remove fixture group N. Release keeps selection. |
| Track Stop 1-8 | Note `0x34`, MIDI channel = track index | `track-stop` | Clears the current deck scene in that column when it matches; otherwise clears the current deck scene. |
| Stop All Clips | Note `0x51` | `stop-all-clips` | Clears Deck A/B scene refs, clears save mode, stops ACT playback, stops scene timelines. |
| SHIFT | Note `0x62`, press/release aware | `shift` | Held state switches clip grid operations and LED paint to Deck B. |
| PAN utility button | Note `0x57` | `select-all` | Tap to select all fixtures; tap again to clear selection. |
| Fixture navigation | Notes `0x5e` / `0x5f` | `nav-fixture` | Previous/next fixture. |
| Scene navigation | Notes `0x60` / `0x61` | `nav-scene` | Previous/next scene. |
| Tap Tempo | Note `0x63` | `tap-tempo` | Tap to set Auto Scene BPM; switches tempo source to Tap Tempo. |
| Nudge +/- | Notes `0x64` / `0x65` | `nudge` | Increment/decrement manual BPM by 1; switches tempo source to manual. |
| SEND A | Note `0x58` | `toggle-color-auto` | Tap to toggle color automation. SHIFT+SEND A cycles its pattern without changing enabled state. |
| SEND B | Note `0x59` | `toggle-pan-tilt-auto` | Tap to toggle pan/tilt automation. SHIFT+SEND B cycles its path without changing enabled state. |
| SEND C | Note `0x5a` | `toggle-effect-auto` | Tap to toggle effects automation. SHIFT+SEND C cycles its effect type without changing enabled state. |
| PLAY transport | Note `0x5b` | `play` | Enable Auto Scene playback. |
| STOP transport | Note `0x5c` | `stop` | Disable Auto Scene playback. |

### Current LED implementation

| Surface | Code-backed LED behavior |
| --- | --- |
| Clip grid | Paints the active deck only: off = no saved scene, green = saved scene, orange blink = active deck slot, red blink = armed save column. |
| Scene Launch | Green when ACT exists; orange blink when that ACT is playing. |
| Record Arm row (SOLO GROUP) | Nonzero while that group is soloed; off otherwise. |
| Track Select row | Available colour-wheel slots light; current slot uses velocity 1, other available slots velocity 5. These appear alike on MK1 single-color LEDs. |
| Activator row | Lit when every fixture in the group is selected; off otherwise. |
| Solo/Cue row | Lit while that fixture is selected; off otherwise. |
| Track Stop row | Red while the current deck has an active scene in that column. |
| Master Select | Red while DMX freeze latch is engaged; off while live. |
| Detail View (FREEZE) | Red while DMX freeze latch is engaged. |
| Stop All Clips | Red while Deck A/B scene or ACT playback is active. |
| SHIFT | Orange while SHIFT is held. |
| REC | Red blink while any save column is armed. |
| PLAY | Green blink while Auto Scene playback is enabled. |
| STOP | Red while Auto Scene playback is enabled. |
| SEND A / B / C | Orange blink while the corresponding modular automation engine (color / pan-tilt / effects) is enabled. |
| Clip/Track (FULL ON) | Red while FULL ON latch is engaged. |
| Device On/Off (BLACKOUT) | Red while BLACKOUT latch is engaged. |

### Source files to check when this doc changes

| App concern | Source file |
| --- | --- |
| APC40 MIDI decoding and note/CC signatures | `react-app/src/midi/apc40.ts` |
| Shared MK1 Mode 2 bytes and browser initialization | `src/apc40Protocol.ts`, `src/index.ts`, `react-app/src/midi/apc40Init.ts`, and `react-app/src/hooks/useApc40Health.ts` |
| Bounded MK1 bank-snapshot filtering | `react-app/src/midi/apc40InputGate.ts` |
| Deck scene naming, fixture role aliases, role updates, crossfader blending | `react-app/src/midi/apc40WorkflowHelpers.ts` |
| Live APC40 behavior and state transitions | `react-app/src/hooks/useApc40Workflow.ts` |
| APC40 LED repaint rules | `react-app/src/hooks/useApc40LedFeedback.ts` |
| APC40 template fallback bindings | `react-app/src/components/midi/midiControllerTemplates.ts` |
| Floating DMX natural-language activity monitor | `react-app/src/components/dmx/DmxMonitor.tsx` and `react-app/src/components/dmx/dmxActivityNarration.ts` |
| In-app APC40 surface/manual display | `react-app/src/components/midi/Apc40SurfaceDiagram.tsx` and `react-app/src/components/midi/Apc40Manual.tsx` |

## Related: data-driven seed packs

Scene-launch ACTS (the 5 buttons next to the clip grid) are seeded from
`DOCS/acts/packs/*.md`. The clip pads themselves are seeded from
`DOCS/scenes/packs/*.md`. Edit those MD files and run `npm run build-specs`
(or just rebuild) — the new templates show up in the seeder UI without any
code changes. See `CLAUDE.md` for the full codegen map and `DOCS/PROJECT_IO.md`
for hand-editing a deployed rig via YAML.
