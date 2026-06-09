# ArtBastard Installation

## Requirements

- Linux / macOS / Windows
- Node.js 20+
- npm 10+
- Modern browser (Chrome, Firefox, Edge, Safari)
- USB DMX interface or Art-Net node
- Optional: MIDI controller, OSC client, TouchOSC tablet
- Cloud + home LAN: Raspberry Pi (or similar) for `bridge-agent` when using
  the hosted app with local Art-Net (see DOCS/BRIDGE.md)

## Install

From repository root:

```
npm ci
npm --prefix react-app ci
```

`--legacy-peer-deps` may be required on some npm versions; the bundled
launchers handle that automatically.

## Run

Linux / macOS:

```
./start.sh
```

Windows:

```
.\start.ps1
```

App URL: http://localhost:3030

## Reset workflow

Force a factory-fresh start with the launcher flag:

```
./start.sh --reset       # Linux / macOS
.\start.ps1 -Reset       # Windows
```

Or by API:

```
DELETE /api/state
DELETE /api/config
DELETE /api/scenes
GET    /api/factory-reset-check     # returns true once reset has occurred
```

Always export `/api/config` and `/api/scenes` first if you want to keep the
current show. Restore via the matching POST endpoints, or paste a
configuration JSON via Settings > Import.

## Verify build and runtime

```
npm run build
npm run test:api-contract
npm run test:touchosc-workflow
npm run test:bridge-smoke
```

## LAN / Pi bridge (cloud deploy only)

If you use the hosted app with fixtures on a private LAN, install the bridge
on a Pi (see DOCS/BRIDGE.md). Not required for local `localhost` runs where
the server can reach Art-Net directly.

## Capture demo evidence (optional)

The demo capture pipeline requires Chrome or Edge. Video capture also
requires `ffmpeg`; set `CAPTURE_CHROME` or `CAPTURE_FFMPEG` if either
binary is installed outside PATH.

```
npm run demo:capture-screenshots
npm run demo:capture-videos
npm run demo:evidence-full
```

Outputs:

- Screenshots: `/tmp/artbastard-demo-screenshots-<timestamp>/`
- Videos: `website/videos/<name>.{webm,jpg}`

The capture pipeline launches the running backend (or starts one if none is
reachable on `BASE_URL`), renders routes in headless Chrome/Edge through
DevTools, and encodes WebM clips with VP9. Adjust framerate, bitrate, clip
list, and tool paths with the environment variables described in
DOCS/SHOWCASE.md.
