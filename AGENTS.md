## Cursor Cloud specific instructions

### Project overview

ArtBastard DMX512 is a TypeScript DMX lighting controller with a Node.js/Express/Socket.IO backend and a React (Vite) frontend. No external databases or services are needed; all persistence uses local JSON files in a `data/` directory.

### Services

| Service | Port | Start command |
|---------|------|---------------|
| Backend (serves API + built frontend) | 3030 | `node dist/server.js` |
| Frontend Vite dev server (HMR) | 3001 | `cd react-app && npx vite --port 3001` |

Only the backend is required. The Vite dev server is optional (for frontend HMR during UI development).

### Build commands

- Backend: `npm run build-backend-fast` (fast incremental TypeScript compilation)
- Frontend: `cd react-app && npx vite build` (production build served by backend)
- Full build: `npm run build`

### Running tests

- API contract smoke: `npm run test:api-contract` (starts its own server internally)
- TouchOSC workflow smoke: `npm run test:touchosc-workflow` (starts its own server internally)
- LAN bridge smoke: `npm run test:bridge-smoke` (token, bridge socket, DMX fan-out)
- Frontend unit tests: `cd react-app && npx vitest run`

Note: The smoke test scripts (`scripts/api-contract-smoke.js`, `scripts/touchosc-workflow-smoke.js`) spawn their own backend instance, so kill any existing server on port 3030 before running them.

### Demo evidence pipeline

The repo ships an automated screenshot + video pipeline used to populate the public showcase (`website/`):

- `npm run demo:capture-screenshots` - 7 PNGs across the major routes via headless chrome.
- `npm run demo:capture-videos` - 8 short WebM clips + JPG posters via Xvfb + ffmpeg + xdotool + google-chrome. Output goes to `website/videos/`.
- `npm run demo:evidence` - smoke tests + screenshots.
- `npm run demo:evidence-full` - smoke tests + screenshots + videos.

Required tools on PATH for video capture: `Xvfb`, `ffmpeg`, `xdotool`, `google-chrome`, `curl`. Tunable via `CAPTURE_FRAMERATE`, `CAPTURE_VBITRATE`, `CAPTURE_DURATION_SEC`, `CAPTURE_CLIP_LIST`, `CAPTURE_DISPLAY_NUM`, `CAPTURE_KEEP_SERVER` (see `DOCS/SHOWCASE.md`).

### Deployment

Production app (not Fly.io):

- `artbastard-image` on push to `main`/`dev` builds the Docker image to GHCR (`:live` / `:dev`).
- `deploy-linode` runs after a successful image build (or via workflow_dispatch) and refreshes the Linode Macroverse compose stack.

Static showcase only:

- GitHub Pages source is `legacy` (branch=main, path=/). The repo root is served at `https://aday1.github.io/artbastard.aday.net.au/`.
- The full showcase page lives at `/website/index.html`; documentation at `/DOCS/`.
- `.github/workflows/deploy-website.yml` uploads the `website/` directory to a Pages artifact on push to main; the legacy branch build runs in parallel. Switching Pages source to "GitHub Actions" in repo settings would make `website/` the root.

### Documentation entry points

- `DOCS/README.md` - top-level documentation index.
- `DOCS/HELP.md` - offline mirror of the in-app help overlay.
- `DOCS/SHORTCUTS.md`, `DOCS/MIDI_TEMPLATES.md`, `DOCS/OSC_REFERENCE.md`, `DOCS/SHOWCASE.md` - reference material.

### Gotchas

- The `start.sh` script is interactive (MIDI device selector prompt). For non-interactive startup, build and run the server directly: `npm run build-backend-fast && node dist/server.js`.
- Art-Net hardware is not available in cloud environments unless a LAN bridge is connected; without `bridge-agent` on the venue/home LAN the server logs "artnetStatus: unreachable" (expected). See DOCS/BRIDGE.md.
- LAN bridge: `bridge-agent/` connects outbound WSS; multiple browser clients share one DMX state and all changes fan out to the bridge. `npm run test:bridge-smoke`.
- MIDI devices are not available in cloud environments; `midiDevicesConnected: 0` is expected.
- The `react-app` postinstall copies FontAwesome assets and runs `setup-build.js` to install the platform-specific rollup binary. This runs automatically during `npm ci`.
- The vitest suite has a few pre-existing test failures in `inputValidation.test.ts` related to type coercion (strings being accepted as valid DMX values). These are not regressions from setup.
- Port 3030 is the default. Set `PORT=<n>` env var before `node dist/server.js` to override.
