# Mini Moving Head Gobo Light (with light strips)

## Identification

- Manufacturer: Generic / not marked
- Product marking: `Mini Moving Head Gobo Light`
- Model: Unknown (sticker visible but not legible in photo)
- Model confidence: Generic, unconfirmed
- Category: Moving head / Mini gobo spot with decorative light strips
- ArtBastard profile ID: `mini-moving-head-gobo-strips`
- DMX footprint: 10 or 12 channels (mode-selectable)

Small LED moving head with colour wheel, gobo wheel, dimmer, strobe, motor
speed and built-in automatic/voice-control modes. A pair of decorative LED
"light strips" run alongside the head and are controlled by the last DMX
channel in either mode. The fixture uses an LCD menu for addressing, mode
selection and motor inversion rather than DIP switches.

## DMX Modes

### 12-channel mode

| Channel | ArtBastard role | Function | DMX values |
| --- | --- | --- | --- |
| 1 | Pan | Horizontal operation | 0-255 |
| 2 | Pan fine | Horizontal fine-tune | 0-255 |
| 3 | Tilt | Vertical operation | 0-255 |
| 4 | Tilt fine | Vertical fine-tune | 0-255 |
| 5 | Colour wheel | Colour | 0-9 white; 10-139 colour selection; 140-255 automatic colour change slow to fast |
| 6 | Gobo | Gobo wheel | 0-7 white; 8-63 fixed gobo; 64-127 shaking gobo; 128-255 automatic change pattern slow to fast |
| 7 | Strobe | Strobe | 0-255 |
| 8 | Dimmer | Master dimmer | 0-255 |
| 9 | Speed | Motor speed | 0-255 fast to slow |
| 10 | Macro | Other channels function / automatic / voice-control | 0-59 other channels function; 60-84 automatic mode 1; 85-109 automatic mode 2; 110-134 automatic mode 3; 135-159 automatic mode 4; 160-184 voice-control mode 3; 185-209 voice-control mode 2; 210-234 voice-control mode 1; 235-255 voice-control mode 4 |
| 11 | Reset | Reset | 250-255 reset (5 seconds) |
| 12 | Effect | Light strips | 5-109 colour selection; 110-255 colour auto operation |

### 10-channel mode

| Channel | ArtBastard role | Function | DMX values |
| --- | --- | --- | --- |
| 1 | Pan | Horizontal operation | 0-255 |
| 2 | Tilt | Vertical operation | 0-255 |
| 3 | Colour wheel | Colour | 0-9 white; 10-139 colour selection; 140-255 automatic colour change slow to fast |
| 4 | Gobo | Gobo wheel | 0-7 white; 8-63 fixed gobo; 64-127 shaking gobo; 128-255 automatic change pattern slow to fast |
| 5 | Strobe | Strobe | 0-255 |
| 6 | Dimmer | Master dimmer | 0-255 |
| 7 | Speed | Motor speed | 0-255 |
| 8 | Macro | Other channels function / automatic / voice-control | 0-59 other channels function; 60-159 automatic mode; 160-255 voice-control mode |
| 9 | Reset | Reset | 250-255 reset (5 seconds) |
| 10 | Effect | Light strips | 5-109 colour selection; 110-255 colour auto operation |

## Menu Configuration

Addressing and behaviour are set via the on-fixture LCD menu, not DIP switches.

| Menu | Values | Meaning |
| --- | --- | --- |
| `Addr` | `A001`-`A512` | DMX start address |
| `CHnd` | `12CH` / `10CH` | DMX channel mode |
| `SLnd` | `Auto` / `SL 1` / `SL 2` | Host mode / console (master) / secondary (slave) |
| `SHnd` | `SH 0` / `SH 1` / `SH 2` / `SH 3` | Built-in show selection (`SH 0` recommended) |
| `Soud` | `on` / `oFF` | Sound (voice) activation on or off |
| `SEnS` | `0`-`99` | Voice-activation sensitivity |
| `bLnd` | `bLAc` / `Auto` / `Soun` / `bLLd` | No-DMX behaviour: return to zero / self-propelled / sound / hold last console state |
| `LEd` | `OFF` / `ON` | LCD blanks after 5 seconds / always on |
| `diSP` | `no` / `YES` | Display orientation reverse / positive |
| `rPAN` | `no` / `YES` | X (pan) motor forward / reversed |
| `rTIL` | `no` / `YES` | Y (tilt) motor forward / reversed |
| `RESt` | `YES` | System reset |

## Capabilities

- Pan and tilt with optional fine channels in 12-channel mode
- Colour wheel with indexed colours and continuous auto-cycle
- Gobo wheel with fixed gobos, shaking gobos and auto-cycle
- Strobe and master dimmer
- Variable motor speed
- Built-in automatic shows and sound/voice-activated modes selectable from a
  single macro channel
- Secondary decorative LED light-strip channel with colour selection and
  auto-cycle
- Reset triggered from a dedicated DMX value (12-ch mode) or embedded in the
  reset menu

## Source Notes

Transcribed from user-supplied photographs of the printed manual ("Mini Moving
Head Gobo Light (with light strips)") on 2026-06-12. The manual cover, the
Function Description menu table and both DMX channel tables (10-channel and
12-channel) were used as the source. No fixture body markings were legible in
the photographs, so manufacturer and model are recorded as generic and
unconfirmed. No photograph of the fixture itself was supplied; only the manual
cover image, so no `photoUrl` is attached to this profile.
