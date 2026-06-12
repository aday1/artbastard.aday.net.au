---
spec: fixture-library
id: minibeam-moving-head
catalogId: AB-FIX-002
name: MINIBEAM Moving Head Spot
defaultNamePrefix: MINIBEAM
type: Moving Head
category: Moving head / Beam spot with gobos
manufacturer: Generic
model: MiniBeam
modelConfidence: confirmed
documentationPath: DOCS/fixtures/MOVING-HEAD/MOVING-HEAD-MINIBEAM.md
tags: [MOVING-HEAD, BEAM, SPOT, GOBO, PRISM, FROST, MINIBEAM]
notes: 18-channel MiniBeam moving head beam/spot with 14-colour wheel, 14-gobo wheel, prism with rotation, frost, focus, fine pan/tilt, macro, reset and lamp control.
---

# MINIBEAM Moving Head Spot

18-channel MiniBeam moving head beam/spot with colour wheel, gobo wheel,
prism (insert + rotation), frost, focus, fine pan/tilt and lamp/reset
control.

## Mode: 18-channel mode

| name           | type   | min | max | description |
|----------------|--------|-----|-----|-------------|
| Colour         | color  | 0   | 255 | 0-3 white, 4-127 14 colours / split, 128-191 rotate fwd, 192-255 rotate rev |
| Strobe         | strobe | 0   | 255 | Pulse, open, random strobe bands |
| Dimmer         | dimmer | 0   | 255 | Master dimmer |
| Gobo           | gobo   | 0   | 255 | 0-7 open, 8-127 14 gobos, 128-191 reverse rotation, 192-255 forward rotation |
| Prism          | prism  | 0   | 255 | 0-127 none, 128-255 insert prism |
| Prism Rotation | other  | 0   | 255 | 0-127 indexed angle, 128-190 fwd rotation, 191-192 stop, 193-255 rev rotation |
| Effect         | other  | 0   | 255 | 0-127 none, 128-255 colourful effect insert |
| Frost          | other  | 0   | 255 | 0-127 none, 128-255 frost insert |
| Focus          | focus  | 0   | 255 | Lens focus, far to near |
| Pan            | pan    | 0   | 255 | Coarse pan, 0-540 degrees |
| Pan Fine       | pan    | 0   | 255 | Fine pan, 0-2 degrees |
| Tilt           | tilt   | 0   | 255 | Coarse tilt, 0-270 degrees |
| Tilt Fine      | tilt   | 0   | 255 | Fine tilt, 0-1 degree |
| Macro          | macro  | 0   | 255 | 0-14 none, 15-255 effects in 5-value steps |
| Reset          | reset  | 0   | 255 | Effect/pan-tilt/fixture reset bands (3 s) |
| Lamp           | other  | 0   | 255 | 0-25 none, 26-100 lamp off (3 s), 101-255 lamp on (3 s) |
| Pan/Tilt Speed | speed  | 0   | 255 | Pan/tilt movement speed, fast to slow |
| Effect Speed   | speed  | 0   | 255 | Colour / effect speed |
