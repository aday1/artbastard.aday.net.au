# ArtBastard Usage Guide

## Cloud hosting and LAN / Pi bridge

The live site (artbastard.aday.net.au) runs on a cloud VPS. It cannot send
Art-Net UDP to your home LAN. For fixtures on 192.168.1.*:

1. Run `artbastard-bridge` on a Raspberry Pi on that LAN (see DOCS/BRIDGE.md).
2. In the web UI: Settings > Network > generate bridge token, set Art-Net IP.
3. Control from any browser; DMX flows cloud -> bridge -> Art-Net node.

**Concurrent operators:** Many browsers may connect at the same time (FOH desk,
tablet, phone). Everyone sees the same DMX state; any fader move updates all
clients and the Pi bridge. This is intentional for one show / one universe.

**Later:** If you need multiple separate shows (different state per venue or
tenant), that will require a future sessions model. Today there is a single
shared universe per server instance.

## Operator flow

Recommended order for a new session:

1. Configure fixtures and groups in Fixture Setup.
2. Open DMX Control and verify channel response.
3. Optionally use **Seed Scenes** to generate starter APC40 slots from those fixtures.
4. Save or fine-tune baseline scenes from SuperControl.
5. Optionally use **Seed ACTS** after scenes exist to create ready-made show sections.
6. Open Scenes and Acts for timeline or clip workflows.
7. Configure MIDI / OSC mappings or apply a controller template.
8. Validate tablet OSC mappings if you use a remote desk.

## Routes

Hash-based deep linking - bookmark any of these:

- `#/dmx-control`
- `#/fixture`
- `#/scenes-acts`
- `#/acts`
- `#/mobile`
- `#/settings`

Legacy aliases such as `#/external-console` and `#/experimental` currently
resolve back to `#/dmx-control`; they are not part of the current showcase
tour.

## Operator how-to videos

The public showcase embeds six current WebM walkthrough clips recorded from
the running app. Watch order:

1. Fixture Setup and Super Control - patch fixtures, groups, roles, XY pad.
2. DMX Control Home - channel grid, faders, filters, master, MIDI, OSC.
3. Scenes and Clip Launcher - scene capture, keyframes, APC40 Deck A/B slots.
4. Acts Timeline - scene clips, gaps, ACT transport, scheduled MIDI/OSC.
5. Mobile Control Surface - touch-first phone/tablet operation.
6. Settings and In-App Help - theme, network, bridge, Help / Ctrl+H.

Public tour: https://aday1.github.io/artbastard.aday.net.au/#tour

## MIDI controller templates

Apply via UI (Settings > MIDI > Apply Template) or via REST:

```
POST /api/midi/controller-template
Content-Type: application/json
{ "template": "xtouch" }   // or "apc40"
```

Effects:

- Standard mappings are applied immediately.
- X-Touch scribble strips receive DMX channel labels via SysEx.
- Pitch-bend mappings are wired for the X-Touch master and per-channel
  faders.
- User MIDI Learn entries on other controls are not affected.

Full mapping tables: DOCS/MIDI_TEMPLATES.md.

## Roli Lightpad / Roliblock LED feedback

Super Control can auto-map a Roli Lightpad Block through browser Web MIDI with
SysEx enabled. Touch input drives the pan/tilt XY pad and the pad LEDs mirror
the active path:

- The 15x15 LED grid uses top-left origin coordinates, matching the XY pad.
- Fast drawn strokes are rasterized into continuous grid lines, so loops do
  not disappear into sparse one-pixel hops.
- The live cursor has a four-neighbour halo; edge touches stay full brightness
  instead of being dimmed by clamped halo pixels.
- The LED encoder uses the BLOCKS BitmapLED BGR565 byte order shared with the
  Macroverse Roliblock implementation.
- Larger RGBA/canvas sources can be downsampled to 15x15 before sending, which
  is the path to shader-style visual LED feeds when needed.

## OSC tablet workflow

1. Use DOCS/OSC_REFERENCE.md for the current SuperControl, scene, ACT,
   master, fixture, and channel addresses.
2. Build the tablet surface in your OSC client of choice.
3. Send test messages and watch the in-app OSC Monitor.
4. Keep the tablet and ArtBastard host on the same reachable network.

The legacy TouchOSC generator remains test-covered by
`npm run test:touchosc-workflow`, but it is not a primary routed showcase
surface in v5.2.4.0.

## Scene workflow

1. Define fixtures first; the seed generator is fixture-role aware.
2. Click **Seed Scenes** in Fixture Setup or Scenes and Acts.
3. Choose a pack:
   - **Smart Starter 40** fills one APC40 deck with color, wash, movement,
     gobo, strobe, and combo looks.
   - **Smart A+B 80** fills Deck A and Deck B with crossfader-friendly
     variants.
   - **Compact Starter 16** fills the first 16 slots with essential looks.
4. Leave **Include automated timelines** on if you want slow/fast movement,
   dimmer pulse, color cycle, gobo rotation, and strobe movement templates.
5. Fine-tune any generated scene, or capture the current output as a new scene
   from SuperControl.
6. Recall by clicking, by APC40 grid slot, by MIDI, or by OSC
   `/scene/trigger/<name>`.
7. Set fade times for soft transitions.

Reseeding updates only scenes tagged as generated by ArtBastard. Handmade
scenes are preserved, and handmade APC40 slot-name collisions are skipped with
a warning.

Safety rules: generated templates never write nonzero values to lamp, reset,
function, mode, sound, or auto channels. Templates only use fixture channel
roles and ranges that are present in your patch.

## ACT seed workflow

ACT seeds are optional. Use them only after you have saved scenes, or after you
have used **Seed Scenes** to make starter APC40 slots.

1. Open `#/acts`.
2. Click **Seed ACTS** beside **Create New Act**.
3. Choose a pack:
   - **Starter ACTS 5** creates five ACTS for the APC40 Scene Launch buttons:
     Color Warmup, Red Slow, Wash Fast, Gobo Texture, and Strobe Move 90.
   - **Performance ACTS 8** adds longer Opening Build, Movement Sweep, and
     Finale Punch show sections.
4. Leave **Add OSC play/stop triggers** on if you want `/act/seed/<name>/play`
   and `/act/seed/<name>/stop` triggers.
5. Edit, delete, or ignore any generated ACT. They are normal ACTS after
   creation.

Reseeding updates only ACTS tagged as generated by ArtBastard. Handmade ACTS
are preserved, and handmade name collisions are skipped with a warning. You can
skip both scene seeds and ACT seeds entirely when building from scratch.

## Scene timeline workflow

1. Open Scenes and Acts and edit a scene's timeline.
2. Add tracks for the channels you want to animate.
3. Press `K` at the playhead to add a keyframe (or click in the track).
4. Drag keyframes to scrub their value; the drag preview shows the exact
   time.
5. Use `Space` to play / pause, `Home` / `End` to jump to the boundaries.

Full shortcut list: DOCS/SHORTCUTS.md.

## Act timeline workflow

1. Open `#/acts` and choose, create, or optionally seed an Act.
2. Use **Basic** mode for scene steps and transport; switch to **Advanced** for MIDI/OSC/audio tools.
3. Add scene clips from the scene tray, or use **Add step** at the playhead.
4. Drag clips to set **start time**; resize for duration.
5. Seek with the ruler/playhead.
6. Create gaps: select a clip → **+2s gap**, or drag clips apart; use
   **Extend +5s** if the ruler runs out of room.
7. Optional: **Sync to BPM** for bar-aligned length (uses app BPM).
8. Optional: place **MIDI/OSC timeline events** for scheduled cues during playback.
9. Run the show with **ACT triggers** (MIDI/OSC) — play / pause / stop / next.

Transport vs tempo: ACT triggers **start** acts; Ableton Link (Settings +
Pi bridge) shares **BPM** only. Live transport is not mirrored unless you
add OSC/MIDI timeline events or external mappings. See DOCS/ACT_TIMELINE.md.

## Clip launcher workflow

1. Open the Clip Launcher panel (Scenes and Acts page).
2. Click an empty cell to assign a scene.
3. Click a populated cell to launch it; double-click to edit properties.
4. Toggle Loop on cells that should repeat.
5. Stop everything at once with Stop All.

## Backup and reset workflow

Configuration export / import is available through Settings and the API.

Reset sequence:

1. Export backups (`GET /api/config`, `GET /api/scenes`).
2. `DELETE /api/state`
3. `DELETE /api/config`
4. `DELETE /api/scenes`
5. Confirm `GET /api/factory-reset-check` returns true.
6. Restore backups via the corresponding POST endpoints.

Or simply launch with `--reset` / `-Reset`:

```
./start.sh --reset       # Linux / macOS
.\start.ps1 -Reset       # Windows
```

## Keyboard shortcuts

See DOCS/SHORTCUTS.md for the full master table. Highlights:

- `Ctrl + H` - toggle Help overlay
- `Space`    - emergency blackout (or play / pause inside the timeline)
- `?`        - keyboard shortcut modal
- `1`-`9`    - trigger scenes 1-9
- `Ctrl + S` - quick save scene
- `B`        - toggle blackout
- `M`        - toggle Master Fader

## Troubleshooting

DMX

- No output: check the interface, the start address, and the universe.
- Flicker: missing 120 ohm terminator or loose XLR.
- Wrong colour: profile mismatch; verify channel mode.

MIDI

- Device missing: re-grant Web MIDI permission, or restart the browser
  with the device already plugged in.
- Mappings lost: re-apply the controller template, or restore your
  configuration backup.

OSC

- Not receiving: verify the listening port, check the firewall, watch
  the OSC Monitor for incoming traffic.

TouchOSC

- Upload fails: confirm tablet IP is reachable; fall back to the runtime
  download endpoint.

Build / start

- Run `./start.sh --reset` or `.\start.ps1 -Reset` for a clean rebuild.
- If `dist/server.js` is missing, run `npm run build` first.
- Demo screenshots require Chrome or Edge; videos also require ffmpeg.
  Use `CAPTURE_CHROME` / `CAPTURE_FFMPEG` when the tools are outside PATH.

## Producing demo artefacts

```
npm run demo:capture-screenshots   # 6 PNGs of every current primary route
npm run demo:capture-videos        # 6 WebM clips + JPG posters
npm run demo:evidence              # smoke tests + screenshots
npm run demo:evidence-full         # smoke tests + screenshots + videos
```

Output:
- Screenshots: `/tmp/artbastard-demo-screenshots-YYYYMMDD-HHMMSS/`.
- Videos: `website/videos/<name>.{webm,jpg}` (consumed by the showcase).
