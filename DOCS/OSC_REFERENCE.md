# ArtBastard OSC Reference

Reference for every OSC address ArtBastard exposes. Mirror of the in-app
Help > OSC Integration tab. Discoverable at runtime from
Experimental > OSC Placeholder.

Default receive port: `8080`. Default send port: configurable in Settings.

## SuperControl - Basic axes

| Address                       | Range     | Description                |
| ----------------------------- | --------- | -------------------------- |
| `/supercontrol/dimmer`        | 0-255     | Dimmer / intensity         |
| `/supercontrol/pan`           | 0-255     | Pan                        |
| `/supercontrol/tilt`          | 0-255     | Tilt                       |
| `/supercontrol/pantilt/xy`    | x,y 0-1   | Combined pan/tilt XY pad   |

## SuperControl - Colour

| Address                       | Range     | Description                |
| ----------------------------- | --------- | -------------------------- |
| `/supercontrol/red`           | 0-255     | Red                        |
| `/supercontrol/green`         | 0-255     | Green                      |
| `/supercontrol/blue`          | 0-255     | Blue                       |
| `/supercontrol/white`         | 0-255     | White (RGBW only)          |
| `/supercontrol/color/wheel`   | 0.0-1.0   | Colour wheel position      |
| `/supercontrol/color/temp`    | 0-255     | Colour temperature (CTO)   |

## SuperControl - Effects

| Address                       | Range     | Description                |
| ----------------------------- | --------- | -------------------------- |
| `/supercontrol/gobo`          | 0-255     | Gobo                       |
| `/supercontrol/shutter`       | 0-255     | Shutter                    |
| `/supercontrol/strobe`        | 0-255     | Strobe                     |
| `/supercontrol/iris`          | 0-255     | Iris                       |
| `/supercontrol/zoom`          | 0-255     | Zoom                       |
| `/supercontrol/focus`         | 0-255     | Focus                      |
| `/supercontrol/lamp`          | 0-255     | Lamp control               |
| `/supercontrol/reset`         | 0-255     | Reset function             |

## SuperControl - Autopilot

| Address                              | Range     | Description                 |
| ------------------------------------ | --------- | --------------------------- |
| `/supercontrol/autopilot/enable`     | 0/1       | Autopilot enable            |
| `/supercontrol/autopilot/speed`      | 0.0-1.0   | Autopilot speed             |
| `/supercontrol/autopilot/pattern`    | int       | Autopilot pattern index     |

## Scenes

| Address                       | Range          | Description                   |
| ----------------------------- | -------------- | ----------------------------- |
| `/scene/trigger/<name>`       | trigger any    | Trigger scene by name         |
| `/supercontrol/scene/next`    | trigger any    | Next scene                    |
| `/supercontrol/scene/prev`    | trigger any    | Previous scene                |
| `/supercontrol/scene/save`    | trigger any    | Save current state as scene   |

## Master & DMX channels

| Address                       | Range          | Description                   |
| ----------------------------- | -------------- | ----------------------------- |
| `/master/brightness`          | 0.0-1.0        | Master brightness             |
| `/master/blackout`            | 0/1            | Master blackout               |
| `/dmx/channel/[1-512]`        | 0-255          | Direct DMX channel value      |
| `/fixture/<id>/brightness`    | 0-255          | Per-fixture brightness        |
| `/fixture/<id>/color/<r,g,b>` | 0-255 each     | Per-fixture RGB               |

## ACT triggers

| Address                       | Range          | Description                   |
| ----------------------------- | -------------- | ----------------------------- |
| `/act/play`                   | trigger any    | Play timeline / current scene |
| `/act/pause`                  | trigger any    | Pause                         |
| `/act/stop`                   | trigger any    | Stop and rewind               |
| `/act/next`                   | trigger any    | Next ACT step                 |
| `/act/prev`                   | trigger any    | Previous ACT step             |
| `/act/toggle`                 | trigger any    | Toggle play / pause           |

## Notes

- Most controls accept 8-bit DMX values 0-255.
- Normalised controls (XY pad, master brightness, autopilot speed) use
  0.0-1.0 floats.
- Trigger controls fire on any positive value.
- Addresses are customisable in SuperControl OSC input fields. The defaults
  above are what fresh installs ship with.
- Use the in-app OSC Monitor to debug incoming traffic; every message it
  sees is logged with timestamp, address, type tag, and arguments.
