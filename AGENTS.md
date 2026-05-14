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
- Frontend unit tests: `cd react-app && npx vitest run`

Note: The smoke test scripts (`scripts/api-contract-smoke.js`, `scripts/touchosc-workflow-smoke.js`) spawn their own backend instance, so kill any existing server on port 3030 before running them.

### Gotchas

- The `start.sh` script is interactive (MIDI device selector prompt). For non-interactive startup, build and run the server directly: `npm run build-backend-fast && node dist/server.js`.
- Art-Net hardware is not available in cloud environments; the server logs "artnetStatus: unreachable" which is expected and non-blocking.
- MIDI devices are not available in cloud environments; `midiDevicesConnected: 0` is expected.
- The `react-app` postinstall copies FontAwesome assets and runs `setup-build.js` to install the platform-specific rollup binary. This runs automatically during `npm ci`.
- The vitest suite has a few pre-existing test failures in `inputValidation.test.ts` related to type coercion (strings being accepted as valid DMX values). These are not regressions from setup.
- Port 3030 is the default. Set `PORT=<n>` env var before `node dist/server.js` to override.
