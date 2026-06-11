# ArtBastard APC40 Gold Standard

This is the plain-English target for how ArtBastard should feel with an Akai APC40 connected: plug it in, open ArtBastard, and the controller immediately becomes a live lighting surface for fixture groups, scenes, acts, dimmers, decks, and contextual feedback.

## APC40 surface map (ASCII)

This drawing is the operator-facing mental model for the ArtBastard APC40 layout. It is shaped like the APC40 MK1 in the reference photo: clip/session grid on the left, Scene Launch buttons beside it, faders below, Track Control and Device Control on the right, and transport/crossfader at the lower right.

```text
AKAI APC40 / ArtBastard live surface

+-----------------------------------------------------------------------------------------------------------+  +------------------------------------+
| CLIP LAUNCH / SESSION OVERVIEW                                                                            |  | TRACK CONTROL                       |
| Deck A by default. Hold SHIFT for Deck B. Armed columns save; unarmed saved pads launch.                   |  | fixed live fixture roles            |
|                                                                                                           |  |                                    |
|  COL 1     COL 2     COL 3     COL 4     COL 5     COL 6     COL 7     COL 8        SCENE LAUNCH          |  |   (1)PAN   (2)TILT  (3)RED   (4)GRN |
| +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+     +-----------+         |  |   (5)BLUE  (6)WHT   (7)STRB  (8)SPD |
| |A01/B01| |A02/B02| |A03/B03| |A04/B04| |A05/B05| |A06/B06| |A07/B07| |A08/B08|     | ACT 1     |         |  |                                    |
| +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+     +-----------+         |  | buttons below knobs:                |
| |A09/B09| |A10/B10| |A11/B11| |A12/B12| |A13/B13| |A14/B14| |A15/B15| |A16/B16|     | ACT 2     |         |  | [PAN]=select all fixtures           |
| +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+     +-----------+         |  | [SEND A] [SEND B] [SEND C]=reserved |
| |A17/B17| |A18/B18| |A19/B19| |A20/B20| |A21/B21| |A22/B22| |A23/B23| |A24/B24|     | ACT 3     |         |  +------------------------------------+
| +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+     +-----------+         |  +------------------------------------+
| |A25/B25| |A26/B26| |A27/B27| |A28/B28| |A29/B29| |A30/B30| |A31/B31| |A32/B32|     | ACT 4     |         |  | BANK SELECT / UTILITY               |
| +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+     +-----------+         |  | [UP]=prev fixture [DOWN]=next       |
| |A33/B33| |A34/B34| |A35/B35| |A36/B36| |A37/B37| |A38/B38| |A39/B39| |A40/B40|     | ACT 5     |         |  | [LEFT]=prev scene [RIGHT]=next      |
| +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+     +-----------+         |  | [SHIFT]=hold Deck B                 |
|                                                                                         STOP ALL CLIPS    |  | TAP TEMPO / NUDGE -/+ = reserved    |
| CLIP STOP      [STOP1]  [STOP2]  [STOP3]  [STOP4]  [STOP5]  [STOP6]  [STOP7]  [STOP8]  [STOP ALL]         |  +------------------------------------+
|                                                                                                           |  +------------------------------------+
| TRACK SELECTION [GRP1]   [GRP2]   [GRP3]   [GRP4]   [GRP5]   [GRP6]   [GRP7]   [GRP8]   [MASTER=FULL ON] |  | DEVICE CONTROL                      |
| ACTIVATOR       [AUTO1]  [AUTO2]  [AUTO3]  [AUTO4]  [AUTO5]  [AUTO6]  [AUTO7]  [AUTO8]                  |  | context-aware fixture capabilities  |
| SOLO / CUE      [SOLO1]  [SOLO2]  [SOLO3]  [SOLO4]  [SOLO5]  [SOLO6]  [SOLO7]  [SOLO8]                  |  |                                    |
| RECORD ARM      [ARM1]   [ARM2]   [ARM3]   [ARM4]   [ARM5]   [ARM6]   [ARM7]   [ARM8]                   |  |   (D1)     (D2)     (D3)     (D4)   |
|                                                                                                           |  |   (D5)     (D6)     (D7)     (D8)   |
| FADERS          [DIM1]   [DIM2]   [DIM3]   [DIM4]   [DIM5]   [DIM6]   [DIM7]   [DIM8]   [MASTER DIMMER]  |  | CUE LEVEL knob = rotate D1-D8 bank  |
| CUE LEVEL knob  rotates Device Control role bank                                                          |  | lower device buttons = reserved     |
+-----------------------------------------------------------------------------------------------------------+  +------------------------------------+
                                                                                                              +------------------------------------+
                                                                                                              | TRANSPORT / CROSSFADER             |
                                                                                                              | PLAY=reserved  STOP=panic stop     |
                                                                                                              | REC=arm/clear all save columns     |
                                                                                                              | CROSSFADER: Deck A <-> Deck B      |
                                                                                                              +------------------------------------+
```

### APC40 control legend, by physical area

#### Clip/session area

| APC40 hardware label | ArtBastard meaning | LED feedback |
| --- | --- | --- |
| Clip Launch pads `A01`-`A40` | Deck A scene slots. Press a saved slot to launch it. Press an armed slot to save current DMX into that slot. | Off empty, green saved, orange blink active, red blink when armed for saving. |
| Clip Launch pads `B01`-`B40` while holding `SHIFT` | Deck B scene slots. Same save/launch behavior, but on Deck B. | Same as Deck A, painted for the held deck. |
| Scene Launch buttons 1-5 | Launch ACT 1-5. | Green when ACT exists, orange blink when that ACT is playing. |
| Clip Stop 1-8 | Stop the active Deck A/B scene for that column; if no column match, stop the active deck scene. | Red while the active deck has a scene. |
| Stop All Clips | Panic-stop Deck A/B scenes and ACT playback. | Red while any Deck scene or ACT playback is active. |

#### Track strips and faders

| APC40 hardware label | ArtBastard meaning | LED feedback |
| --- | --- | --- |
| Track Selection 1-8 | Select fixture group 1-8. If that group is missing, select fixture 1-8 directly. | Green when that group/fixture is selected. |
| Master Track Selection | FULL ON latch. Press again to restore the previous DMX snapshot. | Red while FULL ON is latched. |
| Activator 1-8 | Toggle APC40 auto-control for fixture group 1-8 and select that group. | Green when group exists, orange blink while auto-control is enabled. |
| Solo/Cue 1-8 | Isolate fixture 1-8 inside the active group. Press the same Solo/Cue again to restore the prior selection. | Currently cleared/off by LED repaint. |
| Record Arm 1-8 | Arm/unarm one save column. The next grid pad in that column saves current DMX to Deck A or Deck B. | Red blink while that column is armed. |
| Track faders 1-8 | Dimmer/intensity for selected fixture slot 1-8. If no fixture is selected, the fader intentionally does nothing. | No motor/LED feedback on APC40 MK1 faders. |
| Master fader | Master dimmer for the selected lighting context. If no fixture is selected, it intentionally does nothing. | No motor/LED feedback on APC40 MK1 fader. |

#### Right-side knobs, utility, and transport

| APC40 hardware label | ArtBastard meaning | LED feedback |
| --- | --- | --- |
| Track Control encoder push/ring buttons 1-8 | Select fixture group 1-8, matching the Track Select row. This lets the operator select context from the top section before turning a knob. | No dedicated ring-button LED repaint today; the Track Select row/in-app state show selection. |
| Track Control knob 1 | Pan for selected fixtures/groups; with no selection, targets all patched fixtures. | No APC40 LED ring feedback wired today. |
| Track Control knob 2 | Tilt for selected fixtures/groups; with no selection, targets all patched fixtures. | No APC40 LED ring feedback wired today. |
| Track Control knob 3 | Red color channel for selected fixtures/groups. | No APC40 LED ring feedback wired today. |
| Track Control knob 4 | Green color channel for selected fixtures/groups. | No APC40 LED ring feedback wired today. |
| Track Control knob 5 | Blue color channel for selected fixtures/groups. | No APC40 LED ring feedback wired today. |
| Track Control knob 6 | White/amber/UV style color channel where the fixture supports it. | No APC40 LED ring feedback wired today. |
| Track Control knob 7 | Strobe/shutter role where the fixture supports it. | No APC40 LED ring feedback wired today. |
| Track Control knob 8 | Speed/rate/effect-speed role where the fixture supports it. | No APC40 LED ring feedback wired today. |
| Track Control `PAN` button | Select all fixtures. | Button LED is not currently repainted. |
| Track Control `SEND A`, `SEND B`, `SEND C` buttons | Reserved/unmapped today. They should appear in the MIDI monitor but should not change DMX. | No active ArtBastard feedback. |
| Device Control knobs 1-8 | Context-aware fixture capabilities. Default priority is Gobo, Gobo Rotate, Color Wheel, Prism, Iris, Focus, Zoom, Strobe, then adapts to selected fixtures. | Role names appear in the ArtBastard APC40 UI; no APC40 LED ring feedback wired today. |
| Cue Level knob | Rotates the Device Control role bank so D1-D8 can reach more capabilities on complex fixtures. | No APC40 LED feedback wired today. |
| Bank Select Up/Down | Previous/next fixture selection. | No active ArtBastard feedback. |
| Bank Select Left/Right | Previous/next saved scene selection. | No active ArtBastard feedback. |
| `SHIFT` | Hold for Deck B grid layer. Release returns to Deck A. | Orange while held. |
| Tap Tempo, Nudge -, Nudge + | Reserved/unmapped today. They should appear in the MIDI monitor but should not change DMX. | No active ArtBastard feedback. |
| Device lower buttons: Clip/Track, Device On/Off, arrows, Detail View, Rec Quantization, MIDI Overdub, Metronome | Reserved/unmapped today. They should appear in the MIDI monitor but should not change DMX. | No active ArtBastard feedback. |
| Transport `PLAY` | Decoded by the APC40 parser but reserved; no live action today. | No active ArtBastard feedback. |
| Transport `STOP` | Panic-stop Deck A/B scenes and ACT playback. | Orange while an ACT is playing. |
| Transport `REC` | Arm all save columns, or clear all armed columns if any are already armed. | Red blink while any save column is armed. |
| Crossfader | Blend Deck A scene values on the left with Deck B scene values on the right. Center is a 50/50 blend. | No APC40 LED feedback. |

### LED legend

| LED state | Meaning |
| --- | --- |
| Off | Empty/unavailable slot, unarmed button, or no active state. |
| Green | Saved scene/ACT or available group/selection target. |
| Orange blink | Currently active scene/ACT, or active auto-control state. |
| Green blink | Armed empty clip slot ready to save. |
| Red blink | Armed saved clip slot; pressing it overwrites that saved slot with current DMX. |
| Red solid | Record column armed, FULL ON latched, or stop/panic state indicator depending on the row. |

## Out-of-box connection

- ArtBastard must detect APC40 MIDI inputs and outputs automatically from browser Web MIDI or the local server bridge.
- The APC40 template must auto-apply without manual setup when the expected APC mappings are missing or stale.
- The MIDI monitor must show every incoming APC40 message with source, channel, note/CC, and value.
- APC40 output LEDs must connect automatically when a matching MIDI output is available.
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
- Pressing an empty armed slot saves the current lighting state into that deck slot.
- Record Arm buttons arm/unarm save columns.
- LEDs are contextual:
  - Off = empty slot.
  - Green = saved scene.
  - Orange blink = active scene for the current deck.
  - Red blink = save mode; armed Record Arm/REC controls and all clip pads in armed columns.

### Scene Launch buttons

- Scene Launch 1-5 launch ACT 1-5.
- LEDs show saved ACT state and the currently playing ACT.

### Fixture groups and selection

- Track Select 1-8 select fixture groups first, falling back to individual fixtures if a group is not defined.
- Solo/Cue 1-8 isolate a fixture inside the currently active group; pressing the same solo restores the previous fixture selection.
- Activator 1-8 toggle APC auto-control for existing fixture groups and select that group.
- Track Stop 1-8 stops the active scene in that column when it matches the current deck; otherwise it stops the current deck scene.
- Stop All and STOP stop Deck A/B scenes and ACT playback in a predictable panic-safe way.
- Master Track Select should act as FULL ON / blackout-safe performance emphasis according to the live mode state.

### Faders and knobs

- Track faders 1-8 control dimmer/intensity for selected fixture slot 1-8. If no fixture is selected, these faders intentionally do nothing rather than guessing.
- The master fader controls master dimmer for all selected fixtures. If no fixture is selected, it intentionally does nothing.
- Track Control knobs use the fixed roles Pan, Tilt, Red, Green, Blue, White, Strobe, and Speed. They apply to selected fixtures; with no selected fixtures, role-based knobs target all patched fixtures.
- Device Control knobs follow fixture roles where possible. They apply to selected fixtures; with no selected fixtures, role-based knobs target all patched fixtures:
  - pan, tilt, fine pan, fine tilt
  - red, green, blue, white/amber/UV
  - gobo, gobo rotation, color wheel
  - prism, iris, focus, zoom
  - macro, speed, shutter, strobe
- Cue Level rotates the Device Control bank through the available role list in 16-value steps.
- Unknown fixture capabilities should fail visibly in the monitor, not silently.

### Crossfader and decks

- The crossfader blends Deck A and Deck B scenes.
- Deck state should be visible in the UI and reflected by grid LEDs.
- SHIFT makes it obvious whether the operator is touching A or B deck controls.

## Visual feedback

- The APC40 visual diagram should always show the last touched control.
- The APC40 visual diagram should also show the last meaningful change: fixture, scene, device role, effect, selection, or transport action.
- The touched control should flash immediately when a MIDI message arrives.
- The visual state should show current deck, armed columns, saved slots, active scenes, ACT state, selected groups, and whether FULL ON/SHIFT is latched.
- If a MIDI message is seen in the monitor but not reflected in the visual, that is a bug.
- The DMX Activity monitor should display the same last APC40 change context and attach recent APC40 source context to DMX rows.

## Reliability rules

- MIDI routing must be single-path: one incoming hardware movement should not apply the same DMX change twice.
- Browser MIDI, server MIDI, ACT triggers, monitors, SuperControl, APC workflow, and LED feedback should share consistent message semantics.
- Channel `0` is a valid MIDI channel and must never be treated as missing.
- Note Off and zero-velocity Note On must not accidentally launch scenes.
- Hardware absence should not break the app; it should simply show no connected APC outputs.

## Current implementation map

This section is the code-backed truth table for the current app. If the implementation changes, update this table at the same time.

| Hardware control | MIDI signature currently decoded | App code path | Current behavior |
| --- | --- | --- | --- |
| Clip grid, APC40 MK1 | Notes `0x35`-`0x39`, MIDI channel = column | `decodeApc40Message` -> `clip-launch` -> `useApc40Workflow` | Launches/saves `APC40 Deck A/B 01` through `40`, depending on SHIFT/deck and armed columns. |
| Clip grid, APC40 MK2 | Notes `0x00`-`0x27` | `decodeApc40Message` -> `clip-launch` -> `useApc40Workflow` | Same scene-slot model as MK1, with row/column derived directly from note number. |
| Scene Launch 1-5 | Notes `0x52`-`0x56` | `scene-launch` -> `playAct` | Launches ACT 1-5 when the corresponding ACT exists. |
| Record Arm 1-8 | Note `0x30`, MIDI channel = column | `record-arm` -> `toggleRecordColumn` | Arms/unarms one save column. |
| REC transport | Note `0x5d` or `0x66` | `record` -> `toggleAllRecordColumns` | Arms all columns, or clears all armed columns. |
| Track faders 1-8 | CC `0x07`, MIDI channel = track index | `channel-fader` -> `applySuperControlMidi('dimmer', slotIndex)` | Dims selected fixture slot 1-8. Requires selected fixtures. |
| Master fader | CC `0x0e`, channel `0` | `master-fader` -> `applySuperControlMidi('masterDimmer')` | Dims all selected fixtures. Requires selected fixtures. |
| Track Control knobs 1-8 | CC `0x30`-`0x37`, channel `0` | `track-control` -> `APC40_TRACK_CONTROL_ROLES` -> `buildRoleUpdates` | Fixed roles: Pan, Tilt, Red, Green, Blue, White, Strobe, Speed. Targets selected fixtures, or all fixtures if no selection exists. |
| Track Control encoder push/ring buttons 1-8 | CC `0x38`-`0x3f`, channel `0` | `track-select` | Selects group 1-8, falling back to fixture 1-8. A short post-selection guard ignores accidental encoder movement caused by the same button press. |
| Device Control knobs 1-8 | CC `0x10`-`0x17`, channel `0` | `device-control` -> `resolveApc40DeviceRoleSlots` -> `buildRoleUpdates` | Context-aware roles from selected fixture capabilities; targets selected fixtures, or all fixtures if no selection exists. |
| Cue Level | CC `0x2f`, channel `0` | `cue-level` -> `deviceRoleBankRef` | Rotates the Device Control role bank. |
| Crossfader | CC `0x0f`, channel `0` | `crossfader` -> `blendApc40DeckScenes` | Blends the currently assigned Deck A and Deck B scenes. If either deck has no scene, there is no DMX blend update. |
| Track Select 1-8 | Note `0x33`, MIDI channel = track index | `track-select` | Selects group 1-8, falling back to fixture 1-8. |
| Master Select | Note `0x33`, MIDI channel `8` | `master-button` -> `buildFullOnUpdates` | FULL ON latch, excluding reset/lamp/function/mode/sound/auto-style channels; second press restores the previous DMX snapshot. |
| Solo/Cue 1-8 | Note `0x31`, MIDI channel = track index | `solo-cue` | Isolates a fixture from the active group; same solo restores previous selection. |
| Activator 1-8 | Note `0x32`, MIDI channel = track index | `activator` | Toggles auto-control for group 1-8 and selects that group. |
| Track Stop 1-8 | Note `0x34`, MIDI channel = track index | `track-stop` | Clears the current deck scene in that column when it matches; otherwise clears the current deck scene. |
| Stop All Clips / STOP | Note `0x51` or `0x5c` | `stop-all-clips` / `stop` | Clears Deck A/B scene refs, clears armed columns, stops ACT playback, and stops scene timelines. |
| SHIFT | Note `0x62`, press/release aware | `shift` | Held state switches clip grid operations and LED paint to Deck B. |
| PAN utility button | Note `0x57` | `select-all` | Selects all fixtures. |
| Fixture navigation | Notes `0x5e` / `0x5f` | `nav-fixture` | Previous/next fixture. |
| Scene navigation | Notes `0x60` / `0x61` | `nav-scene` | Previous/next scene. |
| PLAY transport | Note `0x5b` | Decoded as `play` | Reserved/no live action in `useApc40Workflow` today. |

### Current LED implementation

| Surface | Code-backed LED behavior |
| --- | --- |
| Clip grid | Paints the active deck only: off = no saved scene, green = saved scene, orange blink = active deck slot, red blink = armed save column. |
| Scene Launch | Green when ACT exists; orange blink when that ACT is playing. |
| Record Arm row | Red blink while that column is armed. |
| Track Select row | Green when the corresponding group/fixture is selected. |
| Activator row | Green when a group exists; orange blink while APC40 auto-control is enabled for that group. |
| Track Stop row | Red while the current deck has an active scene. |
| Master Track Select | Red while FULL ON is latched. |
| Stop All Clips | Red while Deck A/B scene or ACT playback is active. |
| SHIFT | Orange while SHIFT is held. |
| REC | Red blink while any save column is armed. |
| STOP | Orange while an ACT is playing. |

### Source files to check when this doc changes

| App concern | Source file |
| --- | --- |
| APC40 MIDI decoding and note/CC signatures | `react-app/src/midi/apc40.ts` |
| Deck scene naming, fixture role aliases, role updates, crossfader blending | `react-app/src/midi/apc40WorkflowHelpers.ts` |
| Live APC40 behavior and state transitions | `react-app/src/hooks/useApc40Workflow.ts` |
| APC40 LED repaint rules | `react-app/src/hooks/useApc40LedFeedback.ts` |
| APC40 template fallback bindings | `react-app/src/components/midi/midiControllerTemplates.ts` |
| Floating DMX natural-language activity monitor | `react-app/src/components/dmx/DmxMonitor.tsx` and `react-app/src/components/dmx/dmxActivityNarration.ts` |
| In-app APC40 surface/manual display | `react-app/src/components/midi/Apc40SurfaceDiagram.tsx` and `react-app/src/components/midi/Apc40Manual.tsx` |
