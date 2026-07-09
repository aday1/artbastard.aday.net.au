# ArtBastard v6 — clean operator console

A ground-up rewrite of the ArtBastard DMX512 controller focused on a fast,
predictable, out-of-the-box operator experience. One folder, one install, one
command, **zero native dependencies** (no node-gyp, no sass, no midi bindings —
nothing that can fail to compile).

## Quick start

```bash
cd app
npm install
npm start          # builds server + UI, serves everything on http://localhost:3030
```

For development with hot reload:

```bash
npm run dev        # server on :3030 (tsx watch) + UI on :3031 (vite HMR, proxied)
```

On first boot the server imports your Art-Net settings from the old
`../data/config.json` if it exists (IP, universe, net, subnet). Everything else
starts clean. All state lives in `app/data/state.json` — one human-readable file
you can back up, diff, or version.

## The layout

```
┌──────────────────────────────────────────────────────────────┐
│ ArtBastard   ●srv ●net   Master ▬▬▬▬▬▬▬ 100%   [Flash][BLACKOUT] │
├────────┬─────────────────────────────────────────────────────┤
│Channels│                                                     │
│Fixtures│                 active tab                          │
│ Scenes │                                                     │
│  Acts  │   Channels · Fixtures · Scenes · Acts               │
│  MIDI  │   MIDI · OSC · Setup                                │
│  OSC   │                                                     │
│ Setup  │                                                     │
└────────┴─────────────────────────────────────────────────────┘
```

Master, Flash and Blackout are always one tap away, on every tab. On narrow /
touch screens the nav rail moves to the bottom — same app, no separate mobile page.

- **Channels** — all 512 faders (filter: All / Patched / In use). Click a channel
  number to select, Shift-click for ranges, then set the whole selection at once.
  Click a value to type it. Wheel = ±5, Shift+wheel = ±1.
- **Fixtures** — patch from built-in profiles (dimmer, RGB/RGBW/RGBAW+UV PARs,
  moving heads, strobe, hazer) or edit channel layouts freely. Auto next-free
  address, overlap warnings, quantity patching. Select fixtures to get role-aware
  controls: intensity fader, color swatches + picker, pan/tilt XY pad (Shift = fine),
  faders for everything else. Group fixtures and ride one fader.
- **Scenes** — one tap saves the current look, one tap recalls it with its fade
  time. Update / Snap (no fade) / rename / delete on each card.
- **Acts** — sequences of scenes with per-step fade + hold, loop, transport.
  **Playback runs on the server**, so a chase keeps running if you close the browser.
- **MIDI** — Web MIDI (Chrome/Edge). Learn any CC/note onto channels, master,
  blackout, flash, scenes, acts, groups. One-click APC40 / APC40 mkII template:
  40 pads → scene slots (with LED feedback), track faders → groups or ch 1-8,
  master fader → grand master, scene-launch → acts 1-5. Mappings persist server-side.
- **OSC** — UDP in/out on the server. `/dmx/N`, `/master`, `/blackout`,
  `/scene/N`, `/act/N`, plus TouchOSC-legacy `/1/dmxN`. Live activity log.
- **Setup** — Art-Net node IP / port / net / subnet / universe, shortcut
  reference, factory reset.

### Keyboard

`1-7` tabs · `B` blackout · `F` (hold) flash · `S` save scene · `Esc` deselect ·
arrows/wheel nudge the focused fader.

## Design decisions (why this doesn't hurt anymore)

- **Grand master is role-aware.** It scales intensity and color channels only —
  never pan/tilt/gobo/speed — so dimming the master doesn't send your movers to
  the floor. Blackout likewise kills intensity but holds position.
- **Fades run in the engine, not the browser.** Scene recalls and act playback
  are computed server-side at 40 fps and sent to Art-Net directly. Background-tab
  throttling can no longer wreck timing.
- **Scenes are full looks.** Recalling a scene fades captured channels to their
  values and everything else to zero. Predictable every time.
- **State is restored on restart** — a server reboot doesn't blackout the rig.
- **Art-Net frames** go out at up to 40/s while values change, with a ~1 s
  keep-alive refresh, sequence numbers, and correct 15-bit port addressing.

## HTTP API (for scripts and external tooling)

```
GET  /api/health                    → { ok, version }
GET  /api/state                     → full state snapshot
POST /api/dmx                       { "channel": 0-511, "value": 0-255 }
POST /api/dmx/batch                 { "pairs": [[ch,val],...], "fadeMs": 500 }
GET  /api/scenes                    → scene list
POST /api/scenes/:idOrName/recall   { "fadeMs": 1000 }  (optional)
```

Everything else runs over Socket.IO — see `shared/types.ts`, which is the whole
protocol contract shared by server and UI.

## Tests

```bash
npm test           # engine + OSC codec unit tests
npm run test:e2e   # boots the real server, tests HTTP/socket/scene/act/OSC/Art-Net on the wire
npm run typecheck  # strict TS across server + UI
```

## Relationship to the old app

The v5 code (`../src`, `../react-app`) is untouched and still runs the same way
it did. This folder is self-contained; when you're happy with v6, the old
frontend/backend can be deleted. Data formats are new (simpler), except the
Art-Net config which imports automatically.
