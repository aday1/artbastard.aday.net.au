# APC40 MK1 Cheatsheet

The live APC40 integration is a runtime workflow hook
(`react-app/src/hooks/useApc40Workflow.ts` + `useApc40LedFeedback.ts`).
It binds the surface to Super Control, scenes, fixture selection, and a
two-scene crossfader. Plug the device in — no template apply required.

## At a glance

| Button | Function | LED feedback |
| --- | --- | --- |
| **Scene 1–5** (right column) | Launch the scene (load DMX) | green = saved, red-blink = active, orange-blink = bound to crossfader A or B |
| **REC** (transport row) | Toggle **SAVE mode** | red while mode is armed |
| **PLAY** (transport row) | Toggle **pick Scene A** mode | green while mode is armed |
| **STOP** (transport row) | Toggle **pick Scene B** mode | red while mode is armed |
| **SHIFT** | Cancel any active mode (or latch shift if no mode) | orange while latched |
| **TRACK SELECT 1–8** | Select that fixture (single-pick), or that fixture group | green when the slot is selected |
| **ACTIVATOR 1–8** | Toggle that fixture in/out of the multi-selection | red = selected, green = available, off = empty slot |
| **SOLO 1–8** | Collapse selection to just that fixture | dark (momentary gesture) |
| **TRACK STOP 1–8** | Deselect all fixtures | n/a |
| **PAN** | Select all fixtures | n/a |
| **CLEAR** | Deselect all fixtures | n/a |
| **Nav ↑ / ↓** | Cycle through fixtures | n/a |
| **Nav ← / →** | Cycle through scenes | n/a |
| **Clip grid row 0** (notes 0x35, per column) | Toggle that fixture in/out of selection (same as ACTIVATOR) | red = selected, green = available, off = empty |
| **Clip grid row 0** on an empty column | Fire `artbastard:apc40-add-template` event | n/a |
| **Channel fader 1** | Super Control → **dimmer** | n/a |
| **Channel fader 2** | Super Control → **pan** | n/a |
| **Channel fader 3** | Super Control → **tilt** | n/a |
| **Channel fader 4** | Super Control → **red** | n/a |
| **Channel fader 5** | Super Control → **green** | n/a |
| **Channel fader 6** | Super Control → **blue** | n/a |
| **Channel fader 7** | Super Control → **gobo** | n/a |
| **Channel fader 8** | Super Control → **strobe** | n/a |
| **Master fader** | Drives every fixture's dimmer (global) | n/a |
| **Crossfader** | Blend between scene A and scene B (assign via PLAY / STOP modes) | n/a |

## Workflow modes

A mode is a one-shot intent — arm it on REC / PLAY / STOP, then the next
scene-pad tap consumes it. While any mode is armed, **all five scene pads
green-blink** so you see every tap target is live; the transport-row LED
tells you which mode is active.

### SAVE mode (REC button)

1. Tap **REC** → REC LED red, scene pads green-blink.
2. Tap any **scene pad** → that slot saves the current DMX state.
   - Empty slot → fills with a default name `APC40 Scene N`.
   - Filled slot → overwrites the existing scene by name.
3. Mode auto-exits after the save.
4. Tap REC again (or SHIFT) to cancel without saving.

### Pick Scene A (PLAY button)

1. Tap **PLAY** → PLAY LED green, scene pads green-blink.
2. Tap a **saved scene pad** → that scene becomes crossfader A.
3. Empty pad → warning toast, mode stays armed.
4. Mode auto-exits after the assignment.

### Pick Scene B (STOP button)

1. Tap **STOP** → STOP LED red, scene pads green-blink.
2. Tap a **saved scene pad** → that scene becomes crossfader B.
3. Same empty-pad and auto-exit behavior as pick A.

### Crossfade

Once both A and B are assigned (the bound pads show **orange-blink** when
no other mode is active), move the **crossfader**:

- 0 = full A
- 127 = full B
- Anywhere in between blends the two scenes' DMX values linearly,
  channel-by-channel, including any channels only one side touches.

The blend writes directly to DMX — it does not load either scene, so your
"active scene" indicator (red-blink) is not affected.

## Multi-selection patterns

| Gesture | Result |
| --- | --- |
| **TRACK SELECT** column N | Replace selection with fixture (or group) N |
| **ACTIVATOR** column N (filled) | Toggle fixture N in/out of selection |
| **ACTIVATOR** column N (empty fixture slot) | No-op (LED off) |
| **SOLO** column N | Selection collapses to just fixture N |
| **TRACK STOP** any column | Deselect all |
| **CLEAR** | Deselect all |
| **PAN** | Select all fixtures |

The ACTIVATOR row is your live "what is currently selected" indicator —
red on every column whose fixture is in `selectedFixtures`.

## Faders → Super Control

Channel faders go through `applySuperControlMidi(control, value)` which
walks the current `selectedFixtures` and writes the matching channel type
on each. Aliases resolve via the Super Control channel-type map:

| Fader | Control | Channel-type aliases matched |
| --- | --- | --- |
| 1 | dimmer | dimmer, intensity, master |
| 2 | pan | pan, p |
| 3 | tilt | tilt, t |
| 4 | red | red, r |
| 5 | green | green, g |
| 6 | blue | blue, b |
| 7 | gobo | gobo, gobowheel, gobo_wheel |
| 8 | strobe | strobe, shutter |

The **master fader** writes every fixture's first dimmer/intensity/master
channel directly via `setDmxChannelValue` — it ignores selection so it
behaves as a global brightness even when nothing is selected.

## LED legend (scene pads)

| Velocity | Color | Meaning |
| --- | --- | --- |
| 0 | off | empty slot |
| 1 | green | saved scene |
| 2 | green-blink | **mode armed** (save / pickA / pickB) — tap me |
| 3 | red | (unused on scene pads) |
| 4 | red-blink | scene is currently active (last loaded) |
| 5 | orange | (unused on scene pads) |
| 6 | orange-blink | scene is bound to crossfader A or B |

A scene that is both active **and** bound to A/B shows red-blink
(active wins, because the load is the more recent state).

## Hot-plug

The LED hook subscribes to `MIDIAccess.onstatechange`. Plug the APC40 in
after the app loaded → the surface is repainted with the full current
state (scenes, selection, A/B bindings, active mode) in a single sweep.

## Cancel everything

- **SHIFT** cancels any active mode without touching scenes.
- The mode auto-exits after a successful action so you rarely need to.

## Things that **no longer** happen (intentionally)

- Per-channel REC ARM (note 0x30) does not quick-capture a scene anymore.
  Use the transport REC + scene-pad tap instead.
- PLAY no longer dispatches `artbastard:apc40-create-show`.
- STOP no longer deselects all fixtures (use CLEAR or TRACK STOP).
- SHIFT + scene-pad no longer assigns to crossfader A/B (use PLAY/STOP
  modes instead).
