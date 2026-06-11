# Act timeline, transport, and tempo

How Acts differ from scene timelines, and how MIDI, OSC, BPM, and Ableton
Link fit together. Last updated: 2026-05-17.

## Two timelines

| Editor | Where | Purpose |
| ------ | ----- | ------- |
| **Scene timeline** | Scene editor on Scenes | DMX keyframe animation for one scene (channels, easing, mute/solo tracks). |
| **Act timeline** | `#/acts` | Sequence **scene steps** (clips), optional **gaps**, and **MIDI/OSC events** on lanes at absolute times (ms). |

Scene timelines play when you launch that scene. Act timelines play when you
**play the act** (UI, or an ACT trigger bound to that act).

## Transport vs clock (important)

These are separate systems. Do not expect Ableton Live **transport** (play/stop
from Live) to start an act unless you wire it yourself.

### Act transport (start / stop / next)

**ACT triggers** per act: `play`, `pause`, `stop`, `next`, `prev`, `toggle`.

- Bound via MIDI Learn, controller templates (X-Touch transport), or OSC:
  `/act/play`, `/act/pause`, `/act/stop`, `/act/next`, `/act/prev`, `/act/toggle`
  (with act id in the mapping where your setup requires it).
- **Play** loads the current step's scene and runs the act timeline.
- **Pause** holds offset; **play** again resumes.
- **Stop** resets act playback.
- **Next** / **prev** jump steps manually.

This is how you **launch** acts from a desk, QLab, or Live **via MIDI/OSC
mapping** — not automatic mirror of Live's arrangement transport.

### Tempo / bar length (clock)

| Control | What it does |
| ------- | ------------- |
| **App BPM** | Global tempo in the header / BPM panel. |
| **Sync to BPM** (act checkbox) | Stretches the act's effective length to a multiple of bars at **app BPM** (`bpmMultiplier` bars). Does not start Live. |
| **Ableton Link** | Settings → BPM / Auto Scene → tempo source **Ableton Link**. With the Pi bridge, Link peers (including Live) share **BPM** with ArtBastard. Still not act transport. |

Link keeps everyone on the same **tempo**. It does not schedule scene changes
on Live's timeline for you.

### Timeline MIDI / OSC lanes (scheduled events)

Inside the act editor, **MIDI** and **OSC** lanes hold events at absolute
times (milliseconds from act start):

- Fire during act playback (load scene, set DMX, send OSC, etc.).
- Record or place manually; mute/solo per lane.
- Use these when you need "at 1:30 fire OSC to Live" — not the same as ACT
  triggers, which are **immediate** transport commands.

## Editing the act timeline

### Clips (scene steps)

- Each clip is one **scene** for a **duration** (ms).
- **Drag horizontally** moves **start time** (does not reorder the list).
- **Resize** the right edge changes duration.
- **Add step** inserts at the **playhead** position.
- **Scene tray** adds saved scenes directly to the end of the act.

### Basic vs Advanced

- **Basic** keeps the act transport, scene tray, scene steps, spacing, and timeline visible.
- **Advanced** reveals MIDI/OSC lanes, recording, markers, audio/FFT tools, and import/export.

### Gaps and empty space

- **+2s gap** (with a clip selected): shifts that clip and everything after
  it later by 2 seconds.
- **Extend +5s**: grows `totalDuration` so the ruler has room past the last clip.
- Drag clips apart to set explicit `startTime` gaps; playback **waits** in
  gaps before loading the next scene step.

### Playhead

- Click the **ruler** or track background to seek.
- Drag the red **playhead** to scrub.
- Ruler width matches clip layout (no scrub "jump" from mismatched scales).

### Snap

- Toggle grid snap from the toolbar when you want quantized moves.

## Recommended workflows

1. **Build scenes first** — scene timelines for looks; acts only sequence scenes.
2. **One act per song or movement** — keeps triggers and OSC paths obvious.
3. **Triggers on hardware** — map APC/X-Touch transport or spare pads to ACT
   triggers for the current show act; avoid relying on mouse during performance.
4. **BPM** — if using Link, enable bridge Link + Live Link, set tempo source to
   Link, then enable **Sync to BPM** on acts that should land on bar boundaries.
5. **Live-specific actions** — add an **OSC timeline event** at the right ms
   (e.g. `/live/play`) rather than expecting act play to start Live.
6. **Gaps for fades** — leave 1–3 s between scene clips so blackout or
   autopilot fades can finish before the next scene loads.
7. **Rehearse gaps** — play the act once through; timeline events in gaps still
   run while the current scene holds.
8. **Extend before drag** — if clips won't move far enough right, use
   **Extend +5s** first.

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------- | --- |
| Clip jumps when dragging | Old build reordered steps | Update; drag sets `startTime`. |
| Playhead scrub feels wrong | Zoom / duration mismatch | Zoom to fit; extend total duration. |
| No gap on play | Step advanced immediately | Update; playback waits for next `startTime`. |
| Live doesn't start with act | Transport not wired | OSC/MIDI timeline event or external map. |
| Tempo wrong | Link off or wrong source | Bridge Link + Settings tempo source. |

## See also

- DOCS/HELP.md — in-app help mirror (Act timeline + ACT triggers sections)
- DOCS/USAGE.md — operator workflows
- DOCS/BRIDGE.md — Pi bridge and Ableton Link
- DOCS/OSC_REFERENCE.md — OSC addresses
- DOCS/MIDI_TEMPLATES.md — X-Touch / APC40 transport mappings
