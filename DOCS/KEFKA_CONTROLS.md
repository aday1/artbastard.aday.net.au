# Kefka / Steam Deck controls

The **ArtBastard Deck** launcher opens `/deck-control.html`, a focused channel
and scene surface. **Full console** opens or focuses a separate **ArtBastard
Console** window at
`http://127.0.0.1:3030/kefka-console?sessionId=default#/fixture`.
The console's **Deck Controls** button returns to the existing Deck window.
Switching windows does not unload the console, so its APC40 selection, scene
decks and running workflow remain in memory. Closing or restarting the console
does unload that state; fixture selection is not automatically restored.

Use the full console for fixture patching, scene creation, OSC, MIDI and
effects. Keep only one full React console processing the APC40: the existing
app broadcasts MIDI to every full-console client and has no operator-owner
election. Additional clients can use the standalone Deck surface.

## Using the controls

Controls always start disarmed. Focus the Deck window and release all buttons
before arming. The touch buttons work without a connected pad.

| Control | Action |
| --- | --- |
| Y / Arm button | Arm or disarm |
| B | Disarm |
| D-pad left / right | Select DMX channel 1–512 |
| LT + D-pad up / down, while armed | Adjust selected channel by one |
| LT + RT + D-pad up / down, while armed | Adjust selected channel by ten |
| LB / RB | Select a saved scene |
| LT + A, while armed | Recall the selected scene |
| X / Blackout button | Set all 512 channels to zero and disarm |

Blackout is a one-time all-zero command, not a latched output inhibit. Other
controllers or effects may subsequently change channels; stop those in the full
console when needed. There is no all-full control. Channel values are bounded
0–255 and the server applies any configured per-channel range.

Changing controller, losing focus, hiding the page, losing the API connection,
or losing native-input permission disarms the surface. A new connection or
desktop ownership change requires all buttons and triggers to return to neutral
before the controller can arm again. Reconnecting while buttons are held causes
no output.
Arming is never saved. Stick and gyro motion are deliberately unmapped: Kefka's
right stick has documented unattended drift. Steam and QAM remain desktop-owned.
Back paddle keys are ignored by this surface.

## Native Deck input

Chrome's Gamepad API is used for a standard external controller. Kefka's
`deckhypr` manages its built-in controller, so `scripts/kefka/deck-input.py`
provides a separate read-only stream of the Steam Deck's Linux buttons and
triggers. It opens only the `Steam Deck` evdev device; it never grabs it, creates
virtual input, changes lizard mode, or changes Yggdrasil's reader on port 18781.

The input service binds only `127.0.0.1:18782`; `/events` and `/health` require
one of the exact origins `http://127.0.0.1:3030` or `http://localhost:3030`.
Override `ARTBASTARD_DECK_ORIGINS` with a comma-separated exact origin list if the
ArtBastard HTTP port changes. The browser uses the native bridge only when loaded
from localhost. LAN clients can use touch controls; a standard browser gamepad
needs the browser's secure-context support (localhost or HTTPS).

Opening the device alone does not authorize native controls. The helper also
checks that:

- The current user's `deckhypr` process is live, owns the kernel pad, reports
  `game` mode, and has its launcher closed.
- One live Hyprland session reports the exact Deck app class
  `artbastard-deck` as the focused window.
- The ownership check is current. A missing, stale or ambiguous check closes
  the native-input gate.

The full console uses a different class,
`artbastard-console`. It is deliberately absent from
`game-classes`: the Deck's normal desktop pointer/buttons work there, and
native lighting controls remain unavailable. An ordinary browser tab also
does not qualify as the dedicated Deck window. When the native gate closes,
the page does not fall back to reading the built-in Deck through Gamepad API.
Touch controls and real external gamepads remain available.

Install on the SteamOS host, not inside a container, from the built checkout:

```bash
bash scripts/kefka/install-controls.sh
```

The installer backs up existing unit/launcher files, installs the three user
units and two application entries, and adds the exact Deck-only game-class rule
when missing, replacing the former generated Wayland class. It restarts an
active `deckhypr` only when changing that rule.
The existing `deckhypr` must remain running and the session user must already
have read access to the Deck's input device. Do not grant broad input permissions
or stop `deckhypr`.

The installed rule in `~/.config/kefka/game-classes` suppresses desktop
mouse/key emulation only while the Deck control window is focused. Both
dedicated surfaces use XWayland with distinct explicit classes. Chrome's
Wayland backend crashed on Kefka when focused after HDMI connection, reporting
`Custom primaries aren't supported`; XWayland also serves the existing NYX
projector. Verify the classes with `hyprctl clients -j` on the installed version.

```text
^artbastard-deck$
```

Preserve all existing classes, paddle mappings, services and shortcuts.
The launchers start their unit if needed and focus its existing window:

```bash
~/.local/bin/artbastard-deck-open
~/.local/bin/artbastard-console-open
```

The Deck window uses `~/.local/share/artbastard-browser`; the full console uses
`~/.local/share/artbastard-console-browser`. These are separate Chrome profiles,
persisted inside the Flatpak home under
`~/.var/app/com.google.Chrome/.local/share/` on the host. Each unit records its
own Flatpak instance ID and stops that instance when restarted or closed by
systemd. Repeated launcher clicks focus the existing window. Shared backend
state does not imply shared browser-local settings. Both
window units are on-demand and have no boot enablement. The backend is separate
and must be listening on port 3030. Stopping a window does not stop the backend:

```bash
systemctl --user stop artbastard-deck artbastard-input
systemctl --user stop artbastard-console
```

## Local window-launch API

The Kefka server installer sets `ARTBASTARD_KEFKA=1`. After changing this
environment setting, restart `artbastard.service`. `GET /api/kefka/surfaces`
reports whether local window launching is enabled for that request.

`POST /api/kefka/surfaces/deck` and `/console` run only the corresponding fixed
launcher. They require the opt-in environment setting, a loopback connection,
and matching `Host`/`Origin` headers for exactly `http://127.0.0.1:3030` or
`http://localhost:3030` (or the configured `PORT`). Remote clients cannot launch
desktop windows. With the integration unavailable, navigation uses a separate
browser window/tab instead.

## Checks

Offline checks do not open an Art-Net socket or contact real DMX hardware:

```bash
node scripts/kefka/test-controller.mjs
python3 scripts/kefka/test-input.py
node scripts/kefka/test-surface.mjs
# Requires a built backend:
node scripts/kefka/test-launcher.js
```

The surface smoke test uses its own temporary HTTP API and Chromium profile.
It checks initial/held-controller silence, deliberate channel writes, scene
recall, blackout, and focus-loss disarming. Delayed-read regressions verify that
consecutive increments use confirmed values and that a slow state read cannot
hold up a blackout command.
The input tests exercise live-process identity, mapper mode, focus, stale checks
and ownership changes. Launcher tests use an injected executor; they do not
start the real application windows.

On the Deck, check the real read-only input path:

```bash
curl -fsS -H 'Origin: http://127.0.0.1:3030' http://127.0.0.1:18782/health
curl -fsS http://127.0.0.1:3030/api/kefka/surfaces
systemctl --user status artbastard-input artbastard-deck artbastard-console
```

`connected:true` means the reader opened the built-in controller.
`nativeAllowed:true` separately means the desktop ownership/focus gate permits
it. `connected:true` with `nativeAllowed:false` is expected in the full console
or another window; `nativeReason` explains the gate. Neither field proves a
physical button was pressed.

For hardware acceptance, focus the dedicated Deck window, release all controls,
then press Y to arm, select the fixture's documented dimmer channel, and use
LT + up once while
watching the channel and fixture. Confirm B stops adjustments and X zeros
output. Switch to the full console and confirm normal desktop controls work;
return to Deck Controls and confirm it is disarmed and requires neutral input.
These are acceptance steps, not a claim that physical controls or lights have
passed testing. Do not test arbitrary fixture channels at full scale.

To roll back, stop `artbastard-deck`, `artbastard-input` and
`artbastard-console`. Restore their pre-install unit/launcher backups, or remove
only the newly installed files, application entries and dedicated game-class
line. Run `systemctl --user daemon-reload`, then restart `deckhypr` if its class
file changed. Set `ARTBASTARD_KEFKA=0` in the backend service environment and
restart it to disable local launching. Preserve backend data, browser profiles
and other controller apps.
