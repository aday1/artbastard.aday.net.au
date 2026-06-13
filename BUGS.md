# Bugs / Known Issues

## ROLI Lightpad joined-block LED painting is unreliable

Date logged: 2026-06-13

Status: open, deferred

### Summary

ArtBastard can use physically joined ROLI Lightpad Blocks as controllers, with one block connected over USB and the second joined to it. Touch input is usable enough for now:

- PAN/TILT control works as an input surface.
- Colour control works as an input surface, though it has had visual glitches during development.
- The ROLI Debug Panel paint test can fill an entire block red.

The remaining problem is LED feedback on the PAN/TILT block. It is not reliable enough to keep tuning visually right now.

### Symptoms

- PAN/TILT touch control updates DMX, but the LED drawing on the PAN/TILT block is inconsistent.
- The block can now be made to fill the entire pad sometimes, but live updates are too slow or do not always happen when touched.
- The visual can occasionally stop or blank out a bottom row/region.
- Earlier builds only painted about five rows of the PAN/TILT pad, or painted different fragments after browser refreshes.
- Debug paint test fills the entire pad red, which means the basic SysEx/handshake path can work.
- The problem appears specifically around live/non-solid frames and/or how queued frame packets are ACKed/applied.

### Current workaround

Treat the ROLI blocks as touch controllers for now and do not rely on their LED feedback during a show. The controls are usable even when the visual feedback is wrong.

### Implementation state at time of logging

Relevant files touched during this work:

- `react-app/src/engines/roliLightpad.ts`
- `react-app/src/engines/roliColourWheel.ts`
- `react-app/src/hooks/useRoliLightpad.ts`
- `react-app/src/hooks/useGlobalBrowserMidi.ts`
- `react-app/src/components/dmx/RoliColourWheel.tsx`
- `react-app/src/components/dmx/RoliColourWheel.module.scss`
- `react-app/src/components/dmx/SuperControl.tsx`
- `react-app/src/components/dmx/SuperControl.module.scss`
- `react-app/src/components/settings/RoliDebugPanel.tsx`
- `react-app/src/components/ui/controls/ColorRangeSlider.module.scss`
- `react-app/src/components/layout/Layout.tsx`

Useful pieces that should probably be kept:

- Joined-block topology support creates logical ROLI devices for the reported topology indices.
- ROLI roles are assigned as `primary` for PAN/TILT and `colour-wheel` for colour.
- Browser-side ROLI ownership tries to avoid old tabs fighting the current tab.
- `Reconnect / Rescan` in the ROLI debug panel is useful.
- RGB sliders were normalized so red/green/blue controls look consistent.
- Colour surface was changed to a rectangular RGB strip, which feels closer to the physical pad.

### Things already tried

- Topology-aware routing for physically joined blocks.
- ACK-paced LED packet queue.
- Shared-output lock for logical blocks that share one USB MIDI output.
- Active-browser-tab ownership lock.
- Forcing full-frame PAN/TILT updates instead of relying on diffs.
- Raw 15x15 PAN/TILT frame builder in `SuperControl` instead of canvas downsampling.
- Replacing the ArtBastard packet splitter with logic closer to the original Roliblocks `DataChangeListBuilder`.
- Various visual experiments: full crosshair, compact reticle, bright backgrounds, retained cursor, ghost trail, Y-stretch. The Y-stretch made things worse and should not be reintroduced blindly.

### Suspected causes

Likely areas to investigate later:

- ACK sequencing for live PAN/TILT frames versus debug paint frames.
- Packet counter drift between logical topology blocks sharing one physical USB output.
- Whether live PAN/TILT frames are being superseded or dropped while a previous multi-packet frame is still awaiting ACK.
- Whether multiple browser tabs with old bundles are still able to send Web MIDI SysEx despite the current tab lock.
- Whether the original Roliblocks `computeDataChangeListMessage` still differs from the ArtBastard port in packet splitting or skip offsets.
- Whether solid full-frame paint test works because it compresses/diffs differently than varied frame content.

### Suggested next debugging pass

1. Test with only one ArtBastard tab open and hard-refresh it.
2. Use one single USB ROLI block first, not joined blocks.
3. Compare debug paint test versus PAN/TILT paint for the same `deviceId`:
   - number of SysEx packets sent
   - payload byte lengths
   - packet counters
   - ACK counters received
   - whether every packet receives an ACK before the next frame starts
4. Add a temporary ROLI debug panel action: `Paint PAN/TILT diagnostic on primary`, using the exact same PAN/TILT frame builder and exact `deviceId`, but triggered manually like the red paint test.
5. If debug red works but PAN/TILT diagnostic does not, inspect `buildDataChangeMessages` and the generated payloads against the original Roliblocks playground.
6. If manual PAN/TILT diagnostic works but live touch does not, throttle live repaint harder or replace live drawing with a low-rate heartbeat plus touch-position cache.
