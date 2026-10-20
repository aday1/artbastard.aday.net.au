# ArtBastard OSC Reference

The backend receives OSC over UDP on **port 8000** by default, bound to
`0.0.0.0` (all interfaces). Send to the IP address of the machine running
ArtBastard. The HTTP web interface uses a separate port, normally `3030`.
Change the receive port in Settings > MIDI & OSC. The configured `host` field
does not restrict the receive socket.

OSC feedback is separately configurable with `sendEnabled`, `sendHost`, and
`sendPort`. The source defaults send to `127.0.0.1:57120`; use the receiving
controller's address and port, or disable feedback when it is not needed.

## DMX channels: works without a browser

| Address | Argument | Behavior |
| --- | --- | --- |
| `/channel/1` … `/channel/512` | One numeric value, preferably a float from 0 to 1 | Set the corresponding DMX channel directly |
| `/1/dmx1` … `/1/dmx512` | One numeric value, preferably a float from 0 to 1 | Default per-channel OSC assignments |
| A saved channel assignment, such as `/deck/dimmer` | Same numeric value | Set every channel assigned to that exact address |

OSC channel numbers are **one-based**: `/channel/1` controls DMX address 1.
The HTTP API uses zero-based channel indices.

Assigned addresses are applied by the backend. A connected browser displays
the activity and resulting DMX value; it does not need to send the value back.
Output uses the default session's configured Art-Net destination and universe.
Saved per-channel minimum and maximum limits still apply.

Use normalized floats for predictable control. Existing numeric compatibility
is preserved:

- Values from `0` to `1` are scaled by 255.
- Values greater than `1` through `127` are treated as MIDI-style values and
  divided by 127 before scaling.
- Values greater than `127` through `255` are divided by 255.
- Values outside those bounds are clamped.

For example, `64` means approximately half level, rather than DMX value 64.
Assigned addresses round to the nearest integer (`0.5` becomes `128`);
`/channel/N` retains its existing rounding down (`0.5` becomes `127`).

`/dmx/channel/N` is not a built-in direct route. It works only if that exact
address is saved as a channel assignment.

## Scenes: handled by the backend

| Address | Argument | Behavior |
| --- | --- | --- |
| `/scene/load` | Scene name as an OSC string | Load a saved scene |
| `/scene/save` | Scene name as an OSC string | Save the current default-session DMX values |
| A scene's saved OSC trigger address | Numeric value greater than `0.5` | Load that scene |

Scene trigger addresses are stored with each scene. `/scene/trigger/<name>`
is not an automatically generated backend route.

## Messages forwarded to the web interface

These paths forward events to connected browsers; they are not equivalent to
the headless channel controls above:

| Message | Browser event |
| --- | --- |
| `/supercontrol/*` with a numeric argument | `superControlOsc`, with normalized first argument |
| `/tempo/*` | `tempoOsc`; the mounted tempo controls handle play, stop, toggle, and tap |
| An enabled ACT's configured OSC trigger, with a value greater than `0.5` | `actTrigger` |

SuperControl and ACT behavior depends on the connected interface, its active
controls, and saved mappings. The receiver also forwards every raw message as
`oscMessage` for monitoring.

There are no built-in backend handlers for `/master/brightness`,
`/master/blackout`, or `/fixture/<id>/…`. Do not rely on those names for
headless output. Use explicit channel assignments or the web controls.

## Verification

After building the backend, run:

```sh
node scripts/dmx-osc-integration-smoke.js
```

This test creates a temporary backend and data directory, uses private HTTP
and OSC ports, and collects Art-Net packets on loopback. It checks fresh zero
output, Art-Net configuration changes, `/channel/1`, default `/1/dmx1`,
and a saved custom assignment without a browser. It does not send to fixtures.
Native MIDI and Ableton Link are stubbed during the test so attached controllers
are not opened.
