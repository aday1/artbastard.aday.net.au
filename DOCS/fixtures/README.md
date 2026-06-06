# ArtBastard Fixture Library

This directory contains the cleaned, source-backed profiles for physical
fixtures represented in ArtBastard.

| Catalog ID | Fixture | Category | DMX modes | Identity |
| --- | --- | --- | --- | --- |
| [AB-FIX-001](AB-FIX-001-twinkling-laser-rgy.md) | Twinkling Laser Series RGY | Laser / Twinkling and starfield | 5-channel | Generic; TL-2028 probable |

Profiles retain the manual's exact DMX ranges. Unconfirmed manufacturer or
model information is labelled as probable or unknown rather than inferred.

## Adding Another Fixture

1. Create a profile in `react-app/src/fixtures/library` using the exact manual
   ranges and source-backed identity fields.
2. Add the profile to `fixtureLibraryEntries` in `entries.ts`.
3. Add a cleaned documentation page in this directory and any gallery image under
   `react-app/public/fixtures`.
4. Run the fixture-library tests and frontend build before deploying beta.
