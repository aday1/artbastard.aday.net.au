# Kefka deployment

Artbastard runs directly on the Steam Deck with its production web server.
GitHub source: `aday1/artbastard.aday.net.au`, base commit
`af2ce5469a135d6c5fc197d13ad1de27877b2def` (5.2.15.0).
The Kefka changes are in the local `~/Work/artbastard-kefka` worktree on Holybell,
and the installed checkout is `~/Work/artbastard` on Kefka.

## Addresses

| Use | Address |
| --- | --- |
| Full web console, home LAN | `http://kefka.lan:3030/` |
| Deck controls | `http://kefka.lan:3030/deck-control.html` |
| Tailnet web console | Kefka's Tailscale address, port 3030 |
| Lighting LAN web console | `http://192.168.1.20:3030/` |
| OSC input | Kefka's address, UDP 8000 |
| DOREMiDi ATD-1024 | `192.168.1.199:6454`, Art-Net net/subnet/universe 0/0/0 |

The normal Ethernet device `enp4s0f3u1u4` keeps DHCP on the home LAN.
The dedicated ASIX USB Ethernet adapter `enp4s0f3u1u2u3`
(MAC `00:0e:c6:xx:xx:xx`) has `192.168.1.20/24`, saved in NetworkManager's
`Artbastard DMX` profile, UUID `6800f591-57de-3d62-9eee-cf345078039c`.
It has no gateway, `ipv4.never-default=yes`, route metric 50, and IPv6 disabled.
The DOREMiDi connects directly to this adapter. The original lighting alias
was removed from `Wired connection 1`.

To return this USB adapter to ordinary DHCP:

```sh
sudo nmcli connection modify "Artbastard DMX" ipv4.method auto ipv4.addresses "" \
  ipv4.never-default no ipv4.route-metric -1 ipv6.method auto
sudo nmcli connection up "Artbastard DMX"
```

## Runtime and services

Node 22.23.3 is installed in `~/.local/opt/node-v22.23.3-linux-x64`.
The official archive was verified against SHA-256
`df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de`.
No SteamOS packages were changed.

```sh
export PATH="$HOME/.local/opt/node-v22.23.3-linux-x64/bin:$PATH"
cd ~/Work/artbastard
npm ci
npm --prefix react-app ci
npm run build-backend-fast
npm run build-frontend
bash scripts/kefka-install-server.sh
bash scripts/kefka/install-controls.sh
```

The server installer preserves existing `data/config.json`. It initially seeds
the addresses above only when no config exists. Persistent fixtures, mappings,
scenes and saved output live in `~/Work/artbastard/data/`.
Artbastard restores its saved channel state on subsequent restarts.

```sh
systemctl --user status artbastard.service
journalctl --user -u artbastard.service -f
systemctl --user restart artbastard.service
~/.local/bin/artbastard-deck-open
systemctl --user stop artbastard-deck.service
```

`artbastard.service` is enabled for user login. The browser opens on demand via
the **ArtBastard Deck** launcher entry. The input helper is loopback-only,
read-only, and starts with the browser. See [Deck controls](KEFKA_CONTROLS.md).
The existing NYX desk and Yggdrasil kiosk are independent.

## Checks

```sh
curl -fsS http://127.0.0.1:3030/api/health
curl -fsS http://127.0.0.1:3030/api/state
node scripts/dmx-osc-integration-smoke.js
node scripts/kefka/test-controller.mjs
python3 scripts/kefka/test-input.py
```

The integration smoke creates temporary data and private loopback UDP receivers;
it does not send output to the fixtures. Do not run the older fixed-port API
smoke against the live show server.

Initial verification on 2026-10-20, before moving to the dedicated USB adapter:
DOREMiDi answered ping and ARP; packet capture
on Kefka Ethernet showed 512-channel ArtDMX packets from `192.168.1.20` to
`192.168.1.199`, universe 0, with every value zero. The native input reader opened
the real Steam Deck device. Fixture response and physical controller operation
require separate verification; network reachability alone does not prove them.
After the adapter change and reseating the Ethernet cable, the dedicated USB
link came up. DOREMiDi replied to all three pings (about 0.17 ms), and a new
packet capture confirmed the same zeroed 512-channel ArtDMX on
`enp4s0f3u1u2u3`. The home LAN remained on `enp4s0f3u1u4`.

## APC40

The attached APC40 is detected as `Akai APC40:Akai APC40 MIDI 1 24:0`.
Use `/api/midi/active` to check the backend's open input list.
Its existing Artbastard integration uses the full React console's fixture
selection and SuperControl logic. Open one full console on the Deck at
`http://127.0.0.1:3030/?sessionId=default#/fixture`, patch the real fixtures,
then select the fixtures to control.

Keep one full console processing the APC40: the existing app broadcasts its
MIDI events to every full-console client and has no operator-owner election.
Additional clients can use the standalone Deck surface, which does not process
APC40 MIDI. Fixture selection is not automatically restored after a relaunch.
No fixture patch or light response has yet been verified.
