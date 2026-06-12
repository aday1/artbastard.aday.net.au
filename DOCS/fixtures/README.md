# ArtBastard Fixture Library

This directory contains the cleaned, source-backed profiles for physical
fixtures represented in ArtBastard. Fixtures are organised by category
folder so the app — and you — can drill into them; the runtime catalog is
generated from `library/*.md` at build time via `scripts/buildSpecs.mjs`.

| Catalog ID | Fixture | Category | DMX modes | Identity |
| --- | --- | --- | --- | --- |
| [AB-FIX-001](LASER/LASER-twinkling-rgy.md) | Twinkling Laser Series RGY | Laser / Twinkling and starfield | 5-channel | Generic; TL-2028 probable |
| [AB-FIX-002](MOVING-HEAD/MOVING-HEAD-MINIBEAM.md) | MINIBEAM Moving Head Spot | Moving head / Beam spot with gobos | 18-channel | Generic MiniBeam |
| [AB-FIX-003](MOVING-HEAD/MOVING-HEAD-led-wash.md) | Mini LED Moving Head Wash | Moving head / LED wash | 14-channel, 9-channel | Generic |
| [AB-FIX-004](UV/UV-led-par.md) | UV DMX LED Par | UV / LED par wash | 7-channel | Generic |
| [AB-FIX-005](MOVING-HEAD/MOVING-HEAD-small-spot.md) | Small Moving Head Spot | Moving head / Small spot with colour and gobos | 9-channel, 11-channel | Generic; manual-only |
| [AB-FIX-006](LASER/LASER-full-colour-animation.md) | Full Colour Animation Laser | Laser / Full-colour animation and pattern laser | 12-channel, 20-channel | Generic; ripped manual |
| [AB-FIX-007](MOVING-HEAD/MOVING-HEAD-tiny-wash.md) | Tiny LED Moving Head Wash | Moving head / Toy LED wash | 13-channel, 11-channel | Generic |
| [AB-FIX-008](LED-EFFECT/LED-EFFECT-spider-derby.md) | Mini Spider Light | LED effect / Mini spider derby | 15-channel, 7-channel | Generic |
| [AB-FIX-009](LASER/LASER-ilda-rgb-animation.md) | Event Lighting EL1000RGB | Laser / ILDA RGB animation laser | 16-channel | Event Lighting |
| [AB-FIX-010](PAR/PAR-generic-dimmer.md) | Generic Dimmer | Generic control | 1-channel | ArtBastard canonical starter |
| [AB-FIX-011](PAR/PAR-simple-rgb.md) | Simple RGB Par Can | Par / Wash | 4-channel | ArtBastard canonical starter |
| [AB-FIX-012](PAR/PAR-rgbw.md) | RGBW Par Can | Par / Wash | 5-channel | ArtBastard canonical starter |
| [AB-FIX-013](MOVING-HEAD/MOVING-HEAD-basic-spot.md) | Basic Moving Head Spot | Moving head | 10-channel | ArtBastard canonical starter |
| [AB-FIX-014](MOVING-HEAD/MOVING-HEAD-mini-gobo-with-strips.md) | Mini Moving Head Gobo Light (light strips) | Moving head / Mini gobo with side LED strips | 10-channel, 12-channel | Generic |
| [AB-FIX-015](MOVING-HEAD/MOVING-HEAD-mini-9-11ch.md) | Mini Moving Head Gobo Spot (9/11ch) | Moving head / Mini gobo spot with colour wheel | 9-channel, 11-channel | Generic |

Profiles retain the manual's exact DMX ranges. Unconfirmed manufacturer or
model information is labelled as probable or unknown rather than inferred.
Generic starter profiles are kept here too so the app has one canonical
fixture library for source-backed hardware and temporary patching.

Favourites still work across folders — ArtBastard stores favourites by the
stable `id` field, so reorganising the on-disk layout never breaks them.

## Adding Another Fixture

1. Drop a hardware doc under the matching category folder
   (`LASER/`, `LED-EFFECT/`, `MOVING-HEAD/`, `PAR/`, `UV/`, or a new
   `CATEGORY/` if none fit) with the manual's exact DMX ranges. Filename
   convention: `CATEGORY-short-name.md`.
2. Add a library entry under `library/` with the `spec: fixture-library`
   frontmatter — `id`, `catalogId`, `name`, `category`, `modes`, and a
   `documentationPath` pointing back at the hardware doc.
3. `scripts/buildSpecs.mjs` regenerates `react-app/src/fixtures/library`
   on save; no TypeScript edits required.
4. Drop a row into the table above and link the doc.
5. Optional: add a gallery image under `react-app/public/fixtures` and
   reference it from the library entry's `photoUrl`.
