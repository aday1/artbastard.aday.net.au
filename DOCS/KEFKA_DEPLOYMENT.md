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
| Dedicated local console | `http://127.0.0.1:3030/kefka-console?sessionId=default#/fixture` |
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
# Apply updated code/environment when upgrading an already-running service:
systemctl --user restart artbastard.service
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
~/.local/bin/artbastard-console-open
systemctl --user stop artbastard-deck.service artbastard-input.service
systemctl --user stop artbastard-console.service
```

`artbastard.service` is enabled for user login. **ArtBastard Deck** and
**ArtBastard Console** are separate, on-demand launcher entries and user units;
neither browser unit is enabled at boot. Their launchers reuse/focus an existing
window. Profiles live at `~/.local/share/artbastard-browser` and
`~/.local/share/artbastard-console-browser` inside the persistent Flatpak home
(host backing directory: `~/.var/app/com.google.Chrome/.local/share/`).
Each unit tracks and stops its exact Flatpak instance, since Flatpak moves the
browser into a separate scope. Launcher calls focus an existing window before
starting one.

The local **Full console** / **Deck Controls** links switch between these
windows without unloading the console's APC40 workflow state. The console's
different app URL gives it a different window class, so it keeps ordinary
`deckhypr` desktop buttons. Of the two ArtBastard windows, only the exact Deck
control app class enters GAME mode. The read-only, loopback input helper starts
with the Deck window and permits native controls only while the live mapper is
in GAME mode and that exact window is focused. An ownership change disarms
controls and requires neutral input again. See [Deck controls](KEFKA_CONTROLS.md).

The backend's `ARTBASTARD_KEFKA=1` environment setting opts into
`/api/kefka/surfaces`. Its POST launch routes require a loopback request and
matching exact local `Host`/`Origin` (`127.0.0.1:3030` or `localhost:3030`,
adjusted by `PORT`). They invoke fixed Deck/Console launchers only. LAN clients
receive ordinary separate-window navigation, not local desktop launch access.
The existing NYX desk and Yggdrasil kiosk are independent.

## Checks

```sh
curl -fsS http://127.0.0.1:3030/api/health
curl -fsS http://127.0.0.1:3030/api/state
curl -fsS http://127.0.0.1:3030/api/midi/active
curl -fsS http://127.0.0.1:3030/api/kefka/surfaces
curl -fsS -H 'Origin: http://127.0.0.1:3030' http://127.0.0.1:18782/health
node scripts/dmx-osc-integration-smoke.js
node scripts/kefka/test-controller.mjs
python3 scripts/kefka/test-input.py
node scripts/kefka/test-surface.mjs
node scripts/kefka/test-launcher.js
```

The integration smoke creates temporary data and private loopback UDP receivers;
it does not send output to the fixtures. Do not run the older fixed-port API
smoke against the live show server.
The native reader's `connected` field is separate from `nativeAllowed`:
connected proves device access, while allowed additionally requires live mapper
ownership and the exact focused Deck window. A running input service alone is
not proof that lighting controls are permitted. The automated checks do not
prove physical button presses, APC40 operation or fixture response.

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
selection and SuperControl logic. Use **ArtBastard Console** or
`~/.local/bin/artbastard-console-open` to open
`http://127.0.0.1:3030/kefka-console?sessionId=default#/fixture`, patch the real
fixtures, then select the fixtures to control. Navigating to the separate Deck
window preserves the running console's in-memory selection and APC40 state.
The standalone Deck surface itself does not run the APC40 workflow.

Keep one full console processing the APC40: the existing app broadcasts its
MIDI events to every full-console client and has no operator-owner election.
Additional clients can use the standalone Deck surface, which does not process
APC40 MIDI. Separate window launchers preserve a running console; they do not
add operator-owner election. Fixture selection is not automatically restored
after closing or relaunching the console. A hidden console can also activate the
existing APC40 screensaver, so this setup is not an unattended headless APC40
driver. Physical controller operation and light response have not yet been
verified.

The user subsequently identified the connected fixture as the MiniBeam at
DMX address 1. Its existing documented 18-channel profile was patched as
`fixture-kefka-minibeam-1` / `MINIBEAM 1` on channels 1–18. Readback confirmed
the fixture metadata and unchanged all-zero output. The 18-channel mode is
inferred from the project's user-supplied manual and remains to be checked
against the fixture display. Physical button and light response are pending.

The local surface-launch routes were exercised on Kefka: the dedicated console
class is `chrome-127.0.0.1__kefka-console-Default`. Native input health changed
from allowed in the focused Deck window to denied in the console and back.
After installing persistent Flatpak profiles and instance tracking, a real
Deck-service restart removed the previous instance and left exactly one Deck
window, one full console, and the existing Yggdrasil Deck window. Repeated
launcher calls also retained one window per surface.

During webcam attachment the external USB hub disconnected, removing the
APC40 and both Ethernet adapters together. The kernel briefly identified a
Microsoft LifeCam Studio (`045e:0811`) before disconnecting it. This is a live
cabling state, not a change to the saved DMX network profile; recheck USB
enumeration and the dedicated route before resuming physical tests.

## Rollback of the control windows

Stop `artbastard-deck.service`, `artbastard-input.service` and
`artbastard-console.service`. Restore the timestamped pre-install unit/launcher
backups, or remove only newly installed units, launchers and desktop entries.
Remove only the dedicated Deck game-class rule from
`~/.config/kefka/game-classes`, preserving all other entries. Reload the user
manager and restart `deckhypr` after changing its class file.

Set `ARTBASTARD_KEFKA=0` in the backend service environment and restart
`artbastard.service` to disable window launching. Preserve the backend's
`data/` directory and both browser profiles. Network rollback is separate and
is described above.
