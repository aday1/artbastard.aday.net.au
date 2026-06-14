# ArtBastard Quick Start

Get running in minutes—locally, in Docker, or with hot-reload development.

## 1️⃣ Local Development (5 minutes)

**Requirements:** Node.js 20+, npm 10+

```bash
git clone https://github.com/aday1/artbastard.aday.net.au.git
cd artbastard.aday.net.au
npm ci
npm --prefix react-app ci
./start.sh          # Linux/macOS
# or
.\start.ps1         # Windows
```

**Open:** http://localhost:3030

That's it. The launcher handles backend + frontend startup, MIDI picker, and factory defaults.

---

## 2️⃣ Docker (Offline Server / Production)

**Requirements:** Docker + Docker Compose

```bash
git clone https://github.com/aday1/artbastard.aday.net.au.git
cd artbastard.aday.net.au
docker compose pull
docker compose up -d
```

**Open:** http://your-server:3030

**Persist data** (scenes, config, state):
- Volume `artbastard-data:/app/data` is mounted automatically
- Restart container anytime—your setup survives

**Configure via `.env`** (optional):
- See `.env.example` for DMX interfaces, Art-Net nodes, ports, etc.

---

## 3️⃣ Fast Dev with Hot Reload

**For rapid iteration—UI changes reload instantly**

```bash
npm run local
```

**Open:** http://localhost:3001

Vite dev server proxies `/api` and Socket.IO to the backend on port 3030, so you get:
- Live React component updates
- Full API + WebSocket connectivity
- Same production-like backend

**Separate terminals (if you prefer):**
```bash
# Terminal 1: Backend (port 3030)
npm run local:backend

# Terminal 2: Frontend (port 3001)
npm run local:frontend
```

---

## 4️⃣ Production-Like Local Build

Test the exact build that ships to Linode:

```bash
npm run local:prod
```

**Open:** http://localhost:3030

- React bundled + minified (no dev server)
- Same compressed size as production
- Backend serves pre-built assets

---

## 🔧 Reset to Factory Defaults

Wipe scenes, config, and state—start fresh:

```bash
./start.sh --reset       # Linux/macOS
.\start.ps1 -Reset       # Windows
```

Or via API:
```bash
curl -X DELETE http://localhost:3030/api/state
curl -X DELETE http://localhost:3030/api/config
curl -X DELETE http://localhost:3030/api/scenes
```

Export your show before resetting:
- Settings > Export (saves JSON)
- Restore: Settings > Import

---

## ✅ Verify Before Deploying to Production

Run these checks before pushing to main (which triggers Linode CI/CD):

```bash
# TypeScript type check
cd react-app && npx tsc --noEmit && cd ..

# Bundler test
npx vite build

# API contract tests
npm run test:api-contract

# Bridge smoke test
npm run test:bridge-smoke
```

All pass? Push to main:
```bash
git push origin main
# → GitHub Actions builds GHCR image (:live)
# → Deploy workflow pulls and restarts on Linode
# → Live at https://artbastard.aday.net.au in ~2 minutes
```

---

## 📖 Full Documentation

| File | Purpose |
|------|---------|
| [LOCAL_DEV.txt](LOCAL_DEV.txt) | Multi-terminal dev workflows + Linode deployment |
| [DOCS/INSTALL.md](DOCS/INSTALL.md) | Detailed installation, requirements, reset API |
| [DOCS/USAGE.md](DOCS/USAGE.md) | Operator workflows—DMX, MIDI, OSC, scenes, timeline |
| [DOCS/FEATURES.md](DOCS/FEATURES.md) | Feature inventory—what each page does |
| [DOCS/HELP.md](DOCS/HELP.md) | Offline mirror of in-app help (Ctrl+H) |
| [DOCS/SHORTCUTS.md](DOCS/SHORTCUTS.md) | Master keyboard shortcut reference |
| [DOCS/MIDI_TEMPLATES.md](DOCS/MIDI_TEMPLATES.md) | X-Touch, APC40, other controller mappings |
| [DOCS/FIXTURES.md](DOCS/FIXTURES.md) | Fixture profiles, library, address planning |
| [DOCS/BRIDGE.md](DOCS/BRIDGE.md) | Raspberry Pi LAN bridge for cloud + local Art-Net |

---

## 🚀 First Time? Start Here

1. Clone the repo
2. Run `./start.sh` (or `.\start.ps1`)
3. Open http://localhost:3030
4. Press **Ctrl+H** for in-app help (covers DMX, MIDI, OSC, scenes, timeline, everything)
5. Check [DOCS/USAGE.md](DOCS/USAGE.md) for operator workflows

---

## 🐳 Docker Environment Variables

`.env` file (optional—defaults work for most cases):

```bash
# Server
PORT=3030
NODE_ENV=production

# DMX output (optional)
# Uncomment if you have local hardware:
# DMX_INTERFACE=/dev/ttyUSB0      # Linux/macOS USB device path
# ARTNET_HOST=192.168.1.100       # Art-Net receiver IP
# ARTNET_PORT=6454                # Art-Net port (default 6454)

# For hosted cloud deployment with local LAN fixtures:
# Requires Raspberry Pi bridge agent (see DOCS/BRIDGE.md)
# BRIDGE_URL=http://192.168.1.50:9000
```

See `.env.example` for full list.

---

## 🎭 Live Deployments

- **Production:** https://artbastard.aday.net.au (`:live` image from main branch)
- **Pre-prod:** https://artbastard-dev.aday.net.au (`:dev` image from dev branch)
- **Showcase:** https://aday1.github.io/artbastard.aday.net.au/ (GitHub Pages + demo reel)

---

## ❓ Troubleshooting

**Port 3030 already in use?**
```bash
npm run local -- --port 3031
```

**Node modules broken?**
```bash
rm -rf node_modules react-app/node_modules && npm ci && npm --prefix react-app ci
```

**MIDI permissions on Linux?**
```bash
sudo usermod -a -G audio $USER
```

**Docker container won't start?**
```bash
docker compose logs artbastard
```

---

## 🔗 Repository

- **Code:** https://github.com/aday1/artbastard.aday.net.au
- **Issues:** https://github.com/aday1/artbastard.aday.net.au/issues
- **Releases:** https://github.com/aday1/artbastard.aday.net.au/releases
