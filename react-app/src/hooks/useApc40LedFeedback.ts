import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { apc40DeckSceneName } from '../midi/apc40WorkflowHelpers';
import { debugLog } from '../utils/debugLog';
import { resetPortHealth } from '../midi/midiOutputGuard';
import {
  isApc40Port,
  sendApc40ControlChange,
  sendApc40NoteOn,
  subscribeApc40LedDirty,
  notifyApc40LedDirty,
} from '../midi/apc40LedRuntime';
import {
  LED,
  BLINK_LED_VALUES,
  APC40_GRID,
  APC40_TRANSPORT_NOTES,
  LED_RING_CONFIG,
} from '../midi/generated';
import {
  APC40_TRACK_CONTROL_ROLES,
  readApc40RoleDmxValue,
  resolveApc40DeviceRoleSlots,
} from '../midi/apc40WorkflowHelpers';

// APC40 MK1 LED velocity values are sourced from DOCS/midi/led-feedback.md
// via the generated spec. Keep aliases for hot-path readability.
const LED_OFF = LED.LED_OFF;
const LED_GREEN = LED.LED_GREEN;
const LED_RED = LED.LED_RED;
const LED_RED_BLINK = LED.LED_RED_BLINK;
const LED_ORANGE = LED.LED_ORANGE;
const LED_ORANGE_BLINK = LED.LED_ORANGE_BLINK;

const SCENE_NOTES = [0x52, 0x53, 0x54, 0x55, 0x56];
const RECORD_ARM_NOTE = 0x30;
const SOLO_NOTE = 0x31;
const ACTIVATOR_NOTE = 0x32;
const TRACK_SELECT_NOTE = 0x33;
const TRACK_STOP_NOTE = 0x34;
const STOP_ALL_CLIPS_NOTE = APC40_TRANSPORT_NOTES.stopAll;
const SHIFT_NOTE = APC40_TRANSPORT_NOTES.shift;
const REC_NOTE = APC40_TRANSPORT_NOTES.record;
const PLAY_NOTE = APC40_TRANSPORT_NOTES.play;
const STOP_NOTE = APC40_TRANSPORT_NOTES.stop;
const SEND_A_NOTE = 0x58;
const SEND_B_NOTE = 0x59;
const SEND_C_NOTE = 0x5a;
const PAN_NOTE = 0x57;
const FULL_ON_NOTE = 0x3a;
const BLACKOUT_NOTE = 0x3b;
const DEVICE_LEFT_NOTE = 0x3c;
const DEVICE_RIGHT_NOTE = 0x3d;
const FREEZE_NOTE = 0x3e;
const CLIP_ROW_BASE = 0x35;
const MASTER_CHANNEL = 8;
const GRID_ROWS = APC40_GRID.rows;
const GRID_COLS = APC40_GRID.cols;
const DEVICE_BANK_FLASH_MS = 450;

function sendNoteOn(out: WebMidi.MIDIOutput, channel: number, note: number, velocity: number) {
  sendApc40NoteOn(out, channel, note, velocity, 'apc40-led');
}

function sendControlChange(out: WebMidi.MIDIOutput, channel: number, controller: number, value: number) {
  sendApc40ControlChange(out, channel, controller, value, 'apc40-ring-led');
}

function dmxToMidiRingValue(value: number): number {
  return Math.max(0, Math.min(127, Math.round((value / 255) * 127)));
}

function groupSelected(groupFixtureIds: string[], selectedIds: Set<string>): boolean {
  return groupFixtureIds.length > 0 && groupFixtureIds.every((fixtureId) => selectedIds.has(fixtureId));
}

/**
 * Pushes deck/session LEDs to every connected APC40 OUT port.
 *
 * Surface contract:
 *   - Clip grid: Deck A by default, Deck B while SHIFT is held. Green = saved,
 *     orange-blink = active deck slot, red-blink = REC save-mode target.
 *   - Scene Launch 1-5: ACT 1-5. Green = saved act, orange-blink = current act.
 *   - Record Arm 1-8: red-blink while its Solo Group latch is active.
 *   - Activator 1-8: green when that group is fully selected.
 *   - Track Select 1-8: intentionally off/unmapped.
 *   - Master Track Select: red while DMX FREEZE is latched.
 */
export function useApc40LedFeedback() {
  const scenes = useStore(s => s.scenes);
  const fixtures = useStore(s => s.fixtures);
  const groups = useStore(s => s.groups);
  const selectedFixtures = useStore(s => s.selectedFixtures);
  const acts = useStore(s => s.acts);
  const currentActId = useStore(s => s.actPlaybackState.currentActId);
  const crossfaderState = useStore(s => s.apc40CrossfaderState);
  const autoSceneEnabled = useStore(s => s.autoSceneEnabled);
  const autoSceneMode = useStore(s => s.autoSceneMode);
  const colorAutoEnabled = useStore(s => s.modularAutomation.color.enabled);
  const panTiltAutoEnabled = useStore(s => s.modularAutomation.panTilt.enabled);
  const effectsAutoEnabled = useStore(s => s.modularAutomation.effects.enabled);
  const dmxFrozen = useStore(s => s.dmxFrozen);

  const outputsRef = useRef<WebMidi.MIDIOutput[]>([]);
  const accessRef = useRef<WebMidi.MIDIAccess | null>(null);
  const lastLedValuesRef = useRef<WeakMap<WebMidi.MIDIOutput, Map<string, number>>>(new WeakMap());
  const bankFlashTimeoutRef = useRef<number | null>(null);

  const sendLed = (out: WebMidi.MIDIOutput, channel: number, note: number, velocity: number) => {
    let outputState = lastLedValuesRef.current.get(out);
    if (!outputState) {
      outputState = new Map();
      lastLedValuesRef.current.set(out, outputState);
    }

    const key = `note:${channel}:${note}`;
    const previousVelocity = outputState.get(key);

    // Critical: skip the resend when nothing changed. APC40 blink LEDs reset
    // their blink phase on every note-on, so repainting unchanged blinkers at
    // UI frame rate (e.g. while a fader moves) produces visible random flicker.
    if (previousVelocity === velocity) return;

    if (
      previousVelocity !== undefined &&
      BLINK_LED_VALUES.has(previousVelocity) &&
      !BLINK_LED_VALUES.has(velocity)
    ) {
      sendNoteOn(out, channel, note, LED_OFF);
    }

    sendNoteOn(out, channel, note, velocity);
    outputState.set(key, velocity);
  };

  const sendRing = (out: WebMidi.MIDIOutput, controller: number, value: number) => {
    let outputState = lastLedValuesRef.current.get(out);
    if (!outputState) {
      outputState = new Map();
      lastLedValuesRef.current.set(out, outputState);
    }

    const velocity = Math.max(0, Math.min(127, Math.round(value)));
    const key = `cc:${LED_RING_CONFIG.midiChannel}:${controller}`;
    if (outputState.get(key) === velocity) return;
    sendControlChange(out, LED_RING_CONFIG.midiChannel, controller, velocity);
    outputState.set(key, velocity);
  };

  const paintOutput = (out: WebMidi.MIDIOutput) => {
    const state = useStore.getState();
    const {
      scenes,
      fixtures,
      groups,
      selectedFixtures,
      acts,
      actPlaybackState,
      apc40CrossfaderState,
      autoSceneEnabled,
      modularAutomation,
      dmxFrozen,
      dmxChannels,
    } = state;
    const currentActId = actPlaybackState.currentActId;
    const crossfaderState = apc40CrossfaderState;
    const deck = crossfaderState.activeDeck;
    const armedColumns = new Set(crossfaderState.armedColumns);
    const soloedGroups = new Set(crossfaderState.soloedGroups);
    const selectedIds = new Set(selectedFixtures);
    const allFixturesSelected = fixtures.length > 0 && fixtures.every((fixture) => selectedIds.has(fixture.id));
    const deviceRoles = resolveApc40DeviceRoleSlots(fixtures, selectedFixtures, crossfaderState.deviceBankIndex ?? 0);
    const now = Date.now();
    const bankFlashActive = (crossfaderState.deviceBankFlashUntil ?? 0) > now
      ? crossfaderState.deviceBankFlashDirection
      : null;
    const activeDeckName = deck === 'A'
      ? crossfaderState.sceneAName
      : crossfaderState.sceneBName;

    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let column = 0; column < GRID_COLS; column += 1) {
        const index = row * GRID_COLS + column;
        const name = apc40DeckSceneName(deck, index);
        const saved = scenes.some((scene) => scene.name === name);
        // While SHIFT is held the grid previews Deck B — paint saved pads RED
        // (instead of GREEN) so the operator can tell at a glance they're
        // about to load from Deck B rather than the active Deck A.
        const savedColor = crossfaderState.shiftLatched ? LED_RED : LED_GREEN;
        let velocity: number = saved ? savedColor : LED_OFF;
        if (name === activeDeckName) velocity = LED_ORANGE_BLINK;
        if (armedColumns.has(column)) velocity = LED_RED_BLINK;
        sendLed(out, column, CLIP_ROW_BASE + row, velocity);
      }
    }

    SCENE_NOTES.forEach((note, index) => {
      const act = acts[index];
      let velocity: number = act ? LED_GREEN : LED_OFF;
      if (act && act.id === currentActId) velocity = LED_ORANGE_BLINK;
      sendLed(out, 0, note, velocity);
    });

    for (let column = 0; column < GRID_COLS; column += 1) {
      const group = groups[column];
      const fixture = fixtures[column];
      const groupFixtureIds = group
        ? group.fixtureIndices.map((fixtureIndex) => fixtures[fixtureIndex]?.id).filter((id): id is string => Boolean(id))
        : [];
      const fixtureSelected = Boolean(fixture && selectedIds.has(fixture.id));
      const groupAllSelected = group ? groupSelected(groupFixtureIds, selectedIds) : false;

      // APC40 MK1 single-color rows: any non-zero velocity = amber on, 0 = off.
      // Encode only selection state, not "exists vs absent", since the operator
      // can't distinguish multiple non-off colors on these pads.
      const soloed = soloedGroups.has(column);
      // Record Arm row = Solo Group latch. Save mode is shown on REC and clip-grid pads.
      sendLed(out, column, RECORD_ARM_NOTE, soloed ? LED_RED_BLINK : LED_OFF);
      // Solo/Cue row = toggle FIXTURE in multi-selection. On = selected.
      sendLed(out, column, SOLO_NOTE, fixtureSelected ? LED_GREEN : LED_OFF);
      // Activator row = toggle GROUP in multi-selection. On = all fixtures in group selected.
      sendLed(out, column, ACTIVATOR_NOTE, groupAllSelected ? LED_GREEN : LED_OFF);
      // Track Select row is intentionally unmapped on the input side; keep LED off.
      sendLed(out, column, TRACK_SELECT_NOTE, LED_OFF);
      sendLed(out, column, TRACK_STOP_NOTE, activeDeckName ? LED_RED : LED_OFF);
    }

    // Master Select mirrors DMX FREEZE state: red on = frozen, off = live output.
    sendLed(out, MASTER_CHANNEL, TRACK_SELECT_NOTE, dmxFrozen ? LED_RED : LED_OFF);
    sendLed(out, 0, STOP_ALL_CLIPS_NOTE, (crossfaderState.sceneAName || crossfaderState.sceneBName || currentActId) ? LED_RED : LED_OFF);
    sendLed(out, 0, SHIFT_NOTE, crossfaderState.shiftLatched ? LED_ORANGE : LED_OFF);
    sendLed(out, 0, REC_NOTE, armedColumns.size > 0 ? LED_RED_BLINK : LED_OFF);
    sendLed(out, 0, PAN_NOTE, allFixturesSelected ? LED_GREEN : LED_OFF);
    sendLed(out, 0, FULL_ON_NOTE, crossfaderState.fullOn ? LED_RED : LED_OFF);
    sendLed(out, 0, BLACKOUT_NOTE, crossfaderState.blackout ? LED_RED : LED_OFF);
    sendLed(out, 0, DEVICE_LEFT_NOTE, crossfaderState.deviceBankAtStart ? LED_RED : bankFlashActive === 'prev' ? LED_ORANGE : LED_OFF);
    sendLed(out, 0, DEVICE_RIGHT_NOTE, crossfaderState.deviceBankAtEnd ? LED_RED : bankFlashActive === 'next' ? LED_ORANGE : LED_OFF);
    sendLed(out, 0, FREEZE_NOTE, dmxFrozen ? LED_RED : LED_OFF);
    // PLAY = green-blink while Auto Scene is running, off otherwise.
    // STOP = red while Auto Scene is running (the button that will stop it), off otherwise.
    sendLed(out, 0, PLAY_NOTE, autoSceneEnabled ? LED.LED_GREEN_BLINK : LED_OFF);
    sendLed(out, 0, STOP_NOTE, autoSceneEnabled ? LED_RED : LED_OFF);
    // SEND row = modular automation engine toggles. Orange-blink while running.
    sendLed(out, 0, SEND_A_NOTE, modularAutomation.color.enabled ? LED_ORANGE_BLINK : LED_OFF);
    sendLed(out, 0, SEND_B_NOTE, modularAutomation.panTilt.enabled ? LED_ORANGE_BLINK : LED_OFF);
    sendLed(out, 0, SEND_C_NOTE, modularAutomation.effects.enabled ? LED_ORANGE_BLINK : LED_OFF);

    for (let slot = 0; slot < GRID_COLS; slot += 1) {
      const trackRole = APC40_TRACK_CONTROL_ROLES[slot];
      const trackValue = trackRole
        ? readApc40RoleDmxValue(fixtures, selectedFixtures, dmxChannels, trackRole)
        : null;
      const deviceRole = deviceRoles[slot];
      const deviceValue = deviceRole
        ? readApc40RoleDmxValue(fixtures, selectedFixtures, dmxChannels, deviceRole)
        : null;

      sendRing(out, LED_RING_CONFIG.trackRingBaseCc + slot, trackValue === null ? LED_OFF : dmxToMidiRingValue(trackValue));
      sendRing(out, LED_RING_CONFIG.deviceRingBaseCc + slot, deviceValue === null ? LED_OFF : dmxToMidiRingValue(deviceValue));
    }
  };

  const paintAll = () => {
    outputsRef.current.forEach(paintOutput);
  };

  useEffect(() => {
    return subscribeApc40LedDirty(() => {
      lastLedValuesRef.current = new WeakMap();
      paintAll();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        if (!navigator.requestMIDIAccess) return;
        const access = await navigator.requestMIDIAccess({ sysex: true });
        if (cancelled) return;
        accessRef.current = access;
        const refresh = () => {
          outputsRef.current = Array.from(access.outputs.values()).filter(isApc40Port);
          outputsRef.current.forEach(resetPortHealth);
          if (outputsRef.current.length > 0) {
            debugLog.log('[APC40-LED] outputs:', outputsRef.current.map(o => o.name));
            paintAll();
            notifyApc40LedDirty('port-refresh');
          }
        };
        refresh();
        const handleStateChange = () => {
          refresh();
        };
        access.addEventListener('statechange', handleStateChange);
        accessRef.current = access;
        return () => access.removeEventListener('statechange', handleStateChange);
      } catch (err) {
        debugLog.log('[APC40-LED] MIDI access failed:', err);
      }
    };
    let cleanup: (() => void) | null = null;
    void init().then((nextCleanup) => {
      cleanup = nextCleanup ?? null;
    });
    return () => {
      cancelled = true;
      cleanup?.();
      outputsRef.current.forEach(out => {
        for (let row = 0; row < GRID_ROWS; row += 1) {
          for (let column = 0; column < GRID_COLS; column += 1) {
            sendLed(out, column, CLIP_ROW_BASE + row, LED_OFF);
          }
        }
        SCENE_NOTES.forEach(note => sendLed(out, 0, note, LED_OFF));
        for (let column = 0; column < GRID_COLS; column += 1) {
          sendLed(out, column, RECORD_ARM_NOTE, LED_OFF);
          sendLed(out, column, SOLO_NOTE, LED_OFF);
          sendLed(out, column, ACTIVATOR_NOTE, LED_OFF);
          sendLed(out, column, TRACK_SELECT_NOTE, LED_OFF);
          sendLed(out, column, TRACK_STOP_NOTE, LED_OFF);
        }
        sendLed(out, MASTER_CHANNEL, TRACK_SELECT_NOTE, LED_OFF);
        sendLed(out, 0, STOP_ALL_CLIPS_NOTE, LED_OFF);
        sendLed(out, 0, SHIFT_NOTE, LED_OFF);
        sendLed(out, 0, REC_NOTE, LED_OFF);
        sendLed(out, 0, PLAY_NOTE, LED_OFF);
        sendLed(out, 0, STOP_NOTE, LED_OFF);
        sendLed(out, 0, SEND_A_NOTE, LED_OFF);
        sendLed(out, 0, SEND_B_NOTE, LED_OFF);
        sendLed(out, 0, SEND_C_NOTE, LED_OFF);
        sendLed(out, 0, PAN_NOTE, LED_OFF);
        sendLed(out, 0, FULL_ON_NOTE, LED_OFF);
        sendLed(out, 0, BLACKOUT_NOTE, LED_OFF);
        sendLed(out, 0, DEVICE_LEFT_NOTE, LED_OFF);
        sendLed(out, 0, DEVICE_RIGHT_NOTE, LED_OFF);
        sendLed(out, 0, FREEZE_NOTE, LED_OFF);
        for (let slot = 0; slot < GRID_COLS; slot += 1) {
          sendRing(out, LED_RING_CONFIG.trackRingBaseCc + slot, LED_OFF);
          sendRing(out, LED_RING_CONFIG.deviceRingBaseCc + slot, LED_OFF);
        }
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    paintAll();
    if (bankFlashTimeoutRef.current !== null) {
      window.clearTimeout(bankFlashTimeoutRef.current);
      bankFlashTimeoutRef.current = null;
    }
    const flashUntil = crossfaderState.deviceBankFlashUntil ?? 0;
    const remainingMs = flashUntil - Date.now();
    if (remainingMs > 0) {
      bankFlashTimeoutRef.current = window.setTimeout(() => {
        bankFlashTimeoutRef.current = null;
        paintAll();
      }, remainingMs + 20);
    }
    return () => {
      if (bankFlashTimeoutRef.current !== null) {
        window.clearTimeout(bankFlashTimeoutRef.current);
        bankFlashTimeoutRef.current = null;
      }
    };
  }, [scenes, fixtures, groups, selectedFixtures, acts, currentActId, crossfaderState, autoSceneEnabled, autoSceneMode, colorAutoEnabled, panTiltAutoEnabled, effectsAutoEnabled, dmxFrozen]); // eslint-disable-line react-hooks/exhaustive-deps
}
