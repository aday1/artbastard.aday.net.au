# ArtBastard Fixture Library

This directory contains the cleaned, source-backed profiles for physical
fixtures represented in ArtBastard.

| Catalog ID | Fixture | Category | DMX modes | Identity |
| --- | --- | --- | --- | --- |
| [AB-FIX-001](AB-FIX-001-twinkling-laser-rgy.md) | Twinkling Laser Series RGY | Laser / Twinkling and starfield | 5-channel | Generic; TL-2028 probable |
| [AB-FIX-002](AB-FIX-002-minibeam-moving-head.md) | MiniBeam Moving Head Spot | Moving head / Beam spot with gobos | 18-channel | Generic MiniBeam |
| [AB-FIX-003](AB-FIX-003-mini-led-moving-head-wash.md) | Mini LED Moving Head Wash | Moving head / LED wash | 14-channel, 9-channel | Generic |
| [AB-FIX-004](AB-FIX-004-uv-dmx-led-par.md) | UV DMX LED Par | UV / LED par wash | 7-channel | Generic |
| [AB-FIX-005](AB-FIX-005-small-moving-head-spot.md) | Small Moving Head Spot | Moving head / Small spot with colour and gobos | 9-channel, 11-channel | Generic; manual-only |
| [AB-FIX-006](AB-FIX-006-full-colour-animation-laser.md) | Full Colour Animation Laser | Laser / Full-colour animation and pattern laser | 12-channel, 20-channel | Generic; ripped manual |
| [AB-FIX-007](AB-FIX-007-tiny-led-moving-head-wash.md) | Tiny LED Moving Head Wash | Moving head / Toy LED wash | 13-channel, 11-channel | Generic |
| [AB-FIX-008](AB-FIX-008-mini-spider-light.md) | Mini Spider Light | LED effect / Mini spider derby | 15-channel, 7-channel | Generic |
| [AB-FIX-009](AB-FIX-009-event-lighting-el1000rgb.md) | Event Lighting EL1000RGB | Laser / ILDA RGB animation laser | 16-channel | Event Lighting |

Profiles retain the manual's exact DMX ranges. Unconfirmed manufacturer or
model information is labelled as probable or unknown rather than inferred.

## Adding Another Fixture

1. Create a profile in `react-app/src/fixtures/library` using the exact manual
   ranges and source-backed identity fields.
2. Add the profile to `fixtureLibraryEntries` in `entries.ts`.
3. Add a cleaned documentation page in this directory and any gallery image under
   `react-app/public/fixtures`.
4. Run the fixture-library tests and frontend build before deploying beta.
