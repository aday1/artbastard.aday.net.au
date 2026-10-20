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

Read-only ArtPoll discovery on 2026-10-20 confirmed the actual node's mapping:
DMX output 1 is universe 0; output 2 is universe 1, both on net/subnet 0.
The reply identified `DOREMiDi Art-Net DMX-1024`, MAC `84:c2:e4:xx:xx:xx`,
and reported `Works well`. This confirms the address mapping, not fixture output.
The probe used source and destination UDP 6454 and the lighting subnet's
directed broadcast; an earlier probe from an ephemeral source port was invalid.

The shared Realtek Ethernet device `enp4s0f3u1u4` keeps DHCP on the home LAN
and also carries `192.168.1.20/24`. The alias is saved in NetworkManager's
`Wired connection 1`, UUID `c7daf2f9-8cd1-3281-9b72-febca050784e`.
The DOREMiDi is on this same wired segment. DHCP still provides the ordinary
default gateway and DNS; the lighting subnet needs no separate gateway.

The previously used dedicated ASIX USB Ethernet adapter `enp4s0f3u1u2u3`
(MAC `00:0e:c6:xx:xx:xx`) has `192.168.1.20/24`, saved in NetworkManager's
`Artbastard DMX` profile, UUID `6800f591-57de-3d62-9eee-cf345078039c`.
It has no gateway, `ipv4.never-default=yes`, route metric 50, and IPv6 disabled.
That adapter is currently unplugged, and its profile has autoconnect disabled
to avoid activating the same address on two interfaces.

To remove the shared lighting alias while keeping home-LAN DHCP:

```sh
sudo nmcli connection modify "Wired connection 1" -ipv4.addresses 192.168.1.20/24
sudo nmcli device reapply enp4s0f3u1u4
```

If returning to a direct DOREMiDi-to-ASIX cable, first remove the shared alias,
then re-enable `connection.autoconnect yes` and activate `Artbastard DMX`.

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
Artbastard loads its saved channel state into the API on subsequent restarts.
The physical Art-Net sender starts with zeros; a saved API value by itself is
not proof of emitted output. Explicit control/scene commands update the sender.

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
explicit `artbastard-console` window class keeps ordinary
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
ARTBASTARD_TEST_SOURCE_PORT=0 node scripts/artnet-output.test.js
node scripts/midi-hotplug.test.js
node scripts/midi-hotplug-integration-smoke.js
node --test scripts/midi-alsa-subscriptions.test.js scripts/fixture-shutdown.test.js
npm run test:midi-lifecycle
npm run test:midi-native-lifecycle
node scripts/kefka/test-controller.mjs
python3 scripts/kefka/test-input.py
node scripts/kefka/test-surface.mjs
node scripts/kefka/test-launcher.js
```

The integration smoke creates temporary data and private loopback UDP receivers;
it does not send output to the fixtures. Do not run the older fixed-port API
smoke against the live show server.
The adapter test uses a private source port with the command above so it can
run beside the live server. On an isolated workstation, its default source
port is 6454 and was verified with actual loopback packets.
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

The APC40 was initially detected as `Akai APC40:Akai APC40 MIDI 1 24:0`.
After the hub wiring changes it returned as
`Akai APC40:Akai APC40 MIDI 1 28:0` (USB `09e8:0073`).
Use `/api/midi/active`
to check inputs that are both enumerated and open, rather than retained handles.
The backend checks for hardware changes every two seconds, removes stale input
and output handles, and reconnects saved or previously connected inputs.
Recognized controllers such as the APC40 also connect when attached after startup
if no explicit device list is configured. On Linux, a changed ALSA client/port
suffix is accepted only when the remaining device/port name has one exact match.
Manual disconnect suppresses reconnection for the current process; an explicit
connection opts the device back in. Forget also removes saved aliases with old
ALSA suffixes. Existing startup smart defaults remain in effect after a restart.

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
driver. Real APC40 input and native Deck blackout have been verified; mapped
APC40 fader control and visible MiniBeam output remain unverified.

The user subsequently identified the connected fixture as the MiniBeam at
DMX address 1. Its existing documented 18-channel profile was patched as
`fixture-kefka-minibeam-1` / `MINIBEAM 1` on channels 1–18. Readback confirmed
the fixture metadata and unchanged all-zero output. The 18-channel mode is
inferred from the project's user-supplied manual and remains to be checked
against the fixture display. The user confirmed the DMX cable uses DOREMiDi
OUT 1. Native Deck blackout is confirmed below; visible light remains pending.

The local surface-launch routes were exercised on Kefka: the dedicated console
initially used the Wayland class `chrome-127.0.0.1__kefka-console-Default`.
Native input health changed
from allowed in the focused Deck window to denied in the console and back.
After installing persistent Flatpak profiles and instance tracking, a real
Deck-service restart removed the previous instance and left exactly one Deck
window, one full console, and the existing Yggdrasil Deck window. Repeated
launcher calls also retained one window per surface.

During webcam attachment the external USB hub disconnected. After the user
repaired its power and changed the wiring, the LifeCam Studio (`045e:0811`)
and Realtek Ethernet returned. The user requested sharing the wired link:
ARP confirmed the DOREMiDi's known MAC there, and duplicate-address detection
found `192.168.1.20` unused. The alias was restored to `Wired connection 1`
without cycling the home-LAN connection. A new capture verified three outgoing
512-channel ArtDMX packets from `192.168.1.20` to `192.168.1.199:6454`, universe
0, all zero, on `enp4s0f3u1u4`.

Live snapshots from Kefka's LifeCam and the existing private R1/Reolink
preview were obtained in RAM. The LifeCam shows the projection screen and
stage; its current framing does not resolve the MiniBeam menu text.

A two-second MiniBeam test set shutter channel 2 to 104 and dimmer channel 3
to 16, then restored the previous all-zero values in a `finally` block. Passive
packet capture verified three matching test frames from source UDP 6454 to
`192.168.1.199:6454`, universe 0, with all other channels zero, followed by a
zeroed frame. The measured interval was 2.004 seconds. API readback confirmed
restoration, but the user reported **no light**. This proves transmission to
the gateway, not physical fixture receipt or lamp operation. No pan, tilt,
reset or lamp-control values were sent. The manual's channel 16 lamp-on command
is separate from shutter/dimmer and has not yet been tested.

The MIDI reconnect change was built and tested on Kefka: all 12 unit cases,
the isolated fake-hardware integration and DMX/OSC integration passed. The
fake-hardware test covers unplugged health, throwing stale-handle cleanup,
ALSA rename recovery, incoming MIDI forwarding and persistent Forget.
After restarting the live server, health was `ok`, the absent APC40 correctly
reported zero connected inputs, Art-Net was alive, and all 512 DMX values were
zero. Later physical reconnections and real CC input were observed, as recorded
below; a mapped physical fader test remains unverified.

Live checks subsequently found EasyMIDI retaining native ALSA clients after
enumeration. `closePort()` disconnects the port; `destroy()` releases the
client. Frequent scans had exhausted all available user clients. The tracked
`scripts/patch-easymidi-lifecycle.js` fixes enumeration, failed construction,
close and closed-status handling in the locked dependency. `npm ci`/`npm install`
run it through `postinstall`, and the Kefka server installer also invokes it.
It validates EasyMIDI 3.2.0, native MIDI 3.6.1 and source hashes; dependency
upgrades require reviewing the patch rather than silently applying it.

All 12 lifecycle regressions passed. A real 4,000-enumeration stress on Kefka
retained zero sequencer descriptors without forcing garbage collection.
Following the user's APC40 reconnection, the live backend retained exactly
two descriptors for its input/output pair; global client counts remained
stable. Real CC21 input was recorded. Two rapid USB resets reused ALSA `28:0`
and left open-but-unsubscribed handles; an explicit disconnect/connect restored
`28:0 → 128:0` and `129:0 → 28:0` without changing any DMX values.

The follow-up Linux recovery check tracks the exact backend-owned ALSA ports
and both subscriptions. Ownership is resolved around connection creation using
bounded `aconnect -l` reads; normal monitoring reads `/proc/asound/seq/clients`.
Loss of either subscription triggers the existing reconnect path even if the
hardware name and client number were reused. Unsupported or ambiguous ownership
falls back to the native status check with a warning. Eleven subscription unit
cases and the extended isolated integration passed before deployment.
Live acceptance then removed each exact subscription separately. Input loss
recovered automatically in 819 ms; output loss recovered in 1,948 ms. Each loss
reported zero connected inputs until its single reconnect completed. Six
subsequent healthy seconds showed no extra reconnects and exactly two retained
sequencer descriptors. All 512 DMX values and catalogue hashes stayed unchanged;
final health was OK with one MIDI input, Art-Net alive and OSC bound on 8000.
The probe sent no MIDI messages or DMX writes.

Server shutdown also overwrote the fixture catalogue using an unhydrated legacy
cache. Fixture/group API writes already persist immediately, so shutdown now
leaves that authoritative store intact. Three regression cases cover cold
restarts, edits/deletions and intentional empty catalogues. Deployment backed up
the catalogue before stopping the old process, restored it after that old
shutdown, and verified the new process twice, including a second restart.
Both fixture JSON and metadata hashes remained identical, the MiniBeam remained
patched at 1–18, and all 512 DMX channels remained zero. The migration backup
is `/tmp/artbastard-catalog-upgrade-1792491120378863789` on Kefka.

After HDMI attachment, focusing Chrome's Wayland Deck window caused SIGTRAP
with `Custom primaries aren't supported`. The two Artbastard browser units now
use the same XWayland approach as NYX, with exact classes `artbastard-deck` and
`artbastard-console`. The input gate, launcher lookup and Deck-only game rule
were migrated together; unrelated game classes were preserved. Eight input
checks, four lifecycle checks and service/shell validation passed.
The user then physically pressed X: the native reader observed the press and
release, and the real Deck page displayed
`Blackout sent — all 512 channels set to zero. Controls disarmed.`
API readback remained zero. This confirms the physical native blackout path;
the confirmation appears below the channel panel at the bottom left.

## Art-Net source port

The original `dmxnet` sender emitted from an ephemeral UDP port despite having
a separate listener on 6454. Its sender lacked the `close()` method called by
the app, so configuration changes could also leave stale sender refresh loops.
The backend now uses one output socket bound to UDP 6454, matching the
[Art-Net specification](https://art-net.org.uk/downloads/art-net.pdf), with
one refresh timer. Configuration changes preserve the staged 512 values and
update that socket's destination, universe and interval. No automatic
controller-discovery advertisement is provided by this output-only adapter.

The six adapter tests cover packet encoding/source port, complete staged
frames, sequence wrap, repeated reconfiguration and cleanup, and bind/send
errors. The extended DMX/OSC integration also checks that old destinations
stop receiving frames and a complete 512-channel update reaches the new one.
Backend compilation and the MIDI regressions passed before deployment.
After deployment, passive Ethernet capture verified three complete zeroed
frames from `192.168.1.20:6454` to `192.168.1.199:6454`, universe 0. The server
remained healthy, OSC listened on 8000, and its API still showed all zeros.
See [discovery and packet evidence](kefka-artpoll-2026-10-20.json).

## Projector and camera mapping

Reseating HDMI made Kefka's `DP-1` identify the Dell S500wi at 1920×1080,
60 Hz. The existing internal display rotation and touchscreen mapping were
preserved. `nyx-desk.service` serves the local operator app on 3910;
`nyx-console.service` provides the projector helper on 3919. Its runtime-only
`zz-projector-only.conf` override adds `--no-operator` to avoid opening another
operator window over the Deck. One fullscreen `nyxproj` window uses `DP-1`.

After the user moved and re-keystoned the projector, a new camera-only NYX
workspace **Garage projector 2026-10-20** was saved as
`venue-ef22649050c8`. Open on Kefka:
`http://127.0.0.1:3910/alignment?workspace=venue-ef22649050c8`.
Its metadata report is
`~/nyx-desk/.runtime/calibration/projection-only-20261020.json` on Kefka.
No camera frames were persisted; inspection frames remained in RAM.

The saved fit uses five markers, 19 of 20 corners and 1.46 px RMS error.
An independent frame passed with four markers, 14 of 16 corners and 1.22 px
RMS. This is partial centre/right support: folds prevent decoding the
remaining edge markers. The two fits differ by up to 4.42 px at observed
centres and 11.52 px across all nine centres, so the outer field is not
verified. The draft contains no laser anchors and is not applied; the prior
default workspace, applied calibration and PANIC state remain unchanged.
Pulling the cloth flat is necessary before trusting a full-screen planar fit.

Retained picture settings are zoom 0.5, x −4, y 10, brightness 20, rotation 0
and no flip. The custom nine-marker sheet uses x positions −0.45/0/0.45,
y positions −0.5/0/0.5 and size 0.1875. The LifeCam uses 1920×1080,
manual exposure 167 (about 16.7 ms), manual focus 12 and autofocus off.
These settings reduce short-exposure projector banding and give readable
markers. They are runtime adjustments; camera auto-exposure can be restored
with `auto_exposure=3`, and autofocus with `focus_automatic_continuous=1`.
The pre-refit wall state is saved on Kefka at
`/tmp/nyx-wall-before-refit-20261020-200229.json`.

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
