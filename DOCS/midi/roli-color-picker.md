---
spec: roli-color-picker
version: 1
grid:
  cols: 15
  rows: 15
defaultMode: wheel
modes:
  wheel:
    type: hsv-radial
    centerCellsAreWhite: true
    pressureControlsValue: true
    minValue: 0.15
  palette:
    type: hsv-grid
    rows: 15
    cols: 15
    hueAxis: x
    valueAxis: y
    minValue: 0.05
    maxValue: 1.0
    saturation: 1.0
roleTargets:
  red:
    aliases: ['red', 'r']
  green:
    aliases: ['green', 'g']
  blue:
    aliases: ['blue', 'b']
---

# Roli Color Picker Spec

Drives the 2nd Roli Lightpad Block when a second device is detected. Two
modes are renderable on the 15×15 LED grid; the user toggles in-app via
`RoliColorPickerPanel`. Edits regenerate
`react-app/src/midi/generated/roliColorPickerSpec.ts`.

## Modes

The `palette` mode here uses `hsv-grid` rather than a hand-curated swatch
list: each cell is an HSV color derived from its position (`hue` along
`hueAxis`, `value` along `valueAxis`, fixed saturation). This makes the
palette deterministic, regenerates cleanly when the spec changes, and lets
the operator find any color in two intuitive axes. To switch to a curated
swatch list later, change `modes.palette.type` to `swatches` and add a
`## Palette` table below.

The `wheel` mode is HSV polar:
- Hue = `atan2(dy, dx) / 2π` (0 at +X, sweep clockwise)
- Saturation = `min(1, hypot(dx, dy) / radius)`
- Value = pressure-derived when `pressureControlsValue: true`, else 1.

## Role targets

When a color is picked the picker writes RGB to the active APC40
Track-Select target (group or fixture) by writing to the channel matching
each role's `aliases`. Mirrors `super-control-roles.md` for `red`/`green`/
`blue`.

| role  | aliases |
|-------|---------|
| red   | red, r  |
| green | green, g|
| blue  | blue, b |
