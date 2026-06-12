# Mini Moving Head Gobo Spot (9/11-channel)

## Identification

- Manufacturer: Generic / not marked
- Product marking: not legible in supplied photographs
- Model: Unknown
- Model confidence: Generic, unconfirmed
- Category: Moving head / Mini gobo spot with colour wheel
- ArtBastard profile ID: `mini-moving-head-9-11ch`
- DMX footprint: 9 or 11 channels (mode-selectable via menu)

Small generic moving head with colour wheel (8 colours plus half-colour and
continuous rotation), gobo wheel (8 gobos plus 8 gobo-jitter positions),
strobe, dimmer, motor speed, built-in automatic programs and selectable dim
curves. Configured by on-fixture LCD menu, not DIP switches. The 11-channel
mode adds fine pan and fine tilt to the 9-channel layout.

## DMX Modes

### 9-channel mode

| Channel | ArtBastard role | Function | DMX values |
| --- | --- | --- | --- |
| 1 | Pan | X-Pan | 0-255 = 0-100% |
| 2 | Tilt | Y-Tilt | 0-255 = 0-100% |
| 3 | Colour wheel | Colour selection and rotation | see colour table |
| 4 | Gobo | Gobo wheel | see gobo table |
| 5 | Strobe | Strobe / shutter | see strobe table |
| 6 | Dimmer | Master dimmer | 0-255 = 0-100% |
| 7 | Speed | Pan/Tilt speed | 0-255 fast to slow |
| 8 | Macro | Automatic programs ("Model") | see programs table |
| 9 | Effect | Dim modes / reset | see dim-modes table |

### 11-channel mode

| Channel | ArtBastard role | Function | DMX values |
| --- | --- | --- | --- |
| 1 | Pan | X-Pan | 0-255 = 0-100% |
| 2 | Tilt | Y-Tilt | 0-255 = 0-100% |
| 3 | Pan fine | X-Pan fine | 0-255 |
| 4 | Tilt fine | Y-Tilt fine | 0-255 |
| 5 | Colour wheel | Colour selection and rotation | see colour table |
| 6 | Gobo | Gobo wheel | see gobo table |
| 7 | Strobe | Strobe / shutter | see strobe table |
| 8 | Dimmer | Master dimmer | 0-255 = 0-100% |
| 9 | Speed | Pan/Tilt speed | 0-255 fast to slow |
| 10 | Macro | Automatic programs ("Model") | see programs table |
| 11 | Effect | Dim modes / reset | see dim-modes table |

## Colour Wheel Detail

| DMX values | Function |
| --- | --- |
| 000-007 | White / open (0-100%) |
| 008-014 | Colour 1 |
| 015-021 | Colour 2 |
| 022-028 | Colour 3 |
| 029-035 | Colour 4 |
| 036-042 | Colour 5 |
| 043-049 | Colour 6 |
| 050-056 | Colour 7 |
| 057-127 | Colour 8 / split-colour positions |
| 128-189 | Half colour |
| 190-193 | Colour rotation, fast to slow then stop |
| 194-255 | Colour rotation, slow to fast |

Two adjacent rows in the source photograph give overlapping ranges for the
half-colour and rotation positions; the table above is the most consistent
reading.

## Gobo Wheel Detail

| DMX values | Function |
| --- | --- |
| 000-007 | Gobo 1 (or open) |
| 008-015 | Gobo 2 |
| 016-023 | Gobo 3 |
| 024-031 | Gobo 4 |
| 032-039 | Gobo 5 |
| 040-047 | Gobo 6 |
| 048-055 | Gobo 7 |
| 056-063 | Gobo 8 |
| 064-071 | Gobo 1 jitter |
| 072-079 | Gobo 2 jitter |
| 080-087 | Gobo 3 jitter |
| 088-095 | Gobo 4 jitter |
| 096-103 | Gobo 5 jitter |
| 104-111 | Gobo 6 jitter |
| 112-119 | Gobo 7 jitter |
| 120-127 | Gobo 8 jitter |
| 128-189 | Gobo rotation, fast to slow then stop |
| 190-193 | Gobo rotation, slow to fast |
| 194-255 | Gobo on (steady) |

## Strobe Detail

| DMX values | Function |
| --- | --- |
| 000-007 | Off |
| 008-015 | Strobe, slow to fast |
| 016-131 | Off |
| 132-139 | Pulse: Fast-ON, Slow-OFF |
| 140-181 | Off |
| 182-189 | Pulse: Fast-OFF, Slow-ON |
| 190-231 | Off |
| 232-239 | Dimming |
| 240-247 | Off |
| 248-255 | Open (0-100%) |

The strobe table in the supplied manual has multiple "Off" intervals between
named modes; values are transcribed as printed.

## Automatic Programs ("Model")

| DMX values | Function |
| --- | --- |
| 000-069 | No program |
| 070-099 | Pan/Tilt moving, lighting ON |
| 100-119 | Colour moving, lighting ON |
| 120-199 | Pan/Tilt moving (continued) |
| 200-249 | Gobo moving, lighting ON |
| 250-255 | Sound-effects show |

The original printed table splits the same labels across stacked ranges; the
table above merges them into the implied bands.

## Dim Modes / Reset

| DMX values | Function |
| --- | --- |
| 000-020 | Standard dim curve |
| 021-040 | Stage |
| 041-060 | TV |
| 061-080 | Building |
| 081-100 | Theatre |
| 101-255 | Reset |

## Menu Configuration

| Menu | Values | Meaning |
| --- | --- | --- |
| `Addr` | `A001`-`A512` | DMX start address |
| `ChNd` | `9CH` / `11CH` | DMX channel mode |
| `SLnd` | `Auto` / `Sh1` / `Sh2` | Host / secondary / slave mode |
| `ShNd` | `Sh0` / `Sh1` / `Sh2` / `Sh3` | Built-in show selection |

## Capabilities

- Pan and tilt with optional fine channels in 11-channel mode
- 8-position colour wheel plus half-colour and continuous rotation
- 8-position gobo wheel plus matching gobo-jitter positions and rotation
- Strobe with slow-fast, pulse and dimming modes
- Master dimmer
- Variable pan/tilt speed
- Built-in automatic programs and sound-effects show
- Selectable dim curves (Standard / Stage / TV / Building / Theatre) and reset
  on the last channel

## Source Notes

Transcribed from user-supplied photographs of the printed manual on
2026-06-12. The cover and front-matter pages were not supplied, so the
product name and manufacturer are not recorded. The Color, Gobo and Strobe
channel tables in the original manual have overlapping or stacked ranges that
are partially obscured by perspective in the photographs; the tables above
represent the most consistent reading and are noted where they merge or
disagree with the printed rows. No fixture photograph was supplied, so no
`photoUrl` is attached.
