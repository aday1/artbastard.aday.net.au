# ArtBastard Fixture Setup

Configure your luminaires for control through ArtBastard's fixture
management system.

## Overview

A fixture is a logical grouping of DMX channels with a starting address and
a profile that explains what each channel does. ArtBastard stores fixtures
as individual JSON files for clean version control.

## Built-in profiles

ArtBastard ships profiles for the common fixture families:

- Moving lights: pan / tilt with speed control, colour wheels, GOBO,
  beam control (zoom / focus / iris), animation / pattern channels.
- LED fixtures: RGB / RGBW / RGBA mixing, strobe, dimming, colour
  temperature (CTO / CTB), macros and special effects.
- Specialty effects: lasers (including EL1000RGB), haze and fog
  machines, LED strips and pixel mapping, UV / blacklight fixtures.

## Adding a custom fixture

1. Open Fixture Setup in the main navigation.
2. Click "Add New Fixture".
3. Define the channel layout. Example RGB+strobe profile:
   - Channel 1: Dimmer (0-255)
   - Channel 2: Red (0-255)
   - Channel 3: Green (0-255)
   - Channel 4: Blue (0-255)
   - Channel 5: Strobe (0 = off, 1-255 = speed)
4. Set the starting DMX address (1-512). The system computes the channel
   span and warns about conflicts.
5. Use the Channel Test action to verify each function. Tweak ranges if
   needed and save the profile for future use.

## Address planning

Suggested universe layout for a typical theatre rig:

- Universe 1: front-of-house wash and key lights, addresses 1-200
- Universe 2: moving heads and movers, addresses 201-400
- Universe 3: effects and specialty fixtures, addresses 401-512

Best practices:

- Leave gaps between fixture groups for expansion.
- Document your addressing scheme - export Settings as a backup.
- Number fixtures stage left to stage right where possible.

## Fixture groups

- Create groups for batch control (Front Wash, Movers, Effects, etc.).
- A fixture can belong to multiple groups.
- Groups are reflected in SuperControl and the OSC address tree.

## DIP switch calculator

Built into the Help overlay (Help > DIP Simulator). Enter a DMX address
1-512 and read off the binary pattern alongside a fixture-style switch
block visualisation. Useful for older fixtures with physical switches.

## Address Sheet PDF

Help > Address Sheet generates a printable PDF with a row per fixture:
name, profile, start address, channel count, group memberships. Useful
to leave at the desk during a tech run.

## Multi-universe planning

ArtBastard supports multiple Art-Net universes. Configure them in
Settings > Network. The DMX Control page exposes a universe selector that
filters the channel grid; the universe count is reflected in the OSC
address tree as well.

Next: USAGE.md, FEATURES.md, SHORTCUTS.md.
