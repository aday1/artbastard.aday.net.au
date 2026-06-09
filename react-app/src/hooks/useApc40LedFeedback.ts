import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { apc40DeckSceneName } from '../midi/apc40WorkflowHelpers';
import { debugLog } from '../utils/debugLog';

// APC40 MK1 LED velocity values for clip/scene launch pads:
//   0 = off, 1 = green, 2 = green blink, 3 = red, 4 = red blink,
//   5 = orange, 6 = orange blink.
const LED_OFF = 0;
const LED_GREEN = 1;
const LED_GREEN_BLINK = 2;
const LED_RED = 3;
const LED_RED_BLINK = 4;
const LED_ORANGE = 5;
const LED_ORANGE_BLINK = 6;

const SCENE_NOTES = [0x52, 0x53, 0x54, 0x55, 0x56];
const RECORD_ARM_NOTE = 0x30;
const SOLO_NOTE = 0x31;
const ACTIVATOR_NOTE = 0x32;
const TRACK_SELECT_NOTE = 0x33;
const TRACK_STOP_NOTE = 0x34;
const STOP_ALL_CLIPS_NOTE = 0x51;
const SHIFT_NOTE = 0x62;
const REC_NOTE = 0x5d;
const STOP_NOTE = 0x5c;
const CLIP_ROW_BASE = 0x35;
const MASTER_CHANNEL = 8;

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

function groupSelected(groupFixtureIds: string[], selectedIds: Set<string>): boolean {
  return groupFixtureIds.length > 0 && groupFixtureIds.every((fixtureId) => selectedIds.has(fixtureId));
}

/**
 * Pushes deck/session LEDs to every connected APC40 OUT port.
 *
 * Surface contract:
 *   - Clip grid: Deck A by default, Deck B while SHIFT is held. Green = saved,
 *     orange-blink = active deck slot, green-blink = record-armed column.
 *   - Scene Launch 1-5: ACT 1-5. Green = saved act, orange-blink = current act.
 *   - Record Arm 1-8: red when that grid column is armed for save.
 *   - Activator 1-8: green = group exists, orange-blink = APC40 auto running.
 *   - Track Select 1-8: green when that group/fixture is selected.
 *   - Master Track Select: red while FULL ON is latched.
 */
export function useApc40LedFeedback() {
  const scenes = useStore(s => s.scenes);
  const fixtures = useStore(s => s.fixtures);
  const groups = useStore(s => s.groups);
  const selectedFixtures = useStore(s => s.selectedFixtures);
  const acts = useStore(s => s.acts);
  const currentActId = useStore(s => s.actPlaybackState.currentActId);
  const crossfaderState = useStore(s => s.apc40CrossfaderState);

  const outputsRef = useRef<WebMidi.MIDIOutput[]>([]);
  const accessRef = useRef<WebMidi.MIDIAccess | null>(null);

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
    } = state;
    const currentActId = actPlaybackState.currentActId;
    const crossfaderState = apc40CrossfaderState;
    const deck = crossfaderState.activeDeck;
    const armedColumns = new Set(crossfaderState.armedColumns);
    const autoGroups = new Set(crossfaderState.autoGroups);
    const selectedIds = new Set(selectedFixtures);
    const activeDeckName = deck === 'A'
      ? crossfaderState.sceneAName
      : crossfaderState.sceneBName;

    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const index = row * 8 + column;
        const name = apc40DeckSceneName(deck, index);
        const saved = scenes.some((scene) => scene.name === name);
        let velocity = saved ? LED_GREEN : LED_OFF;
        if (name === activeDeckName) velocity = LED_ORANGE_BLINK;
        if (armedColumns.has(column)) velocity = saved ? LED_RED_BLINK : LED_GREEN_BLINK;
        sendNoteOn(out, column, CLIP_ROW_BASE + row, velocity);
      }
    }

    SCENE_NOTES.forEach((note, index) => {
      const act = acts[index];
      let velocity = act ? LED_GREEN : LED_OFF;
      if (act && act.id === currentActId) velocity = LED_ORANGE_BLINK;
      sendNoteOn(out, 0, note, velocity);
    });

    for (let column = 0; column < 8; column += 1) {
      const group = groups[column];
      const fixture = fixtures[column];
      const groupFixtureIds = group
        ? group.fixtureIndices.map((fixtureIndex) => fixtures[fixtureIndex]?.id).filter((id): id is string => Boolean(id))
        : [];
      const selected = group
        ? groupSelected(groupFixtureIds, selectedIds)
        : Boolean(fixture && selectedIds.has(fixture.id));

      sendNoteOn(out, column, RECORD_ARM_NOTE, armedColumns.has(column) ? LED_RED : LED_OFF);
      sendNoteOn(out, column, TRACK_SELECT_NOTE, selected ? LED_GREEN : LED_OFF);
      sendNoteOn(out, column, ACTIVATOR_NOTE, autoGroups.has(column) ? LED_ORANGE_BLINK : (group ? LED_GREEN : LED_OFF));
      sendNoteOn(out, column, SOLO_NOTE, LED_OFF);
      sendNoteOn(out, column, TRACK_STOP_NOTE, activeDeckName ? LED_RED : LED_OFF);
    }

    sendNoteOn(out, MASTER_CHANNEL, TRACK_SELECT_NOTE, crossfaderState.fullOn ? LED_RED : LED_OFF);
    sendNoteOn(out, 0, STOP_ALL_CLIPS_NOTE, (crossfaderState.sceneAName || crossfaderState.sceneBName || currentActId) ? LED_RED : LED_OFF);
    sendNoteOn(out, 0, SHIFT_NOTE, crossfaderState.shiftLatched ? LED_ORANGE : LED_OFF);
    sendNoteOn(out, 0, REC_NOTE, armedColumns.size > 0 ? LED_RED : LED_OFF);
    sendNoteOn(out, 0, STOP_NOTE, currentActId ? LED_ORANGE : LED_OFF);
  };

  const paintAll = () => {
    outputsRef.current.forEach(paintOutput);
  };

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        if (!navigator.requestMIDIAccess) return;
        const access = await navigator.requestMIDIAccess({ sysex: false });
        if (cancelled) return;
        accessRef.current = access;
        const refresh = () => {
          outputsRef.current = Array.from(access.outputs.values()).filter(isApc40Port);
          if (outputsRef.current.length > 0) {
            debugLog.log('[APC40-LED] outputs:', outputsRef.current.map(o => o.name));
            paintAll();
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
      outputsRef.current.forEach(out => {
        for (let row = 0; row < 5; row += 1) {
          for (let column = 0; column < 8; column += 1) {
            sendNoteOn(out, column, CLIP_ROW_BASE + row, LED_OFF);
          }
        }
        SCENE_NOTES.forEach(note => sendNoteOn(out, 0, note, LED_OFF));
        for (let column = 0; column < 8; column += 1) {
          sendNoteOn(out, column, RECORD_ARM_NOTE, LED_OFF);
          sendNoteOn(out, column, SOLO_NOTE, LED_OFF);
          sendNoteOn(out, column, ACTIVATOR_NOTE, LED_OFF);
          sendNoteOn(out, column, TRACK_SELECT_NOTE, LED_OFF);
          sendNoteOn(out, column, TRACK_STOP_NOTE, LED_OFF);
        }
        sendNoteOn(out, MASTER_CHANNEL, TRACK_SELECT_NOTE, LED_OFF);
        sendNoteOn(out, 0, STOP_ALL_CLIPS_NOTE, LED_OFF);
        sendNoteOn(out, 0, SHIFT_NOTE, LED_OFF);
        sendNoteOn(out, 0, REC_NOTE, LED_OFF);
        sendNoteOn(out, 0, STOP_NOTE, LED_OFF);
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    paintAll();
  }, [scenes, fixtures, groups, selectedFixtures, acts, currentActId, crossfaderState]); // eslint-disable-line react-hooks/exhaustive-deps
}
