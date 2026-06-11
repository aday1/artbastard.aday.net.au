# ArtBastard Help (Offline Mirror)

This page mirrors the in-app HelpOverlay so it can be read offline or while
the app is not running. Inside the app you can reach the same content with
`Ctrl+H` or via Settings > Help.

Sections below are ordered to match the help overlay tabs.

---

## 1. Getting Started

ArtBastard DMX512 is a browser-based DMX lighting control system that sends
512-channel universes over Art-Net and accepts MIDI Learn / OSC for
external control.

Quick start:

1. Launch the system (`./start.sh` or `.\start.ps1`).
2. Connect your DMX interface (USB or Art-Net node).
3. Open Fixture Setup, place fixtures on the stage map, and create or apply groups.
4. Select fixtures on the map and save a baseline scene from SuperControl.
5. Configure MIDI controllers or OSC clients in Settings.
6. Open Acts for act timelines, or Scenes for scene capture / clip launcher work. Run the show
   from the DMX Control page.

Routes (hash-based, deep-linkable):

- `#/` - DMX Control home
- `#/fixture` - Fixture Setup + Advanced Fixture Control (SuperControl)
- `#/scenes-acts` - Scenes and scene timelines
- `#/acts` - Act timeline builder and ACT triggers
- `#/mobile` - Touch-first phone surface
- `#/settings` - Settings, including embedded Help

System requirements:

- Node.js 20+
- Modern browser (Chrome, Firefox, Edge, Safari)
- USB DMX interface or Art-Net compatible device
- Optional: MIDI controller, OSC client, tablet controller
- Cloud + LAN: Raspberry Pi running `artbastard-bridge` if fixtures are on a
  private network (see section 15)

---

## 2. DMX Control Basics

Hardware setup:

1. Connect your DMX interface to the host.
2. Chain fixtures with XLR (3 or 5 pin).
3. Set unique DMX addresses on each fixture.
4. Terminate the chain with a 120-ohm terminator.

The DMX Control page is modular:

- Header with master fader and global state
- Filters and fixture selector
- Channels viewport / cards (grid or list)
- Pinned channels summary
- Scene controls
- MIDI connections panel
- Automation workbench (envelopes + transition tracker)
- Footer / status row

Automation workbench (DMX Control > Automation toggle):

- Envelopes tab: LFO-style curves per channel (draw / line / erase tools).
- Transition tracker tab: Renoise-style pattern grid for stepped DMX transitions.

Transition tracker columns:

- Row: pattern line index (playhead highlights during playback).
- Scene: optional scene to load at this line (uses transition settings below).
- TD: transition duration in ms to the next line (or BPM line time when sync on).
- EZ: easing code (LN linear, IO easeInOut, EI easeIn, EO easeOut, C3 cubic, Q4 quart, SN sine).
- Sn: snap checkbox (instant channel values, no ramp).
- Ch###: hex DMX values 00-FF per channel; .. means no change.

Tracker channel list (v5.15.0):

- The grid shows only channels on the active **page** (chip list above the grid).
- Add: channel number + Add, **+ Selection** (DMX selection), or **Fixture lanes**
  (collapsible) for pan/tilt, RGB, gobo, etc.
- Remove: **x** on a chip or **Clear all**. **+ Pinned** optionally adds
  sidebar-pinned channels to the grid.
- New pages start with no columns. Older saved patterns may still have CH 1-8
  from a previous default; trim with **x** or **Clear all**.
- **Env to grid** / **Grid to env** sync automation envelopes with locked columns.

Settings > Theme (v5.15.0):

- HSL and rack preset changes apply to the UI immediately (no Save click).
- Changes debounce to the server; use **Sync now** to push immediately or
  **Reload UI** to pull shared appearance from the server.

Act steps can reference a saved pattern (patternId) instead of scene-only playback.
Scene timeline editor includes a Pattern drawer for scene-scoped patterns.

Common issues:

- No output: check interface connection and drivers.
- Flickering: loose connection or missing terminator.
- Wrong colours: confirm address and channel mapping.
- Partial control: verify the fixture mode matches your profile.
- Restart issues: run `./start.sh --reset` (or `-Reset` on Windows) for a
  clean rebuild.

---

## 3. DIP Switch Calculator

Open Help > DIP Simulator to compute which DIP switches must be ON for any
DMX address (1-512). The simulator shows the binary pattern alongside a
visual representation of a fixture's switch block, and updates in real time
as you change the address.

Fixture Setup now opens as a canvas-first stage map. Drag a library profile
onto the map, or tap a profile and then tap the stage on mobile. The fixture is
patched immediately with the next available DMX address, selected globally, and
available to SuperControl and APC40 fixture selection. Top and Side view use
the same saved coordinates. Use Smart Groups for capability groups and
map-aware Stage Left, Center, Right, Upstage, and Downstage groups.

Stage canvas tutorial:

1. Place fixture profiles on the map until the screen matches the physical rig.
2. Use the inspector to rename fixtures, correct addresses, rotate icons, and
   clear conflict warnings.
3. Click, shift-click, or box-select fixtures to build the global selection.
4. Create groups from the selection or run Smart Groups for capability and
   position-based groups.
5. Open SuperControl and drive the selected fixtures by detected roles such as
   dimmer, color, pan/tilt, gobo, movement, and strobe.
6. Save baseline scenes, or optionally use Seed Scenes, Seed ACTS, or Giddy Up
   after fixture output is proven.

The full written tutorial is DOCS/STAGE_CANVAS_TUTORIAL.md.

---

## 4. MIDI Setup

Connection:

1. Connect a USB or DIN MIDI device to the host.
2. Grant Web MIDI permission in the browser when asked.
3. Select the device in Settings > MIDI.
4. Verify with the MIDI Monitor (also available from Help).

Mappings:

- Faders -> DMX channels
- Pads / keys -> Scene triggers
- Rotary knobs -> SuperControl axes (dimmer, RGB, pan/tilt, etc.)
- Pitch-bend -> any mappable target

Message types supported:

- Control Change (CC)
- Note On / Note Off
- Program Change
- Pitch Bend
- Aftertouch (passthrough only)

For controller-specific defaults, see DOCS/MIDI_TEMPLATES.md.

---

## 5. OSC Integration

Network setup:

1. Configure the OSC receive port (default 8080).
2. Allow the port through your firewall if remote.
3. Note the host IP for remote control.
4. Send a test message and verify in the OSC Monitor.

Address patterns:

- `/dmx/channel/[1-512]` - direct DMX channel control
- `/scene/trigger/[name]` - trigger a saved scene by name
- `/master/brightness` - master brightness 0.0-1.0
- `/fixture/[id]/brightness` - per-fixture brightness
- `/fixture/[id]/color/[r,g,b]` - per-fixture RGB

The full SuperControl OSC reference lives in DOCS/OSC_REFERENCE.md.

---

## 6. OSC Tablet Workflow

1. Use the OSC address reference in DOCS/OSC_REFERENCE.md.
2. Build the tablet layout in your OSC client of choice.
3. Map SuperControl, scene, ACT, master, fixture, or direct channel addresses.
4. Watch the in-app OSC Monitor while sending test messages.
5. Keep the tablet and ArtBastard host on the same reachable network.

---

## 7. Scene Management

Create:

1. Adjust fixtures to the desired look.
2. Click Save in SuperControl.
3. Name the scene and (optionally) attach an OSC trigger address.

Recall:

- Click in the Scenes panel
- Trigger by MIDI Note / CC
- Trigger by OSC `/scene/trigger/<name>`
- Set fade times if you want a soft transition

Seed:

- Add fixtures first on the Fixture Setup stage map, then use **Seed Scenes** in Fixture Setup or Scenes &
  Acts.
- **Smart Starter 40** fills Deck A or Deck B with ready-made looks such as
  `Red Slow`, `Wash Fast`, `Gobo Texture`, and `Strobe All Move 90`.
- **Smart A+B 80** fills both APC40 decks with crossfader-friendly variants.
- **Compact Starter 16** creates a smaller set of essential scene slots.
- Optional automated timelines add slow/fast dimmer, color, movement, gobo,
  and strobe patterns when matching fixture roles exist.
- Reseeding updates generated scenes only; handmade scenes are preserved.
- After scenes exist, **Seed ACTS** can optionally create Starter ACTS 5 or
  Performance ACTS 8 from those scenes. Reseeding updates generated ACTS only;
  handmade ACTS are preserved.
- Skip scene seeds, ACT seeds, or both whenever you want to build from scratch.

Organise:

- Use prefixes like `Verse_`, `Chorus_`, `Bridge_` for live shows.
- Number scenes for fast MIDI / OSC mapping.
- Export scene lists for backup, import on a new install.

---

## 8. Timeline editors

### 8a. Scene timeline (DMX animation)

The Scenes & Acts page hosts a DAW-style timeline **per scene**. Key behaviours:

- Keyframes display the actual DMX value (0-255) and percentage.
- Tooltips show fixture and channel names.
- Easings: linear, ease-in, ease-out, smooth, step.
- Multi-track view; one track per channel with mute / solo / collapse.
- Snapping: optional grid snap; on/off from the toolbar.
- Drag preview shows exact time while dragging.

Keyboard shortcuts (full list in DOCS/SHORTCUTS.md):

- Space - Play / Pause
- Home / End - jump to start / end
- Shift + arrow - nudge playhead or selected keyframe
- Ctrl + C / V - copy / paste keyframes
- Delete - delete selected keyframes
- Ctrl + Z / Y - undo / redo
- Ctrl + A - select all keyframes

### 8b. Act timeline (show sequencing)

Open an Act from Scenes & Acts to edit the **act timeline** (scene clips,
gaps, MIDI/OSC lanes). Full reference: DOCS/ACT_TIMELINE.md.

Editing:

- **Seed ACTS** beside Create New Act is optional. Starter ACTS 5 creates five
  ACTS for APC40 Scene Launch 1-5; Performance ACTS 8 adds longer show-section
  templates. Generated ACTS can be edited, deleted, or ignored.
- Drag a **clip** horizontally to change its **start time** (not list order).
- Resize the right edge to change clip duration.
- **+2s gap** (clip selected) shifts that clip and later clips later.
- **Extend +5s** adds empty timeline past the last clip.
- **Add step** places a new clip at the **playhead**.
- Click the ruler or drag the playhead to seek/scrub.

Transport vs clock:

- **ACT triggers** (MIDI/OSC/keyboard): play, pause, stop, next, prev,
  toggle for the act — this is how you **start** an act from outside the UI.
- **Sync to BPM** on the act uses the **app BPM** (bar multiplier); it does
  not start Ableton Live.
- **Ableton Link** (Settings → tempo source, Pi bridge): shared **BPM** only,
  not Live arrangement transport.
- **Timeline MIDI/OSC lanes**: events at absolute ms during act playback
  (scheduled cues). Use these for "fire OSC at 1:30", not for act play/stop.

---

## 9. Clip Launcher

Session-style grid for live performance, inspired by Ableton Live.

- Default grid is 4x4, customisable.
- Click an empty cell to assign a scene; click a populated cell to launch.
- Double click to edit clip properties.
- Visual states: playing, queued, recording, empty (dashed border).
- Loop toggles per clip; Stop All halts every clip at once.
- Multiple clips can play simultaneously for layered effects.

---

## 10. ACT Triggers

ACT triggers are **transport** for a specific act (not tempo clock, not
Ableton Live start/stop unless you map it separately). Bind to MIDI, OSC,
or keyboard:

- play - start act playback (loads current step scene)
- pause - pause without resetting act position
- stop - stop and rewind act
- next - advance to the next act step (scene clip)
- prev - go back to the previous act step
- toggle - switch play / pause based on current state

OSC examples: `/act/play`, `/act/pause`, `/act/stop`, `/act/next`,
`/act/prev`, `/act/toggle` (see DOCS/OSC_REFERENCE.md for your mapping).

Pause + play resumes from the same offset. For bar-aligned act length, use
**Sync to BPM** on the act plus app BPM or Ableton Link (DOCS/ACT_TIMELINE.md).

ACTs work alongside scene timelines, act timelines, optional ACT seeds, and the
clip launcher.

---

## 11. Controller Templates

Apply factory-tuned MIDI mappings in one click. Two templates ship today:

- Behringer X-Touch (Mackie mode) - faders, pan, encoders, scribble strip
  SysEx labelling.
- Akai APC40 MK1 - Deck A/B scene grid, ACT launch buttons, optional ACT seeds for Scene Launch 1-5, Record Arm scene saves, Device Control gobo/effects roles.

Apply via UI (Settings > MIDI > Apply Template) or via REST:

```
POST /api/midi/controller-template
Content-Type: application/json
{ "template": "xtouch" }    // or "apc40"
```

Pitch-bend is supported in both directions; the X-Touch template wires the
master and per-channel faders to pitch-bend by default.

Full mapping tables live in DOCS/MIDI_TEMPLATES.md.

---

## 12. Mobile Surface

`#/mobile`:

- Touch-first surface targeted at phones (430x932-ish viewport).
- Larger tap targets, one-thumb friendly chrome.
- Disables the floating monitors by default to keep the surface clean.

The mobile route shares the canonical state, so changes on the phone
reflect immediately in the desktop browser.

---

## 13. Factory Reset

Reset clears DMX state, configuration, and scene definitions.

Via UI:

1. Settings > Reset.
2. Confirm the dialog.
3. The page reloads on a fresh state.

Via API:

```
DELETE /api/state
DELETE /api/config
DELETE /api/scenes
GET    /api/factory-reset-check    # returns true once reset has occurred
```

Via launcher:

```
./start.sh --reset
.\start.ps1 -Reset
```

Always export a backup first (`/api/config` + `/api/scenes` GET) if your
show is irreplaceable.

---

## 14. Keyboard Shortcuts

The full shortcut master list lives in DOCS/SHORTCUTS.md and inside the
app under Help > Shortcuts. Quick highlights:

- Ctrl + H - toggle help
- Ctrl + / - focus search inside help
- ? - keyboard shortcuts modal
- Space - emergency blackout (or timeline play / pause in editor)
- B - toggle blackout
- M - toggle master fader
- 0 - zero all faders
- 1-9 - trigger scenes 1-9
- Ctrl + S - quick save scene
- Tab / Ctrl+Tab - cycle / focus panels
- F11 - toggle fullscreen

---

## 15. LAN / Pi Bridge

Use when ArtBastard runs on the cloud (artbastard.aday.net.au) but your
Art-Net interface is on a home or venue LAN (for example 192.168.1.*).

Setup:

1. On a Pi on that LAN: install Node 20, build `bridge-agent/`, configure
   `~/.artbastard/bridge.json` (see DOCS/BRIDGE.md).
2. In the web app: Settings > Network > LAN Bridge > generate token.
3. Set Art-Net target IP; click Apply. Status should show bridge connected.
4. Move faders in the UI; output appears on the LAN node.

Multiple operators:

- Several browsers can connect at once (desk, tablet, phone).
- All share one DMX state on the server; every change syncs to every client
  and is sent to the Pi bridge.
- One active bridge per show is supported today.

Ableton Link:

- Enable Link on the Pi bridge and in Ableton Live (same LAN).
- Choose tempo source **Ableton Link** in BPM / Auto Scene.
- Link shares **BPM** with ArtBastard; it does **not** mirror Live transport
  or auto-start acts. Use ACT triggers or timeline OSC events for show control.

Future:

- Separate isolated sessions (different venues, tenants, or universes with
  no shared state) are not implemented yet; plan for that when you outgrow
  a single shared show.

---

## 16. Troubleshooting

DMX

- No output: check the interface, the start address, and the universe.
- Flicker: terminator missing, or RJ-45 / XLR connection loose.
- Wrong colour: profile mismatch; verify channel mode in Fixture Setup.

MIDI

- Device not listed: re-grant Web MIDI permission, or restart the browser
  with the device already plugged in.
- Mappings lost: load the controller template again, or restore the
  configuration backup.

OSC

- Messages not received: check the listening port, verify the firewall,
  use the OSC Monitor to confirm packets are arriving.

LAN / Pi Bridge

- Bridge disconnected: token, Pi online, outbound HTTPS.
- No LAN output: Art-Net IP, Pi on same subnet as node.
- Cloud OK but dark fixtures: bridge must be connected.

Build / start

- `./start.sh --reset` for a clean rebuild.
- If `dist/server.js` is missing, run `npm run build` first.
- Demo screenshots require Chrome or Edge; videos also require ffmpeg.
  Use `CAPTURE_CHROME` / `CAPTURE_FFMPEG` when the tools are outside PATH.

---

## 17. Operator Video Tour

Six short WebM walkthrough clips of the current primary surfaces live at
`website/videos/`. The showcase page embeds them with poster fallbacks and
lazy load. Watch order:

1. Stage Canvas and Super Control - place fixtures, build groups, drive roles.
2. DMX Control Home - drive faders, filters, master, MIDI, and OSC.
3. Scenes and Clip Launcher - capture scenes and launch APC40 Deck A/B slots.
4. Acts Timeline - build show sequences with clips, gaps, MIDI, and OSC.
5. Mobile Control Surface - operate from phone/tablet.
6. Settings and In-App Help - configure network, bridge, theme, and Help.

Run `npm run demo:capture-videos` to regenerate the clips from the running
app.
