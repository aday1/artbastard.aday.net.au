# ArtBastard Fixture Setup

Configure real DMX fixtures through ArtBastard's canonical fixture library,
then use the show builder to assign patch addresses and groups.

## Overview

A fixture is a logical grouping of DMX channels with a starting address and a
profile that explains what each channel does. ArtBastard keeps source-backed
profiles for owned hardware and starter profiles in one fixture library.

The canonical source for documented fixture profiles is
[DOCS/fixtures/README.md](fixtures/README.md). Each profile links back to the
runtime fixture entry under `react-app/src/fixtures/library` and records the
manual-derived channel maps, capability categories, addressing notes, source
confidence and gallery photos where available.

## Canonical Fixture Library

The library currently covers:

- Lasers: twinkling RGY, full-colour animation laser and Event Lighting
  EL1000RGB ILDA laser.
- Moving heads: MiniBeam spot, small gobo spot, mini LED moving-head wash,
  toy LED pan/tilt wash and generic moving-head spot.
- LED effects: Mini Spider derby and UV DMX LED par.
- Utility fixtures: dimmer, simple RGB par and RGBW par can profiles.

Use `Create the DMX show` in Fixture Setup for normal patching. It reads these
library profiles, lets you add multiples of the same fixture, groups them, and
generates the physical DMX address sheet.

## Adding A Custom Fixture

1. Open Fixture Setup in the main navigation.
2. Use `Create the DMX show` when the fixture exists in the canonical library.
3. Use the advanced profile manager only when the hardware is not yet in the
   library.
4. Define the channel layout. Example RGB+strobe profile:
   - Channel 1: Dimmer (0-255)
   - Channel 2: Red (0-255)
   - Channel 3: Green (0-255)
   - Channel 4: Blue (0-255)
   - Channel 5: Strobe (0 = off, 1-255 = speed)
5. Set the starting DMX address (1-512). The system computes the channel span
   and warns about conflicts.
6. Use the Channel Test action to verify each function. Tweak ranges if needed
   and save the profile for future use.

## Address Planning

Suggested universe layout for a typical theatre rig:

- Universe 1: front-of-house wash and key lights, addresses 1-200
- Universe 2: moving heads and movers, addresses 201-400
- Universe 3: effects and specialty fixtures, addresses 401-512

Best practices:

- Leave gaps between fixture groups for expansion.
- Document your addressing scheme and export Settings as a backup.
- Number fixtures stage left to stage right where possible.
- Keep multiples of the same fixture as separate patched instances, then group
  them for shared control when useful.

## Fixture Groups

- Create groups for batch control, such as Front Wash, Movers, Lasers, UV or
  Effects.
- A fixture can belong to multiple groups.
- Groups are reflected in SuperControl and the OSC address tree.
- Grouping is separate from patching: two identical fixtures can be patched at
  different addresses and still share one control group.

## DIP Switch Calculator

Built into the Help overlay (Help > DIP Simulator). Enter a DMX address from
1-512 and read off the binary pattern alongside a fixture-style switch block
visualisation. This is useful for older fixtures with physical switches,
including the Twinkling Laser Series RGY.

## Address Sheet PDF

Help > Address Sheet generates a printable PDF with a row per fixture: name,
profile, start address, channel count and group memberships. Use it as the
physical patch sheet when assigning addresses on the fixtures.

## Multi-Universe Planning

ArtBastard supports multiple Art-Net universes. Configure them in Settings >
Network. The DMX Control page exposes a universe selector that filters the
channel grid; the universe count is reflected in the OSC address tree as well.

Next: USAGE.md, FEATURES.md, SHORTCUTS.md.
