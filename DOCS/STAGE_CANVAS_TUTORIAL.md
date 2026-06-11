# Stage Canvas Tutorial

Build a usable ArtBastard show from fixtures without starting in nested forms.
The stage canvas is the main fixture setup surface: patch fixtures by placing
them, organize them spatially, then drive the same selection from Super Control,
APC40, MIDI, OSC, scenes, and ACTS.

## What You Are Building

By the end of this tutorial you should have:

- Real patched fixtures with safe DMX start addresses.
- A saved top-down stage layout.
- Fixture groups based on position and capability.
- Optional starter scenes and ACTS you can ignore, edit, or replace.
- A working path from fixture selection to Super Control, APC40 Deck A/B, and
  scene capture.

The stage map uses a 1000x600 virtual space. Top view and Side view are two
views of the same saved coordinates, so moving a fixture in one view changes
the same layout item.

## 1. Open Fixture Setup

1. Launch ArtBastard and open `#/fixture`.
2. The center of the page is the stage map.
3. The fixture library is on the left on desktop.
4. The inspector is on the right on desktop, or a bottom drawer on mobile.

Empty rigs show a clear target area. That is intentional: drop or tap a
library profile onto the map to create a real fixture.

## 2. Patch Fixtures By Placing Them

Desktop:

1. Search the library for the closest fixture profile.
2. Drag it onto the stage.
3. Drop it where the fixture sits physically.

Mobile or touch screen:

1. Tap a library profile.
2. Tap the stage where that fixture belongs.

On drop, ArtBastard immediately:

- Creates a fixture from the selected profile.
- Assigns the next available safe DMX start address.
- Adds a `fixtureLayout` item with position, rotation, and scale.
- Selects the new fixture globally.
- Opens the inspector for exact edits.

Use the inspector to rename the fixture, correct the DMX start address, rotate
the map icon, change scale, or review channel roles. If you see a conflict
warning, edit the start address until the span no longer overlaps another
fixture.

## 3. Match The Physical Stage

Use the map as your paper plot:

- Put front fixtures near Downstage.
- Put back truss or rear fixtures near Upstage.
- Keep stage-left fixtures on Stage Left and stage-right fixtures on Stage Right.
- Use Top view for normal layout work.
- Use Side view when height, depth, or front/back relationships are easier to
  reason about.
- Leave Snap on while roughing in a rig; turn it off for fine placement.
- Use Fit and Zoom when the rig is dense.

The map is not just decoration. Spatial placement feeds Smart Groups, scene
seeds, operator selection, and visual debugging.

## 4. Select Fixtures Spatially

Click a fixture to select it. Shift-click adds or removes it from the current
selection. Box Select lets you drag around several fixtures at once.

The selected fixtures are the global `selectedFixtures` set. That means:

- Super Control immediately drives the map selection.
- APC40 fixture/group selection follows the same selection model.
- Returning to Fixture Setup highlights fixtures selected elsewhere.
- Scene seeds and group tools can use the same selected rig area.

This is the main reason the canvas exists: choose fixtures like an operator
looking at a stage, not like someone reading a database table.

## 5. Create Groups From The Map

With fixtures selected, use the inspector to:

- Create a new group from the current selection.
- Add the selection to an existing group.
- Remove the selection from a group.

Good starter groups:

- Front Wash
- Back Wash
- Movers
- Lasers
- FX / Strobe
- Stage Left
- Stage Center
- Stage Right
- Upstage
- Downstage

Use Smart Groups once fixtures have positions. It creates capability groups
from fixture profiles and map-aware groups from placement. Review the
suggestions before relying on them for show-critical control.

## 6. Drive Fixtures From Super Control

After patching and selecting fixtures:

1. Open Advanced Fixture Control / Super Control on the Fixture page.
2. Confirm the selected fixtures or group are active.
3. Move the Dimmer, Color, Pan/Tilt, Gobo, Strobe, or other role controls that
   exist on those fixtures.
4. Watch the DMX output and physical fixtures.

Role-aware controls only appear when the selected fixture profiles expose those
roles. If a moving head has a gobo channel but no control appears, check the
fixture profile channel role before blaming the controller.

## 7. Use Optional Seeds

Seeds are shortcuts, not a requirement.

Use Seed Scenes after fixtures exist:

- Smart Starter 40 fills one APC40 deck with ready-made looks.
- Smart A+B 80 fills Deck A and Deck B with crossfader-friendly variants.
- Compact Starter 16 creates a smaller starter set.

Turn on automated timelines when you want movement, pulse, gobo, color, or
strobe templates generated from fixture roles.

Use Seed ACTS after scenes exist:

- Starter ACTS 5 maps well to the APC40 Scene Launch row.
- Performance ACTS 8 adds longer show sections.

Generated scenes and ACTS are tagged. Reseeding updates generated content only
and preserves handmade scenes and ACTS. You can skip seeds entirely and build
from scratch.

## 8. Use Giddy Up For A Fast First Show

Giddy Up is the one-button quick-start path once fixtures are patched.

It applies Smart Groups, seeds Deck A starter scenes, and creates starter ACTS.
Use it when you need a rig to do something useful now, then refine the result
like normal ArtBastard scenes and ACTS.

Avoid Giddy Up when you are intentionally building a clean show file from zero.
The manual path is still fully supported.

## 9. Drive The Show

Common live paths:

- Super Control: select fixtures or groups, shape a look, save a scene.
- Scenes and Acts: launch saved looks, edit scene timelines, assign clip slots.
- APC40 Deck A/B: Session View launches Deck A scenes; hold Shift for Deck B.
- APC40 Scene Launch: fires ACTS 1-5.
- APC40 crossfader: blends the active Deck A and Deck B scenes.
- Mobile route: touch-first Super Control and DMX from a phone or tablet.
- OSC/MIDI: map external controllers after the rig and roles are known.

For a first pass, make one baseline scene per major group, then add movement,
gobo, strobe, and color scenes once fixture addressing is proven.

## 10. Debug Checklist

If the map looks right but the fixture does not respond:

- Confirm the physical fixture address matches the inspector start address.
- Check the fixture mode/personality against the selected profile.
- Confirm the fixture span does not overlap another patched fixture.
- Verify universe and Art-Net node settings in Settings.
- Move one direct DMX channel from the DMX page to test raw output.
- Use the Help DIP Simulator for older DIP-switch fixtures.
- Export the Address Sheet PDF and compare it against the physical rig.

If Super Control drives the wrong behavior:

- Check channel roles in the profile.
- Verify the selected fixtures are the intended fixtures.
- Confirm a group does not include stale members.
- Delete or update old layout/group data if a fixture was removed physically.

Next: `DOCS/FIXTURES.md`, `DOCS/USAGE.md`, `DOCS/APC40_CHEATSHEET.md`.
