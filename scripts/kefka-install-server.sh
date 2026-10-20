#!/usr/bin/env bash
# Install the already-built repository as a Kefka user service.
set -euo pipefail
repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
node_bin=${ARTBASTARD_NODE:-"$HOME/.local/opt/node-v22.23.3-linux-x64/bin/node"}
test -x "$node_bin"
test -f "$repo/dist/server.js"
test -f "$repo/react-app/dist/index.html"
mkdir -p "$repo/data" "$HOME/.config/systemd/user"
if [[ ! -f "$repo/data/config.json" ]]; then
  cat > "$repo/data/config.json" <<'JSON'
{
  "artNetConfig": {
    "ip": "192.168.1.199",
    "port": 6454,
    "net": 0,
    "subnet": 0,
    "universe": 0,
    "base_refresh_interval": 1000
  },
  "oscConfig": {
    "host": "0.0.0.0",
    "port": 8000,
    "sendEnabled": false,
    "sendHost": "127.0.0.1",
    "sendPort": 57120
  }
}
JSON
fi
service="$HOME/.config/systemd/user/artbastard.service"
if [[ -f "$service" ]]; then
  cp -a "$service" "$service.bak.$(date +%Y%m%d-%H%M%S)"
fi
cat > "$service" <<UNIT
[Unit]
Description=Artbastard lighting server, web UI and OSC
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$repo
Environment=NODE_ENV=production
Environment=PORT=3030
Environment=PATH=$(dirname "$node_bin"):/usr/local/bin:/usr/bin:/bin
ExecStart=$node_bin $repo/dist/server.js
Restart=on-failure
RestartSec=3
TimeoutStopSec=15
UMask=0077

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now artbastard.service
systemctl --user --no-pager status artbastard.service
