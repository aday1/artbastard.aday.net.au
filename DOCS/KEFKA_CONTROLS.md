# Kefka / Steam Deck controls

The full ArtBastard application stays at `http://127.0.0.1:3030/`. Its **Deck
Controls** navigation button opens `/deck-control.html`, a focused channel and
scene surface with the same server state. Use the full console for fixture
patching, scene creation, OSC, MIDI and effects.

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

Changing controller, losing focus, hiding the page, or losing the API connection
disarms the surface. Reconnecting while buttons are held causes no output.
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

Install on the SteamOS host, not inside a container:

```bash
install -Dm755 scripts/kefka/deck-input.py ~/.local/share/artbastard/deck-input.py
install -Dm644 scripts/kefka/artbastard-input.service ~/.config/systemd/user/artbastard-input.service
install -Dm644 scripts/kefka/artbastard-deck.service ~/.config/systemd/user/artbastard-deck.service
systemctl --user daemon-reload
```

The existing `deckhypr` must remain running and the session user must already
have read access to the Deck's input device. Do not grant broad input permissions
or stop `deckhypr`.

Add the exact app class below to `~/.config/kefka/game-classes` after preserving
the existing file. This suppresses desktop mouse/key emulation only while the
ArtBastard window is focused. Chrome on Wayland derives this class from its app
URL, despite `--class`; verify with `hyprctl clients -j` on the installed version.

```text
^chrome-127\.0\.0\.1__deck-control\.html-Default$
```

After adding the rule, restart `deckhypr` once. All its existing classes,
paddle mappings, services and shortcuts must remain intact.

```bash
systemctl --user restart deckhypr
systemctl --user start artbastard-deck
```

The Deck window uses an isolated Chrome profile at
`~/.local/share/artbastard-browser`. The supplied services are on-demand and have
no boot enablement. The backend is a separate service and must already be
listening on port 3030. Closing the window does not stop the backend; explicitly
stop the surface to stop its input helper too:

```bash
systemctl --user stop artbastard-deck artbastard-input
```

## Checks

Offline checks do not open an Art-Net socket or contact real DMX hardware:

```bash
node scripts/kefka/test-controller.mjs
python3 scripts/kefka/test-input.py
node scripts/kefka/test-surface.mjs
```

The surface smoke test uses its own temporary HTTP API and Chromium profile.
It checks initial/held-controller silence, deliberate channel writes, scene
recall, blackout, and focus-loss disarming. Delayed-read regressions verify that
consecutive increments use confirmed values and that a slow state read cannot
hold up a blackout command.

On the Deck, check the real read-only input path:

```bash
curl -fsS -H 'Origin: http://127.0.0.1:3030' http://127.0.0.1:18782/health
systemctl --user status artbastard-input artbastard-deck
```

`{"connected":true}` proves the reader opened the built-in controller; it does
not prove a physical button was pressed. For hardware acceptance, press Y to
arm, select the fixture's documented dimmer channel, and use LT + up once while
watching the channel and fixture. Confirm B stops adjustments and X zeros
output. Do not test arbitrary fixture channels at full scale.

To roll back, stop the two services, remove their user unit files and the
dedicated game-class line, then daemon-reload and restart `deckhypr`. Leave the
backend data and other controller apps unchanged.
