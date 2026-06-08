import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { debugLog } from '../utils/debugLog';

// APC40 MK1 LED velocity values for clip/scene launch pads:
//   0 = off, 1 = green, 2 = green blink, 3 = red, 4 = red blink,
//   5 = orange, 6 = orange blink.
// Track-row buttons (SEL / STOP / SOLO) are binary on the MK1: 0 or 1.
const LED_OFF = 0;
const LED_GREEN = 1;
const LED_RED = 3;
const LED_ORANGE = 5;
const LED_ORANGE_BLINK = 6;

// Scene launch buttons (rightmost vertical column on APC40)
const SCENE_NOTES = [0x52, 0x53, 0x54, 0x55, 0x56];
// Track Select buttons (one per channel 0..7, note 0x33)
const TRACK_SELECT_NOTE = 0x33;
// Clip grid root note (per row 0..4, channel = column 0..7)
const CLIP_ROW_BASE = 0x35;

const APC40_NAME_RE = /\b(apc\s?40|apc40)\b/i;

function isApc40Port(port: WebMidi.MIDIPort): boolean {
  return APC40_NAME_RE.test(port.name || '') || APC40_NAME_RE.test(port.manufacturer || '');
}

function sendNoteOn(out: WebMidi.MIDIOutput, channel: number, note: number, velocity: number) {
  try {
    out.send([0x90 | (channel & 0x0f), note & 0x7f, velocity & 0x7f]);
  } catch (err) {
    debugLog.log('[APC40-LED] send failed:', err);
  }
}

/**
 * Pushes LED state to any connected APC40 OUT ports. Mounted once at app top
 * level so the device's surface visibly reflects scene/fixture state.
 *
 * Wiring:
 *   - Scene 1–5 pads: green = saved, orange (blink) = active, off = empty.
 *   - Track Select 1–8: green when the matching slot is selected, off otherwise.
 *   - Clip grid row 0 (notes 0x35): red on fixture index that's currently selected,
 *     green if a fixture exists at that slot, off if the slot is empty.
 *   - Other rows are left dark for now — adding 8×4 status would compete with
 *     the user's per-clip semantics down the line.
 */
export function useApc40LedFeedback() {
  const scenes = useStore(s => s.scenes);
  const activeSceneName = useStore(s => s.activeSceneName);
  const fixtures = useStore(s => s.fixtures);
  const selectedFixtures = useStore(s => s.selectedFixtures);

  const outputsRef = useRef<WebMidi.MIDIOutput[]>([]);
  const accessRef = useRef<WebMidi.MIDIAccess | null>(null);

  // Acquire MIDI access and watch for APC40 outputs.
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        if (!navigator.requestMIDIAccess) return;
        const access = await navigator.requestMIDIAccess({ sysex: false });
        if (cancelled) return;
        accessRef.current = access;
        const refresh = () => {
          const outs = Array.from(access.outputs.values()).filter(isApc40Port);
          outputsRef.current = outs;
          if (outs.length > 0) {
            debugLog.log('[APC40-LED] outputs:', outs.map(o => o.name));
          }
        };
        refresh();
        const prev = access.onstatechange;
        access.onstatechange = (e) => {
          refresh();
          if (typeof prev === 'function') prev.call(access, e);
        };
      } catch (err) {
        debugLog.log('[APC40-LED] MIDI access failed:', err);
      }
    };
    init();
    return () => {
      cancelled = true;
      // Blank the device on unmount.
      outputsRef.current.forEach(out => {
        SCENE_NOTES.forEach(n => sendNoteOn(out, 0, n, LED_OFF));
        for (let c = 0; c < 8; c++) sendNoteOn(out, c, TRACK_SELECT_NOTE, LED_OFF);
        for (let c = 0; c < 8; c++) sendNoteOn(out, c, CLIP_ROW_BASE, LED_OFF);
      });
    };
  }, []);

  // Push scene LEDs on scene/activeScene change.
  useEffect(() => {
    const outs = outputsRef.current;
    if (outs.length === 0) return;
    SCENE_NOTES.forEach((note, idx) => {
      const slot = scenes?.[idx];
      let vel: number = LED_OFF;
      if (slot) {
        vel = slot.name === activeSceneName ? LED_ORANGE_BLINK : LED_GREEN;
      }
      outs.forEach(out => sendNoteOn(out, 0, note, vel));
    });
  }, [scenes, activeSceneName]);

  // Push track-select LEDs on fixture selection change.
  useEffect(() => {
    const outs = outputsRef.current;
    if (outs.length === 0) return;
    const selectedIds = new Set(selectedFixtures);
    for (let col = 0; col < 8; col++) {
      const fixture = fixtures?.[col];
      const lit = fixture ? selectedIds.has(fixture.id) : false;
      outs.forEach(out => sendNoteOn(out, col, TRACK_SELECT_NOTE, lit ? LED_GREEN : LED_OFF));
    }
    // Clip grid row 0 mirrors the per-column fixture status.
    for (let col = 0; col < 8; col++) {
      const fixture = fixtures?.[col];
      let vel: number = LED_OFF;
      if (fixture) vel = selectedIds.has(fixture.id) ? LED_RED : LED_GREEN;
      outs.forEach(out => sendNoteOn(out, col, CLIP_ROW_BASE, vel));
    }
  }, [fixtures, selectedFixtures]);

  // When new outputs come online (e.g. user plugs in the APC40 after mount),
  // emit a one-shot refresh so the device immediately reflects current state.
  useEffect(() => {
    const access = accessRef.current;
    if (!access) return;
    const handler = () => {
      const outs = Array.from(access.outputs.values()).filter(isApc40Port);
      if (outs.length === 0) return;
      const selectedIds = new Set(selectedFixtures);
      SCENE_NOTES.forEach((note, idx) => {
        const slot = scenes?.[idx];
        const vel = slot
          ? (slot.name === activeSceneName ? LED_ORANGE_BLINK : LED_GREEN)
          : LED_OFF;
        outs.forEach(out => sendNoteOn(out, 0, note, vel));
      });
      for (let col = 0; col < 8; col++) {
        const fixture = fixtures?.[col];
        const lit = fixture ? selectedIds.has(fixture.id) : false;
        outs.forEach(out => sendNoteOn(out, col, TRACK_SELECT_NOTE, lit ? LED_GREEN : LED_OFF));
        const clipVel: number = fixture
          ? (selectedIds.has(fixture.id) ? LED_RED : LED_GREEN)
          : LED_OFF;
        outs.forEach(out => sendNoteOn(out, col, CLIP_ROW_BASE, clipVel));
      }
    };
    const prev = access.onstatechange;
    access.onstatechange = (e) => {
      handler();
      if (typeof prev === 'function') prev.call(access, e);
    };
    return () => { access.onstatechange = prev; };
  }, [scenes, activeSceneName, fixtures, selectedFixtures]);
}
