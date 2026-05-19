# ArtBastard LAN Bridge

Outbound agent for Raspberry Pi (or any LAN host) on 192.168.1.*. Connects to the cloud app over WSS and sends Art-Net locally. Optional Ableton Link sync for Live tempo.

## Requirements

- Node.js 20+
- Pi on same LAN as Art-Net node and (for Link) Ableton Live
- Outbound HTTPS to artbastard.aday.net.au (port 443)
- No inbound firewall rules on the Pi

## Quick start

1. In ArtBastard UI: Settings -> Network -> LAN Bridge -> Generate bridge token.
2. On the Pi:

```
mkdir -p ~/.artbastard
```

Example ~/.artbastard/bridge.json:

```
{
  "cloudUrl": "https://dev.artbastard.aday.net.au",
  "token": "PASTE_TOKEN_HERE",
  "bridgeId": "raspberry-pi-bridge",
  "artnet": {
    "ip": "192.168.1.199",
    "port": 6454,
    "net": 0,
    "subnet": 0,
    "universe": 0,
    "base_refresh_interval": 1000
  },
  "linkEnabled": true,
  "safetyMode": "hold",
  "dmxFlushHz": 40
}
```

3. Build and run from repo:

```
cd bridge-agent
npm ci
npm run build
node dist/index.js --artnet-ip 192.168.1.199
```

Or with env only:

```
export BRIDGE_TOKEN=...
export CLOUD_URL=https://artbastard.aday.net.au
export ARTNET_IP=192.168.1.199
node bridge-agent/dist/index.js
```

## systemd (Pi)

/etc/systemd/system/artbastard-bridge.service:

```
[Unit]
Description=ArtBastard LAN Bridge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/artbastard.aday.net.au/bridge-agent
ExecStart=/usr/bin/node /home/pi/artbastard.aday.net.au/bridge-agent/dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```
sudo systemctl daemon-reload
sudo systemctl enable --now artbastard-bridge
journalctl -u artbastard-bridge -f
```

## Ableton Link (Phase 2)

- Install build tools on Pi: build-essential, python3
- In bridge-agent: npm rebuild abletonlink
- Enable Link in Ableton Live on a machine on the same subnet
- In ArtBastard UI choose tempo source: Ableton Link

Link runs on the Pi; cloud delegates clock when a bridge is connected.

## Show sessions (multi-tenant DMX)

Each session has its own DMX universe and optional Pi bridge. Browsers join via
Settings > Network (session ID in localStorage `artbastard-session-id`, sent as
Socket.IO `auth.sessionId`). The Pi uses a bridge token that embeds `sessionId`
(mint with `{ "bridgeId": "...", "sessionId": "my-gig" }`).

- Join the same session ID on every browser and mint the bridge token for that ID.
- `session:join` / `session:create` on the socket, or `GET/POST /api/sessions`.
- DMX API: pass `sessionId` in query or JSON body.
- One bridge per session; many browsers per session.
- Scenes, fixtures, and acts remain global (shared across sessions).

Default session id is `default`.

## Multiple operators (concurrent browsers)

Within one session, many browser clients can connect at once. Fader changes go to
that session's room (`dmxUpdate`) and to that session's bridge when connected.
Settings > Network shows session id, client count, and bridge status.

## Security

- Set BRIDGE_TOKEN_SECRET on the server in production (same value used to sign tokens).
- Revoke tokens via POST /api/bridge/token/revoke with body { "token": "..." }.
- Tokens expire (default 30 days); mint new ones from Settings.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Bridge will not connect | Token valid, cloud URL correct, wss reachable |
| No DMX on node | artnet.ip, universe, Pi on 192.168.1.* |
| Link peers 0 | Live Link on, same VLAN, no AP isolation |
| Cloud silent blackout | safetyMode in bridge.json; cloud ping timeout 3s |

## Smoke test (dev)

From repo root after backend build:

```
npm run test:bridge-smoke
```
