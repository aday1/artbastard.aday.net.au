import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import { decodeApc40Message } from '../../midi/apc40';
import {
  APC40_GRID_COLS,
  APC40_GRID_ROWS,
  clipSceneNameForCell,
} from '../../midi/apc40Bindings';
import { APC40_DEVICE_KNOB_ASSIGNMENTS, APC40_QUICK_MAP_BASE, stripDeviceKnobPrefix } from './apc40Metadata';
import { getTemplateById } from './midiControllerTemplates';
import styles from './Apc40SurfaceDiagram.module.scss';

type Mode = 'view' | 'scenes' | 'acts' | 'superControl' | 'fixtures';

interface Props {
  mode?: Mode;
  compact?: boolean;
  title?: string;
  showBothDecks?: boolean;
}

// Flash entry: which on-screen control to pulse, expires after 300ms.
type FlashKey =
  | `clip-${'A' | 'B'}-${number}-${number}`
  | `scene-${number}`
  | `track-select-${number}`
  | `record-arm-${number}`
  | `solo-${number}`
  | `activator-${number}`
  | `track-stop-${number}`
  | `fader-${number}`
  | `master-fader`
  | `crossfader`
  | `cue`
  | `device-knob-${number}`
  | `track-knob-${number}`
  | 'play'
  | 'stop'
  | 'record'
  | 'master-button'
  | 'stop-all'
  | 'shift'
  | 'nav-fixture-prev'
  | 'nav-fixture-next'
  | 'nav-scene-prev'
  | 'nav-scene-next'
  | 'select-all'
  | 'tap-tempo'
  | 'nudge-up'
  | 'nudge-down'
  | 'send-a'
  | 'send-b'
  | 'send-c'
  | 'freeze-dmx';

const describeFlashKey = (key: FlashKey): string => {
  if (key.startsWith('clip-')) {
    const [, deck, row, col] = key.split('-');
    return `Deck ${deck} clip R${Number(row) + 1} C${Number(col) + 1}`;
  }
  if (key.startsWith('scene-')) return `ACT launch ${Number(key.split('-')[1]) + 1}`;
  if (key.startsWith('track-select-')) return `Track Select ${Number(key.split('-')[2]) + 1}`;
  if (key.startsWith('record-arm-')) return `Solo Group ${Number(key.split('-')[2]) + 1}`;
  if (key.startsWith('solo-')) return `Solo/Cue ${Number(key.split('-')[1]) + 1}`;
  if (key.startsWith('activator-')) return `Activator ${Number(key.split('-')[1]) + 1}`;
  if (key.startsWith('track-stop-')) return `Track Stop ${Number(key.split('-')[2]) + 1}`;
  if (key.startsWith('fader-')) return `Fader ${Number(key.split('-')[1]) + 1}`;
  if (key.startsWith('device-knob-')) return `Device knob ${Number(key.split('-')[2]) + 1}`;
  if (key.startsWith('track-knob-')) return `Track knob ${Number(key.split('-')[2]) + 1}`;
  if (key === 'master-fader') return 'Master fader';
  if (key === 'crossfader') return 'Crossfader';
  if (key === 'cue') return 'Cue level';
  if (key === 'play') return 'Play';
  if (key === 'stop') return 'Stop';
  if (key === 'record') return 'Record';
  if (key === 'master-button') return 'Master button (Freeze DMX)';
  if (key === 'stop-all') return 'Stop all clips';
  if (key === 'shift') return 'SHIFT';
  if (key === 'nav-fixture-prev') return 'Fixture previous';
  if (key === 'nav-fixture-next') return 'Fixture next';
  if (key === 'nav-scene-prev') return 'Scene previous';
  if (key === 'nav-scene-next') return 'Scene next';
  if (key === 'select-all') return 'Select all';
  if (key === 'tap-tempo') return 'Tap Tempo';
  if (key === 'nudge-up') return 'Nudge+';
  if (key === 'nudge-down') return 'Nudge\u2212';
  if (key === 'send-a') return 'SEND A (Color auto)';
  if (key === 'send-b') return 'SEND B (Pan/Tilt auto)';
  if (key === 'send-c') return 'SEND C (Effects auto)';
  if (key === 'freeze-dmx') return 'FREEZE DMX';
  return key;
};

const shortLabel = (value: string, max = 28): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
};

export const Apc40SurfaceDiagram: React.FC<Props> = ({
  mode = 'view',
  compact = false,
  title,
  showBothDecks = false,
}) => {
  const scenes = useStore((s) => s.scenes);
  const activeSceneName = useStore((s) => s.activeSceneName);
  const loadScene = useStore((s) => s.loadScene);
  const acts = useStore((s) => s.acts);
  const currentActId = useStore((s) => s.actPlaybackState.currentActId);
  const playAct = useStore((s) => s.playAct);
  const groups = useStore((s) => s.groups);
  const selectedFixtures = useStore((s) => s.selectedFixtures);
  const selectFixtureGroup = useStore((s) => s.selectFixtureGroup);
  const apc40State = useStore((s) => s.apc40CrossfaderState);
  const superControlBindings = useStore((s) => s.superControlMidiMappings);
  const latestMidi = useStore((s) => s.midiMessages[s.midiMessages.length - 1]);
  const template = useMemo(() => getTemplateById('apc40_mk1'), []);
  const hasLiveSuperControlMappings = (superControlBindings?.length ?? 0) > 0;
  const effectiveSuperControlBindings = hasLiveSuperControlMappings
    ? superControlBindings
    : (template?.superControlMappings ?? []);

  const activeDeck = apc40State?.activeDeck === 'B' ? 'B' : 'A';
  const decksToRender = showBothDecks ? (['A', 'B'] as const) : ([activeDeck] as const);
  const armedColumnSet = useMemo(() => new Set(apc40State?.armedColumns ?? []), [apc40State?.armedColumns]);
  const soloedGroupSet = useMemo(() => new Set(apc40State?.soloedGroups ?? []), [apc40State?.soloedGroups]);
  const saveMode = apc40State?.mode === 'save' && armedColumnSet.size > 0;
  const armedColumnLabel = Array.from(armedColumnSet)
    .sort((a, b) => a - b)
    .map((column) => column + 1)
    .join(', ');

  // Inverse lookup: which group (if any) is currently selected? A group is
  // "selected" when selectedFixtures matches the group's fixture set exactly.
  const selectedGroupIdx = useMemo(() => {
    if (selectedFixtures.length === 0) return -1;
    const sel = new Set(selectedFixtures);
    return groups.findIndex((group) => {
      const ids = group.fixtureIndices
        .map((i) => useStore.getState().fixtures[i]?.id)
        .filter((id): id is string => Boolean(id));
      if (ids.length !== sel.size) return false;
      return ids.every((id) => sel.has(id));
    });
  }, [selectedFixtures, groups]);

  // Faders bound via superControlMidiMappings: track-fader binding has
  // controller=7 + channel=col → that fader drives a SuperControl slot.
  const faderBindings = useMemo(() => {
    const map = new Map<number, string>();
    for (const b of effectiveSuperControlBindings ?? []) {
      if (b.controller === 7 && typeof b.channel === 'number') {
        const label = b.label ?? `${b.controlName}${b.slotIndex !== undefined ? ` #${b.slotIndex + 1}` : ''}`;
        map.set(b.channel, label);
      }
    }
    return map;
  }, [effectiveSuperControlBindings]);

  const masterFaderBinding = useMemo(() => {
    return (effectiveSuperControlBindings ?? []).find(
      (b) => b.controller === 14 && b.channel === 0
    );
  }, [effectiveSuperControlBindings]);

  const deviceKnobBindings = useMemo(() => {
    const map = new Map<number, string>();
    for (const b of effectiveSuperControlBindings ?? []) {
      if (b.controller !== undefined && b.controller >= 0x10 && b.controller <= 0x17 && b.channel === 0) {
        const slot = b.controller - 0x10;
        map.set(slot, stripDeviceKnobPrefix(b.label) ?? b.controlName);
      }
    }
    return map;
  }, [effectiveSuperControlBindings]);

  const deviceKnobFallbackBySlot = useMemo(() => {
    const map = new Map<number, string>();
    APC40_DEVICE_KNOB_ASSIGNMENTS.forEach(({ slot, roleLabel }) => map.set(slot, roleLabel));
    return map;
  }, []);

  const deckSlotStats = useMemo(() => {
    const countForDeck = (deck: 'A' | 'B') => {
      let assigned = 0;
      for (let row = 0; row < APC40_GRID_ROWS; row++) {
        for (let col = 0; col < APC40_GRID_COLS; col++) {
          const name = clipSceneNameForCell(deck, row, col);
          if (scenes.some((scene) => scene.name === name)) assigned += 1;
        }
      }
      return assigned;
    };
    return {
      A: countForDeck('A'),
      B: countForDeck('B'),
      total: APC40_GRID_ROWS * APC40_GRID_COLS,
    };
  }, [scenes]);

  const mappingSummary = useMemo(() => {
    const device = Array.from({ length: 8 }, (_, idx) => ({
      control: `Device ${idx + 1}`,
      action: deviceKnobBindings.get(idx)
        ?? `${deviceKnobFallbackBySlot.get(idx) ?? 'Unassigned'}${hasLiveSuperControlMappings ? '' : ' (default)'}`,
      assigned: deviceKnobBindings.has(idx) || deviceKnobFallbackBySlot.has(idx),
    }));

    const faders = Array.from({ length: 8 }, (_, idx) => ({
      control: `Fader ${idx + 1}`,
      action: faderBindings.get(idx) ?? `Slot ${idx + 1} Dimmer${hasLiveSuperControlMappings ? '' : ' (default)'}`,
      assigned: true,
    }));

    const trackSelect = Array.from({ length: 8 }, (_, idx) => ({
      control: `Track Select ${idx + 1}`,
      action: 'Unmapped (hardware CC bleed)',
      assigned: false,
    }));

    const quick = [
      { control: 'Scene Launch 1-5', action: APC40_QUICK_MAP_BASE.sceneLaunch, assigned: acts.length > 0 },
      { control: 'Clip Grid', action: APC40_QUICK_MAP_BASE.clipGrid, assigned: deckSlotStats.A + deckSlotStats.B > 0 },
      { control: 'Crossfader', action: APC40_QUICK_MAP_BASE.crossfader, assigned: true },
      { control: 'Master Fader', action: masterFaderBinding?.label ?? `Master Dimmer${hasLiveSuperControlMappings ? '' : ' (default)'}`, assigned: true },
      { control: 'Transport', action: APC40_QUICK_MAP_BASE.transport, assigned: true },
    ];

    return { device, faders, trackSelect, quick };
  }, [deviceKnobBindings, deviceKnobFallbackBySlot, faderBindings, groups, acts.length, deckSlotStats.A, deckSlotStats.B, masterFaderBinding, hasLiveSuperControlMappings]);

  // Live flash on incoming MIDI: track which on-screen key is flashing.
  const [flashing, setFlashing] = useState<Record<string, number>>({});
  const [lastTouched, setLastTouched] = useState<{ key: FlashKey; at: number } | null>(null);
  const [lastActName, setLastActName] = useState<string | null>(null);
  const flashTimers = useRef<Record<string, number>>({});
  const flash = useCallback((key: FlashKey) => {
    setLastTouched({ key, at: Date.now() });
    setFlashing((prev) => ({ ...prev, [key]: Date.now() }));
    if (flashTimers.current[key]) window.clearTimeout(flashTimers.current[key]);
    flashTimers.current[key] = window.setTimeout(() => {
      setFlashing((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 300);
  }, []);

  const currentActName = useMemo(() => {
    if (!currentActId) return null;
    return acts.find((act) => act.id === currentActId)?.name ?? null;
  }, [acts, currentActId]);

  useEffect(() => {
    if (currentActName) setLastActName(currentActName);
  }, [currentActName]);

  useEffect(() => {
    if (!latestMidi) return;
    const action = decodeApc40Message(latestMidi);
    if (!action) return;
    switch (action.type) {
      case 'clip-launch':
        flash(`clip-${activeDeck}-${action.row}-${action.column}`);
        break;
      case 'scene-launch':
        flash(`scene-${action.sceneIndex}`);
        break;
      case 'track-select':
        flash(`track-select-${action.trackIndex}`);
        break;
      case 'select-fixture':
        flash(`solo-${action.trackIndex}`);
        break;
      case 'solo-group':
        flash(`record-arm-${action.trackIndex}`);
        break;
      case 'solo-cue':
        flash(`solo-${action.trackIndex}`);
        break;
      case 'activator':
        flash(`activator-${action.trackIndex}`);
        break;
      case 'select-group':
        flash(`activator-${action.trackIndex}`);
        break;
      case 'track-stop':
        flash(`track-stop-${action.trackIndex}`);
        break;
      case 'channel-fader':
        flash(`fader-${action.trackIndex}`);
        break;
      case 'master-fader':
        flash('master-fader');
        break;
      case 'crossfader':
        flash('crossfader');
        break;
      case 'cue-level':
        flash('cue');
        break;
      case 'device-control':
        flash(`device-knob-${action.slotIndex}`);
        break;
      case 'track-control':
        flash(`track-knob-${action.slotIndex}`);
        break;
      case 'play':
        flash('play');
        break;
      case 'stop':
        flash('stop');
        break;
      case 'record':
        flash('record');
        break;
      case 'master-button':
        flash('master-button');
        break;
      case 'freeze-dmx':
        flash('freeze-dmx');
        break;
      case 'tap-tempo':
        flash('tap-tempo');
        break;
      case 'nudge':
        flash(action.direction === 'up' ? 'nudge-up' : 'nudge-down');
        break;
      case 'toggle-color-auto':
        flash('send-a');
        break;
      case 'toggle-pan-tilt-auto':
        flash('send-b');
        break;
      case 'toggle-effect-auto':
        flash('send-c');
        break;
      case 'stop-all-clips':
        flash('stop-all');
        break;
      case 'shift':
        flash('shift');
        break;
      case 'nav-fixture':
        flash(action.direction === 'next' ? 'nav-fixture-next' : 'nav-fixture-prev');
        break;
      case 'nav-scene':
        flash(action.direction === 'next' ? 'nav-scene-next' : 'nav-scene-prev');
        break;
      case 'select-all':
        flash('select-all');
        break;
    }
  }, [activeDeck, latestMidi, flash]);

  const onClipClick = (deck: 'A' | 'B', row: number, col: number) => {
    if (mode !== 'scenes' && mode !== 'view') return;
    flash(`clip-${deck}-${row}-${col}`);
    const name = clipSceneNameForCell(deck, row, col);
    const scene = scenes.find((s) => s.name === name);
    if (scene) loadScene(scene.name);
  };

  const onSceneLaunchClick = (idx: number) => {
    if (mode !== 'acts' && mode !== 'view') return;
    flash(`scene-${idx}`);
    const act = acts[idx];
    if (act) playAct(act.id);
  };

  const onTrackSelectClick = (col: number) => {
    if (mode !== 'fixtures' && mode !== 'view') return;
    flash(`track-select-${col}`);
    const group = groups[col];
    if (group) selectFixtureGroup(group.id);
  };

  return (
    <div
      className={`${styles.surface} ${compact ? styles.compact : ''} ${saveMode ? styles.saveMode : ''} ${styles[`mode_${mode}`] ?? ''}`}
      aria-label={title ?? 'APC40 surface diagram'}
    >
      <div className={styles.title}>
        <strong>APC40</strong>
        <span>
          {title ?? `mode: ${mode}`} · deck {activeDeck}
          {saveMode ? ' · SAVE MODE' : ''}
          {apc40State?.shiftLatched ? ' · SHIFT' : ''}
        </span>
      </div>

      {saveMode && (
        <div className={styles.saveModeBanner} role="status" aria-live="polite">
          <strong>SAVE MODE · Deck {activeDeck}</strong>
          <span>
            Armed column{armedColumnSet.size === 1 ? '' : 's'} {armedColumnLabel}. Press a flashing red clip pad in
            an armed column to save the current DMX look; saved pads will be overwritten.
          </span>
        </div>
      )}

      <div className={styles.statusStrip}>
        <span className={`${styles.statusPill} ${saveMode ? styles.statusSaveMode : ''}`}>
          Operation: <b>{saveMode ? `SAVE TO CLIP · columns ${armedColumnLabel}` : 'launch/control'}</b>
        </span>
        <span className={`${styles.statusPill} ${styles.statusLive}`}>
          Deck A active: <b>{apc40State?.sceneAName ?? 'none'}</b>
        </span>
        <span className={`${styles.statusPill} ${styles.statusLive}`}>
          Deck B active: <b>{apc40State?.sceneBName ?? 'none'}</b>
        </span>
        <span className={`${styles.statusPill} ${styles.statusLive}`}>
          ACT running: <b>{currentActName ?? 'none'}</b>
        </span>
        <span className={styles.statusPill}>
          Last ACT: <b>{lastActName ?? 'none'}</b>
        </span>
        <span className={`${styles.statusPill} ${styles.statusTouched}`}>
          Last touched: <b>{lastTouched ? describeFlashKey(lastTouched.key) : 'none'}</b>
        </span>
        <span
          className={`${styles.statusPill} ${styles.statusChanged}`}
          title={apc40State?.lastChange?.detail ?? apc40State?.lastChange?.summary ?? 'No APC40 change yet'}
        >
          Last changed: <b>{apc40State?.lastChange?.summary ?? 'none'}</b>
        </span>
      </div>

      <div className={styles.assignmentBoard} aria-label="APC40 control map">
        <div className={styles.assignmentTitle}>What Each Control Does</div>
        <div className={styles.assignmentDeckStats}>
          <span>Deck A slots: <b>{deckSlotStats.A}</b>/{deckSlotStats.total} assigned</span>
          <span>Deck B slots: <b>{deckSlotStats.B}</b>/{deckSlotStats.total} assigned</span>
        </div>
        <div className={styles.assignmentGrid}>
          <div className={styles.assignmentCard}>
            <h4>Device Knobs (CC16-23)</h4>
            {mappingSummary.device.map((item) => (
              <div key={item.control} className={styles.assignmentRow}>
                <span>{item.control}</span>
                <span className={item.assigned ? styles.assignmentAssigned : styles.assignmentUnassigned}>
                  {shortLabel(item.action)}
                </span>
              </div>
            ))}
          </div>
          <div className={styles.assignmentCard}>
            <h4>Track Faders + Master</h4>
            {mappingSummary.faders.map((item) => (
              <div key={item.control} className={styles.assignmentRow}>
                <span>{item.control}</span>
                <span className={item.assigned ? styles.assignmentAssigned : styles.assignmentUnassigned}>
                  {shortLabel(item.action)}
                </span>
              </div>
            ))}
            <div className={styles.assignmentRow}>
              <span>Master</span>
              <span className={masterFaderBinding ? styles.assignmentAssigned : styles.assignmentUnassigned}>
                {shortLabel(masterFaderBinding?.label ?? 'Unassigned')}
              </span>
            </div>
          </div>
          <div className={styles.assignmentCard}>
            <h4>Track Select Buttons</h4>
            {mappingSummary.trackSelect.map((item) => (
              <div key={item.control} className={styles.assignmentRow}>
                <span>{item.control}</span>
                <span className={item.assigned ? styles.assignmentAssigned : styles.assignmentUnassigned}>
                  {shortLabel(item.action)}
                </span>
              </div>
            ))}
          </div>
          <div className={styles.assignmentCard}>
            <h4>Quick Map</h4>
            {mappingSummary.quick.map((item) => (
              <div key={item.control} className={styles.assignmentRow}>
                <span>{item.control}</span>
                <span className={item.assigned ? styles.assignmentAssigned : styles.assignmentUnassigned}>
                  {shortLabel(item.action)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.body}>
        {/* Knob row */}
        <div className={styles.knobRow}>
          <div className={styles.knobCluster}>
            <span className={styles.clusterLabel}>DEVICE</span>
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={`dk${i}`}
                className={`${styles.knob} ${flashing[`device-knob-${i}`] ? styles.flash : ''}`}
                title={deviceKnobBindings.get(i) ?? `Device Knob ${i + 1} · ${deviceKnobFallbackBySlot.get(i) ?? `CC${0x10 + i} ch0`}`}
              >
                <span className={styles.knobDot} />
                <span className={styles.knobLabel}>{deviceKnobBindings.get(i) ?? shortLabel(deviceKnobFallbackBySlot.get(i) ?? `D${i + 1}`, 10)}</span>
              </div>
            ))}
          </div>
          <div className={styles.knobCluster}>
            <span className={styles.clusterLabel}>TRACK</span>
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={`tk${i}`}
                className={`${styles.knob} ${flashing[`track-knob-${i}`] ? styles.flash : ''}`}
                title={`Track Knob ${i + 1} · CC${0x30 + i} ch0`}
              >
                <span className={styles.knobDot} />
                <span className={styles.knobLabel}>T{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Clip grid + scene launch column */}
        <div className={styles.gridSection}>
          <div className={styles.deckGrids}>
            {decksToRender.map((deck) => (
              <div key={`deck-${deck}`} className={`${styles.deckGrid} ${deck === activeDeck ? styles.deckFocused : ''}`}>
                <span className={styles.deckLabel}>DECK {deck}</span>
                <div className={styles.clipGrid}>
                  {Array.from({ length: APC40_GRID_ROWS }, (_, row) => (
                    <div key={`row${deck}-${row}`} className={styles.gridRow}>
                      {Array.from({ length: APC40_GRID_COLS }, (_, col) => {
                        const name = clipSceneNameForCell(deck, row, col);
                        const scene = scenes.find((s) => s.name === name);
                        const isDeckActive = deck === 'A' ? apc40State?.sceneAName === name : apc40State?.sceneBName === name;
                        const isActive = isDeckActive || activeSceneName === name;
                        const flashKey = `clip-${deck}-${row}-${col}` as const;
                        const isFlashing = !!flashing[flashKey];
                        const isLastTouched = lastTouched?.key === flashKey;
                        const isSaveTarget = saveMode && deck === activeDeck && armedColumnSet.has(col);
                        const isSaveReady = isSaveTarget && !scene;
                        const isSaveOverwrite = isSaveTarget && Boolean(scene);
                        const clipLabel = isSaveReady
                          ? 'SAVE'
                          : isSaveOverwrite
                            ? 'OVERWRITE'
                            : scene
                              ? scene.name.replace(/^APC40 Deck [AB] /, '')
                              : 'EMPTY';
                        return (
                          <button
                            key={`c${deck}-${row}-${col}`}
                            type="button"
                            className={`${styles.clipCell} ${scene ? styles.bound : styles.unbound} ${isActive ? styles.active : ''} ${isSaveReady ? styles.saveReady : ''} ${isSaveOverwrite ? styles.saveOverwrite : ''} ${isFlashing ? styles.flash : ''} ${isLastTouched ? styles.lastTouched : ''}`}
                            onClick={() => onClipClick(deck, row, col)}
                            title={
                              isSaveReady
                                ? `SAVE MODE: press to save current DMX into spare clip ${name}`
                                : isSaveOverwrite
                                  ? `SAVE MODE: press to overwrite ${scene?.name}`
                                  : scene
                                    ? `${scene.name} → ${scene.channelValues?.length ?? 0} ch`
                                    : `${name} (unassigned)`
                            }
                            disabled={mode !== 'scenes' && mode !== 'view'}
                          >
                            <span className={styles.cellLabel}>
                              {clipLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className={styles.sceneLaunchCol}>
            <span className={styles.colLabel}>SCENE LAUNCH</span>
            {Array.from({ length: 5 }, (_, idx) => {
              const act = acts[idx];
              const isActive = act && currentActId === act.id;
              const isFlashing = !!flashing[`scene-${idx}`];
              return (
                <button
                  key={`sl${idx}`}
                  type="button"
                  className={`${styles.sceneLaunchBtn} ${act ? styles.bound : styles.unbound} ${isActive ? styles.active : ''} ${isFlashing ? styles.flash : ''} ${lastTouched?.key === `scene-${idx}` ? styles.lastTouched : ''}`}
                  onClick={() => onSceneLaunchClick(idx)}
                  title={act ? `ACT ${idx + 1}: ${act.name}` : `ACT ${idx + 1} (unassigned)`}
                  disabled={mode !== 'acts' && mode !== 'view'}
                >
                  <span className={styles.cellLabel}>{act ? act.name : `ACT ${idx + 1} EMPTY`}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Track strip: ARM / SOLO / AUTO / SEL / STOP per column */}
        <div className={styles.trackStrip}>
          {(['ARM', 'SOLO', 'AUTO', 'SEL', 'STOP'] as const).map((rowName) => (
            <div key={rowName} className={styles.stripRow}>
              <span className={styles.rowLabel}>{rowName}</span>
              {Array.from({ length: 8 }, (_, col) => {
                const isSel = rowName === 'SEL';
                const isAutoArmed = rowName === 'AUTO' && apc40State?.autoGroups?.includes(col);
                const isArmed = rowName === 'ARM' && soloedGroupSet.has(col);
                const group = groups[col];
                const isApcTrackSelected = isSel && apc40State?.activeTrackIndex === col;
                const isGroupSelected = isSel && group && selectedGroupIdx === col;
                const flashKey =
                  rowName === 'ARM'
                    ? `record-arm-${col}`
                    : rowName === 'SOLO'
                      ? `solo-${col}`
                      : rowName === 'AUTO'
                        ? `activator-${col}`
                        : rowName === 'SEL'
                          ? `track-select-${col}`
                          : `track-stop-${col}`;
                const isFlashing = !!flashing[flashKey];
                const label = isSel ? (group?.name ?? `T${col + 1}`) : rowName.charAt(0);
                return (
                  <button
                    key={`${rowName}-${col}`}
                    type="button"
                    className={`${styles.stripBtn} ${styles[`row_${rowName}`]} ${isGroupSelected || isApcTrackSelected || isArmed || isAutoArmed ? styles.active : ''} ${isApcTrackSelected ? styles.apcSelected : ''} ${isArmed ? styles.saveArmed : ''} ${isFlashing ? styles.flash : ''} ${isSel && group ? styles.bound : styles.unbound} ${lastTouched?.key === flashKey ? styles.lastTouched : ''}`}
                    onClick={() => isSel && onTrackSelectClick(col)}
                    disabled={!isSel || (mode !== 'fixtures' && mode !== 'view')}
                    title={isSel ? (apc40State?.activeTargetLabel && apc40State.activeTrackIndex === col ? `APC selected: ${apc40State.activeTargetLabel}` : group ? `Select group "${group.name}"` : `Track Select ${col + 1}`) : rowName === 'ARM' ? `Solo Group ${col + 1}${groups[col] ? ` (${groups[col].name})` : ' (no group)'}` : `${rowName} col ${col + 1}`}
                  >
                    <span className={styles.cellLabel}>{label}</span>
                  </button>
                );
              })}
              <span className={styles.masterCell}>
                {rowName === 'SEL' ? 'MSTR' : rowName === 'ARM' ? 'M' : ''}
              </span>
            </div>
          ))}
        </div>

        {/* Faders row */}
        <div className={styles.faderRow}>
          {Array.from({ length: 8 }, (_, col) => (
            <div
              key={`f${col}`}
              className={`${styles.fader} ${faderBindings.get(col) ? styles.bound : styles.unbound} ${flashing[`fader-${col}`] ? styles.flash : ''} ${lastTouched?.key === `fader-${col}` ? styles.lastTouched : ''}`}
              title={faderBindings.get(col) ?? `Fader ${col + 1} · CC7 ch${col} (unassigned)`}
            >
              <span className={styles.faderTrack}>
                <span className={styles.faderCap} />
              </span>
              <span className={styles.faderLabel}>{faderBindings.get(col) ?? `T${col + 1}`}</span>
            </div>
          ))}
          <div
            className={`${styles.fader} ${styles.masterFader} ${masterFaderBinding ? styles.bound : styles.unbound} ${flashing['master-fader'] ? styles.flash : ''} ${lastTouched?.key === 'master-fader' ? styles.lastTouched : ''}`}
            title={masterFaderBinding?.label ?? 'Master · CC14 ch0 (unassigned)'}
          >
            <span className={styles.faderTrack}>
              <span className={styles.faderCap} />
            </span>
            <span className={styles.faderLabel}>MASTER</span>
          </div>
        </div>

        {/* Transport */}
        <div className={styles.transport}>
          <button type="button" className={`${styles.txBtn} ${flashing['shift'] ? styles.flash : ''} ${apc40State?.shiftLatched ? styles.active : ''} ${lastTouched?.key === 'shift' ? styles.lastTouched : ''}`} disabled title="SHIFT (note 0x62)">SHIFT</button>
          <button type="button" className={`${styles.txBtn} ${flashing['nav-scene-prev'] ? styles.flash : ''} ${lastTouched?.key === 'nav-scene-prev' ? styles.lastTouched : ''}`} disabled title="← scene (0x60)">◀</button>
          <button type="button" className={`${styles.txBtn} ${flashing['nav-scene-next'] ? styles.flash : ''} ${lastTouched?.key === 'nav-scene-next' ? styles.lastTouched : ''}`} disabled title="→ scene (0x61)">▶</button>
          <button type="button" className={`${styles.txBtn} ${flashing['nav-fixture-prev'] ? styles.flash : ''} ${lastTouched?.key === 'nav-fixture-prev' ? styles.lastTouched : ''}`} disabled title="↑ fixture (0x5E)">▲</button>
          <button type="button" className={`${styles.txBtn} ${flashing['nav-fixture-next'] ? styles.flash : ''} ${lastTouched?.key === 'nav-fixture-next' ? styles.lastTouched : ''}`} disabled title="↓ fixture (0x5F)">▼</button>
          <button type="button" className={`${styles.txBtn} ${styles.play} ${flashing['play'] ? styles.flash : ''} ${lastTouched?.key === 'play' ? styles.lastTouched : ''}`} disabled title="PLAY (0x5B)">▶</button>
          <button type="button" className={`${styles.txBtn} ${styles.stop} ${flashing['stop'] ? styles.flash : ''} ${lastTouched?.key === 'stop' ? styles.lastTouched : ''}`} disabled title="STOP (0x5C)">■</button>
          <button type="button" className={`${styles.txBtn} ${styles.record} ${saveMode ? styles.saveArmed : ''} ${flashing['record'] ? styles.flash : ''} ${lastTouched?.key === 'record' ? styles.lastTouched : ''}`} disabled title={saveMode ? `REC armed columns ${armedColumnLabel}` : 'REC (0x5D)'}>●</button>
          <button type="button" className={`${styles.txBtn} ${flashing['select-all'] ? styles.flash : ''} ${lastTouched?.key === 'select-all' ? styles.lastTouched : ''}`} disabled title="PAN / SEL-ALL (0x57)">PAN</button>
          <div className={`${styles.knob} ${flashing['cue'] ? styles.flash : ''} ${lastTouched?.key === 'cue' ? styles.lastTouched : ''}`} title="CUE (CC 0x2F ch0)">
            <span className={styles.knobDot} />
            <span className={styles.knobLabel}>CUE</span>
          </div>
          <div className={`${styles.crossfader} ${flashing['crossfader'] ? styles.flash : ''} ${lastTouched?.key === 'crossfader' ? styles.lastTouched : ''}`} title="Crossfader (CC 0x0F ch0)">
            <span className={styles.xfTrack}>
              <span className={styles.xfCap} />
            </span>
            <span className={styles.faderLabel}>X-FADE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Apc40SurfaceDiagram;

// Shared visibility flag for the surface diagram across pages. Default hidden;
// any page can toggle via the returned setter and other mounted consumers will
// re-render via the custom event.
const APC40_VISIBLE_KEY = 'artbastard.showApc40Diagram';
const APC40_VISIBLE_EVENT = 'artbastard:apc40-visible';

export function useApc40DiagramVisible(): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [visible, setVisible] = useState<boolean>(() => {
    try {
      return localStorage.getItem(APC40_VISIBLE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        setVisible(localStorage.getItem(APC40_VISIBLE_KEY) === '1');
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('storage', sync);
    window.addEventListener(APC40_VISIBLE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(APC40_VISIBLE_EVENT, sync);
    };
  }, []);

  const update = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setVisible((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: boolean) => boolean)(prev) : next;
      try {
        localStorage.setItem(APC40_VISIBLE_KEY, resolved ? '1' : '0');
        window.dispatchEvent(new Event(APC40_VISIBLE_EVENT));
      } catch {
        /* ignore */
      }
      return resolved;
    });
  }, []);

  return [visible, update];
}
