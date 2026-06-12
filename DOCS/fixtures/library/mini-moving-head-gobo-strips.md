---
spec: fixture-library
id: mini-moving-head-gobo-strips
catalogId: AB-FIX-014
name: Mini Moving Head Gobo Light (with strips)
defaultNamePrefix: Mini Gobo MH
type: Moving Head
category: Moving head / Mini gobo spot with decorative light strips
manufacturer: Generic
model: 10/12-channel mini moving head gobo with LED light strips
modelConfidence: probable
documentationPath: DOCS/fixtures/MOVING-HEAD/MOVING-HEAD-mini-gobo-with-strips.md
tags: [MOVING-HEAD, GOBO, COLOR, MINI, LED, STRIPS]
notes: Small LED moving head with colour wheel, gobo wheel, strobe, dimmer, motor speed, built-in automatic and sound-active modes, and a secondary LED light-strip channel. Selectable 10- or 12-channel DMX mode via on-fixture LCD menu.
---

# Mini Moving Head Gobo Light (with strips)

Small generic LED moving head with gobo wheel, colour wheel, strobe, dimmer
and secondary LED light-strip channel. Mode selectable between 10 and 12
channels from the fixture's LCD menu.

## Mode: 12-channel mode

| name        | type   | min | max | description |
|-------------|--------|-----|-----|-------------|
| Pan         | pan    | 0   | 255 | Horizontal operation |
| Pan Fine    | pan    | 0   | 255 | Horizontal fine-tune |
| Tilt        | tilt   | 0   | 255 | Vertical operation |
| Tilt Fine   | tilt   | 0   | 255 | Vertical fine-tune |
| Colour      | color  | 0   | 255 | 0-9 white, 10-139 colour selection, 140-255 auto colour change |
| Gobo        | gobo   | 0   | 255 | 0-7 white, 8-63 fixed gobo, 64-127 shaking gobo, 128-255 auto change |
| Strobe      | strobe | 0   | 255 | Strobe |
| Dimmer      | dimmer | 0   | 255 | Master dimmer |
| Speed       | speed  | 0   | 255 | Motor speed, fast to slow |
| Macro       | macro  | 0   | 255 | Other / automatic / voice-control programs |
| Reset       | reset  | 0   | 255 | 250-255 reset (5 s) |
| Light Strip | other  | 0   | 255 | 5-109 colour selection, 110-255 auto colour cycle |

## Mode: 10-channel mode

| name        | type   | min | max | description |
|-------------|--------|-----|-----|-------------|
| Pan         | pan    | 0   | 255 | Horizontal operation |
| Tilt        | tilt   | 0   | 255 | Vertical operation |
| Colour      | color  | 0   | 255 | 0-9 white, 10-139 colour selection, 140-255 auto colour change |
| Gobo        | gobo   | 0   | 255 | 0-7 white, 8-63 fixed gobo, 64-127 shaking gobo, 128-255 auto change |
| Strobe      | strobe | 0   | 255 | Strobe |
| Dimmer      | dimmer | 0   | 255 | Master dimmer |
| Speed       | speed  | 0   | 255 | Motor speed |
| Macro       | macro  | 0   | 255 | 0-59 other channels, 60-159 automatic, 160-255 voice-control |
| Reset       | reset  | 0   | 255 | 250-255 reset (5 s) |
| Light Strip | other  | 0   | 255 | 5-109 colour selection, 110-255 auto colour cycle |
