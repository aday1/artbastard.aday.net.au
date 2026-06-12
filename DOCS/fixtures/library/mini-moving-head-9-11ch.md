---
spec: fixture-library
id: mini-moving-head-9-11ch
catalogId: AB-FIX-015
name: Mini Moving Head Gobo Spot (9/11ch)
defaultNamePrefix: Mini MH Spot
type: Moving Head
category: Moving head / Mini gobo spot with colour wheel
manufacturer: Generic
model: 9/11-channel mini moving head with 8-colour and 8-gobo wheels
modelConfidence: probable
documentationPath: DOCS/fixtures/MOVING-HEAD/MOVING-HEAD-mini-9-11ch.md
tags: [MOVING-HEAD, GOBO, COLOR, MINI, SPOT]
notes: Small generic moving head with 8-position colour wheel, 8-position gobo wheel with jitter and rotation, strobe, dimmer, motor speed, built-in automatic programs and selectable dim curves. Selectable 9- or 11-channel DMX mode via on-fixture LCD menu.
---

# Mini Moving Head Gobo Spot (9/11ch)

Small generic moving head with colour wheel, gobo wheel (with jitter
positions), strobe, dimmer, motor speed and built-in automatic programs.
Mode selectable between 9 and 11 channels from the fixture's LCD menu; the
11-channel mode adds fine pan and fine tilt.

## Mode: 9-channel mode

| name           | type   | min | max | description |
|----------------|--------|-----|-----|-------------|
| Pan            | pan    | 0   | 255 | X-Pan |
| Tilt           | tilt   | 0   | 255 | Y-Tilt |
| Colour         | color  | 0   | 255 | 0-7 white, 8-56 colours 1-7, 57-127 colour 8 / half, 128-255 rotation |
| Gobo           | gobo   | 0   | 255 | 0-63 gobos 1-8, 64-127 gobo jitter 1-8, 128-255 rotation / on |
| Strobe         | strobe | 0   | 255 | Multi-mode strobe with pulse and dimming bands |
| Dimmer         | dimmer | 0   | 255 | Master dimmer |
| Speed          | speed  | 0   | 255 | Pan/Tilt speed, fast to slow |
| Macro          | macro  | 0   | 255 | Automatic / sound-effects programs |
| Dim Mode       | other  | 0   | 255 | Standard / Stage / TV / Building / Theatre / Reset |

## Mode: 11-channel mode

| name           | type   | min | max | description |
|----------------|--------|-----|-----|-------------|
| Pan            | pan    | 0   | 255 | X-Pan |
| Tilt           | tilt   | 0   | 255 | Y-Tilt |
| Pan Fine       | pan    | 0   | 255 | X-Pan fine |
| Tilt Fine      | tilt   | 0   | 255 | Y-Tilt fine |
| Colour         | color  | 0   | 255 | 0-7 white, 8-56 colours 1-7, 57-127 colour 8 / half, 128-255 rotation |
| Gobo           | gobo   | 0   | 255 | 0-63 gobos 1-8, 64-127 gobo jitter 1-8, 128-255 rotation / on |
| Strobe         | strobe | 0   | 255 | Multi-mode strobe with pulse and dimming bands |
| Dimmer         | dimmer | 0   | 255 | Master dimmer |
| Speed          | speed  | 0   | 255 | Pan/Tilt speed, fast to slow |
| Macro          | macro  | 0   | 255 | Automatic / sound-effects programs |
| Dim Mode       | other  | 0   | 255 | Standard / Stage / TV / Building / Theatre / Reset |
