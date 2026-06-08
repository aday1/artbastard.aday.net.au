import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { debugLog } from '../utils/debugLog';

// APC40 MK1 LED velocity values for clip/scene launch pads:
//   0 = off, 1 = green, 2 = green blink, 3 = red, 4 = red blink,
//   5 = orange, 6 = orange blink.
// Track-row buttons (SEL / STOP / SOLO) are binary on the MK1: 0 or 1.
const LED_OFF = 0;
const LED_GREEN = 1;
const LED_GREEN_BLINK = 2;
const LED_RED = 3;
const LED_RED_BLINK = 4;
const LED_ORANGE = 5;
const LED_ORANGE_BLINK = 6;

// Scene launch buttons (rightmost vertical column on APC40)
const SCENE_NOTES = [0x52, 0x53, 0x54, 0x55, 0x56];
// Track Select buttons (one per channel 0..7, note 0x33)
const TRACK_SELECT_NOTE = 0x33;
// ACTIVATOR buttons (one per channel 0..7, note 0x32) — multi-select state
const ACTIVATOR_NOTE = 0x32;
// SOLO buttons (one per channel 0..7, note 0x31) — momentary, left dark
const SOLO_NOTE = 0x31;
// SHIFT button (note 0x62)
const SHIFT_NOTE = 0x62;
// Transport row — PLAY=pickA mode toggle, STOP=pickB mode toggle, REC=save mode toggle
const PLAY_NOTE = 0x5b;
const STOP_NOTE = 0x5c;
const REC_NOTE = 0x5d;
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

function sceneVelocity(
  slotName: string | undefined,
  activeSceneName: string | null,
  sceneAName: string | null,
  sceneBName: string | null
): number {
  if (!slotName) return LED_OFF;
  if (slotName === activeSceneName) return LED_RED_BLINK;
  if (slotName === sceneAName || slotName === sceneBName) return LED_ORANGE_BLINK;
  return LED_GREEN;
}

/**
 * Pushes LED state to any connected APC40 OUT ports. Mounted once at app top
 * level so the device's surface visibly reflects scene/fixture state.
 *
 * Wiring:
 *   - Scene 1–5 pads: green = saved, red-blink = active, orange-blink = bound to crossfader A/B.
 *     During SAVE / pickA / pickB mode all five blink green to mark armed tap targets.
 *   - Track Select 1–8: green when the matching slot is selected, off otherwise.
 *   - ACTIVATOR 1–8: red when selected, green when fixture exists, off if empty (multi-select state).
 *   - Clip grid row 0 (notes 0x35): mirrors per-column fixture status.
 *   - SHIFT: orange while latched (toggle that also cancels an active mode).
 *   - Transport row: REC lit = SAVE mode, PLAY lit = pick Scene A, STOP lit = pick Scene B.
 */
export function useApc40LedFeedback() {
  const scenes = useStore(s => s.scenes);
  const activeSceneName = useStore(s => s.activeSceneName);
  const fixtures = useStore(s => s.fixtures);
  const selectedFixtures = useStore(s => s.selectedFixtures);
  const crossfaderState = useStore(s => s.apc40CrossfaderState);
  const { sceneAName, sceneBName, shiftLatched, mode } = crossfaderState;

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
        for (let c = 0; c < 8; c++) sendNoteOn(out, c, ACTIVATOR_NOTE, LED_OFF);
        for (let c = 0; c < 8; c++) sendNoteOn(out, c, SOLO_NOTE, LED_OFF);
        for (let c = 0; c < 8; c++) sendNoteOn(out, c, CLIP_ROW_BASE, LED_OFF);
        sendNoteOn(out, 0, SHIFT_NOTE, LED_OFF);
        sendNoteOn(out, 0, PLAY_NOTE, LED_OFF);
        sendNoteOn(out, 0, STOP_NOTE, LED_OFF);
        sendNoteOn(out, 0, REC_NOTE, LED_OFF);
      });
    };
  }, []);

  // Push scene LEDs on scene/activeScene/A-B/mode change.
  // In any picker/save mode all scene pads green-blink so the user sees
  // every tap target is armed; transport LED below tells them which mode.
  useEffect(() => {
    const outs = outputsRef.current;
    if (outs.length === 0) return;
    SCENE_NOTES.forEach((note, idx) => {
      const slot = scenes?.[idx];
      let vel: number;
      if (mode) {
        vel = LED_GREEN_BLINK;
      } else {
        vel = sceneVelocity(slot?.name, activeSceneName, sceneAName, sceneBName);
      }
      outs.forEach(out => sendNoteOn(out, 0, note, vel));
    });
  }, [scenes, activeSceneName, sceneAName, sceneBName, mode]);

  // Push track-select + activator + clip row 0 LEDs on fixture selection change.
  useEffect(() => {
    const outs = outputsRef.current;
    if (outs.length === 0) return;
    const selectedIds = new Set(selectedFixtures);
    for (let col = 0; col < 8; col++) {
      const fixture = fixtures?.[col];
      const lit = fixture ? selectedIds.has(fixture.id) : false;
      outs.forEach(out => sendNoteOn(out, col, TRACK_SELECT_NOTE, lit ? LED_GREEN : LED_OFF));
      // ACTIVATOR row mirrors multi-selection: red = selected, green = available, off = empty.
      let activatorVel: number = LED_OFF;
      if (fixture) activatorVel = lit ? LED_RED : LED_GREEN;
      outs.forEach(out => sendNoteOn(out, col, ACTIVATOR_NOTE, activatorVel));
      // Clip grid row 0 mirrors the per-column fixture status.
      let clipVel: number = LED_OFF;
      if (fixture) clipVel = lit ? LED_RED : LED_GREEN;
      outs.forEach(out => sendNoteOn(out, col, CLIP_ROW_BASE, clipVel));
    }
  }, [fixtures, selectedFixtures]);

  // SHIFT LED tracks the latched state.
  useEffect(() => {
    const outs = outputsRef.current;
    if (outs.length === 0) return;
    outs.forEach(out => sendNoteOn(out, 0, SHIFT_NOTE, shiftLatched ? LED_ORANGE : LED_OFF));
  }, [shiftLatched]);

  // Transport LEDs (REC/PLAY/STOP) light up to disambiguate save vs pickA vs pickB mode.
  useEffect(() => {
    const outs = outputsRef.current;
    if (outs.length === 0) return;
    outs.forEach(out => {
      sendNoteOn(out, 0, REC_NOTE, mode === 'save' ? LED_RED : LED_OFF);
      sendNoteOn(out, 0, PLAY_NOTE, mode === 'pickA' ? LED_GREEN : LED_OFF);
      sendNoteOn(out, 0, STOP_NOTE, mode === 'pickB' ? LED_RED : LED_OFF);
    });
  }, [mode]);

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
        const vel = mode
          ? LED_GREEN_BLINK
          : sceneVelocity(slot?.name, activeSceneName, sceneAName, sceneBName);
        outs.forEach(out => sendNoteOn(out, 0, note, vel));
      });
      for (let col = 0; col < 8; col++) {
        const fixture = fixtures?.[col];
        const lit = fixture ? selectedIds.has(fixture.id) : false;
        outs.forEach(out => sendNoteOn(out, col, TRACK_SELECT_NOTE, lit ? LED_GREEN : LED_OFF));
        let activatorVel: number = LED_OFF;
        if (fixture) activatorVel = lit ? LED_RED : LED_GREEN;
        outs.forEach(out => sendNoteOn(out, col, ACTIVATOR_NOTE, activatorVel));
        const clipVel: number = fixture
          ? (lit ? LED_RED : LED_GREEN)
          : LED_OFF;
        outs.forEach(out => sendNoteOn(out, col, CLIP_ROW_BASE, clipVel));
      }
      outs.forEach(out => {
        sendNoteOn(out, 0, SHIFT_NOTE, shiftLatched ? LED_ORANGE : LED_OFF);
        sendNoteOn(out, 0, REC_NOTE, mode === 'save' ? LED_RED : LED_OFF);
        sendNoteOn(out, 0, PLAY_NOTE, mode === 'pickA' ? LED_GREEN : LED_OFF);
        sendNoteOn(out, 0, STOP_NOTE, mode === 'pickB' ? LED_RED : LED_OFF);
      });
    };
    const prev = access.onstatechange;
    access.onstatechange = (e) => {
      handler();
      if (typeof prev === 'function') prev.call(access, e);
    };
    return () => { access.onstatechange = prev; };
  }, [scenes, activeSceneName, fixtures, selectedFixtures, sceneAName, sceneBName, shiftLatched, mode]);
}
