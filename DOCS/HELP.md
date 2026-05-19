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
3. Open Fixture Setup to define fixtures and groups.
4. Save a baseline scene from SuperControl.
5. Configure MIDI controllers or OSC clients in Settings.
6. Open Scenes & Acts for timeline / clip launcher work, or run the show
   from the DMX Control page.

Routes (hash-based, deep-linkable):

- `#/` - DMX Control home
- `#/fixture` - Fixture Setup + Advanced Fixture Control (SuperControl)
- `#/scenes-acts` - Scenes, ACT triggers, Timeline
- `#/experimental` - OpenCV tracker, OSC placeholder, TouchOSC export
- `#/external-console` - Dedicated operator route
- `#/mobile` - Touch-first phone surface
- `#/settings` - Settings, including embedded Help

System requirements:

- Node.js 20+
- Modern browser (Chrome, Firefox, Edge, Safari)
- USB DMX interface or Art-Net compatible device
- Optional: MIDI controller, OSC client, TouchOSC tablet
- Cloud + LAN: Raspberry Pi running `artbastard-bridge` if fixtures are on a
  private network (see section 17)

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
- Footer / status row

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

The full SuperControl OSC reference lives in DOCS/OSC_REFERENCE.md (also
discoverable in-app via Experimental > OSC Placeholder).

---

## 6. TouchOSC Workflow

1. Open the Experimental page, TouchOSC tab
   (`#/experimental?tab=touchosc`).
2. Choose the layout style and channel count.
3. Click Generate to produce the `.tosc` file.
4. Click Upload to push it to your tablet over the network. Status
   feedback appears next to the upload button.
5. If you want a copy, hit Download or fetch it from the runtime endpoint.
6. Smoke covered by `npm run test:touchosc-workflow`.

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

ACTs work alongside scene timelines, act timelines, and the clip launcher.

---

## 11. Controller Templates

Apply factory-tuned MIDI mappings in one click. Two templates ship today:

- Behringer X-Touch (Mackie mode) - faders, pan, encoders, scribble strip
  SysEx labelling.
- Akai APC40 MK1 - pad grid for scenes, knobs for SuperControl axes.

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

## 12. Mobile & External Console

`#/mobile`:

- Touch-first surface targeted at phones (430x932-ish viewport).
- Larger tap targets, one-thumb friendly chrome.
- Disables the floating monitors by default to keep the surface clean.

`#/external-console`:

- Dedicated operator route for a second screen / lighting desk.
- Uses the same scene and channel state as the main app.
- Hash-based deep linking lets you bookmark a known good layout.

Both routes share the canonical state, so changes in one reflect
immediately in the other and in the main browser.

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

TouchOSC

- Upload fails: confirm the tablet IP is reachable, then try the runtime
  endpoint download as a fallback.

LAN / Pi Bridge

- Bridge disconnected: token, Pi online, outbound HTTPS.
- No LAN output: Art-Net IP, Pi on same subnet as node.
- Cloud OK but dark fixtures: bridge must be connected.

Build / start

- `./start.sh --reset` for a clean rebuild.
- If `dist/server.js` is missing, run `npm run build` first.
- Demo capture requires Xvfb + ffmpeg + xdotool + google-chrome (already
  installed in the project's dev container).

---

## 17. Video Tour

Eight short WebM clips of every major surface live at
`website/videos/`. The showcase page embeds them with poster fallbacks
and lazy load. Run `npm run demo:capture-videos` to regenerate from the
running app.
