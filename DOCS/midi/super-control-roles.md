---
spec: super-control-roles
version: 1
fullOnExcludedTypes:
  - reset
  - reset_control
  - function
  - lamp
  - lamp_on
  - lamp_control
  - mode
  - sound
  - auto
---

# SuperControl Role Spec

Drives the APC40 Device Control auto-rotation (`Device Knob` priority list)
and the fixed Track Control knob assignments.

Edits regenerate `react-app/src/midi/generated/superControlRolesSpec.ts`.

## Device role priority (auto-bank order)

Top of the table is highest priority. When a fixture or group has matching
channels for entries near the top, they fill the 8 Device Control knobs in
order, rotating with the bank offset.

| label        | controlName    | aliases                                                                            |
|--------------|----------------|------------------------------------------------------------------------------------|
| Gobo         | gobo           | gobo, gobowheel, gobo_wheel                                                        |
| Gobo Rotate  | gobo_rotation  | gobo_rotation, goborotation, gobo_rotate, gobo_spin                                |
| Color Wheel  | color_wheel    | color_wheel, colour_wheel, colorwheel, colourwheel                                 |
| Prism        | prism          | prism, prism_rotate, prism_rotation                                                |
| Iris         | iris           | iris                                                                               |
| Focus        | focus          | focus                                                                              |
| Zoom         | zoom           | zoom                                                                               |
| Strobe       | strobe         | strobe, shutter                                                                    |
| Macro        | macro          | macro, program, pattern, effect, effects                                           |
| Speed        | speed          | speed, rate, movement_speed, effect_speed                                          |
| Pan Fine     | fine_pan       | pan_fine, finepan, pan_lsb                                                         |
| Tilt Fine    | fine_tilt      | tilt_fine, finetilt, tilt_lsb                                                      |
| White        | white          | white, w                                                                           |
| Amber        | amber          | amber, a                                                                           |
| UV           | uv             | uv, ultraviolet                                                                    |
| Red          | red            | red, r                                                                             |
| Green        | green          | green, g                                                                           |
| Blue         | blue           | blue, b                                                                            |
| Pan          | pan            | pan, pan_coarse                                                                    |
| Tilt         | tilt           | tilt, tilt_coarse                                                                  |

## Track control knob assignment (fixed)

The 8 Track Control encoders are fixed by position (column 0 = Pan, etc.).
This is the *encoder above each fader*, not the Device Control row.

| slot | label  | controlName | aliases                                |
|------|--------|-------------|----------------------------------------|
| 0    | Pan    | pan         | pan, pan_coarse                        |
| 1    | Tilt   | tilt        | tilt, tilt_coarse                      |
| 2    | Red    | red         | red, r                                 |
| 3    | Green  | green       | green, g                               |
| 4    | Blue   | blue        | blue, b                                |
| 5    | White  | white       | white, w                               |
| 6    | Strobe | strobe      | strobe, shutter                        |
| 7    | Speed  | speed       | speed, rate, effect_speed              |
