import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import { decodeApc40Message } from '../../midi/apc40';
import {
  APC40_GRID_COLS,
  APC40_GRID_ROWS,
  clipSceneNameForCell,
} from '../../midi/apc40Bindings';
import styles from './Apc40SurfaceDiagram.module.scss';

type Mode = 'view' | 'scenes' | 'acts' | 'superControl' | 'fixtures';

interface Props {
  mode?: Mode;
  compact?: boolean;
  title?: string;
}

// Flash entry: which on-screen control to pulse, expires after 300ms.
type FlashKey =
  | `clip-${number}-${number}`
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
  | 'select-all';

export const Apc40SurfaceDiagram: React.FC<Props> = ({
  mode = 'view',
  compact = false,
  title,
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

  const activeDeck = apc40State?.activeDeck ?? 'A';

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
    for (const b of superControlBindings ?? []) {
      if (b.controller === 7 && typeof b.channel === 'number') {
        const label = b.label ?? `${b.controlName}${b.slotIndex !== undefined ? ` #${b.slotIndex + 1}` : ''}`;
        map.set(b.channel, label);
      }
    }
    return map;
  }, [superControlBindings]);

  const masterFaderBinding = useMemo(() => {
    return (superControlBindings ?? []).find(
      (b) => b.controller === 14 && b.channel === 0
    );
  }, [superControlBindings]);

  const deviceKnobBindings = useMemo(() => {
    const map = new Map<number, string>();
    for (const b of superControlBindings ?? []) {
      if (b.controller !== undefined && b.controller >= 0x10 && b.controller <= 0x17 && b.channel === 0) {
        const slot = b.controller - 0x10;
        map.set(slot, b.label ?? b.controlName);
      }
    }
    return map;
  }, [superControlBindings]);

  // Live flash on incoming MIDI: track which on-screen key is flashing.
  const [flashing, setFlashing] = useState<Record<string, number>>({});
  const flashTimers = useRef<Record<string, number>>({});
  const flash = useCallback((key: FlashKey) => {
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

  useEffect(() => {
    if (!latestMidi) return;
    const action = decodeApc40Message(latestMidi);
    if (!action) return;
    switch (action.type) {
      case 'clip-launch':
        flash(`clip-${action.row}-${action.column}`);
        break;
      case 'scene-launch':
        flash(`scene-${action.sceneIndex}`);
        break;
      case 'track-select':
        flash(`track-select-${action.trackIndex}`);
        break;
      case 'record-arm':
        flash(`record-arm-${action.trackIndex}`);
        break;
      case 'solo-cue':
        flash(`solo-${action.trackIndex}`);
        break;
      case 'activator':
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
  }, [latestMidi, flash]);

  const onClipClick = (row: number, col: number) => {
    if (mode !== 'scenes' && mode !== 'view') return;
    const name = clipSceneNameForCell(activeDeck, row, col);
    const scene = scenes.find((s) => s.name === name);
    if (scene) loadScene(scene.name);
  };

  const onSceneLaunchClick = (idx: number) => {
    if (mode !== 'acts' && mode !== 'view') return;
    const act = acts[idx];
    if (act) playAct(act.id);
  };

  const onTrackSelectClick = (col: number) => {
    if (mode !== 'fixtures' && mode !== 'view') return;
    const group = groups[col];
    if (group) selectFixtureGroup(group.id);
  };

  return (
    <div
      className={`${styles.surface} ${compact ? styles.compact : ''} ${styles[`mode_${mode}`] ?? ''}`}
      aria-label={title ?? 'APC40 surface diagram'}
    >
      <div className={styles.title}>
        <strong>APC40</strong>
        <span>
          {title ?? `mode: ${mode}`} · deck {activeDeck}
          {apc40State?.shiftLatched ? ' · SHIFT' : ''}
        </span>
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
                title={deviceKnobBindings.get(i) ?? `Device Knob ${i + 1} · CC${0x10 + i} ch0`}
              >
                <span className={styles.knobDot} />
                <span className={styles.knobLabel}>{deviceKnobBindings.get(i) ?? `D${i + 1}`}</span>
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
          <div className={styles.clipGrid}>
            {Array.from({ length: APC40_GRID_ROWS }, (_, row) => (
              <div key={`row${row}`} className={styles.gridRow}>
                {Array.from({ length: APC40_GRID_COLS }, (_, col) => {
                  const name = clipSceneNameForCell(activeDeck, row, col);
                  const scene = scenes.find((s) => s.name === name);
                  const isActive = activeSceneName === name;
                  const isFlashing = !!flashing[`clip-${row}-${col}`];
                  return (
                    <button
                      key={`c${row}-${col}`}
                      type="button"
                      className={`${styles.clipCell} ${scene ? styles.bound : styles.unbound} ${isActive ? styles.active : ''} ${isFlashing ? styles.flash : ''}`}
                      onClick={() => onClipClick(row, col)}
                      title={scene ? `${scene.name} → ${scene.channelValues?.length ?? 0} ch` : `${name} (empty)`}
                      disabled={mode !== 'scenes' && mode !== 'view'}
                    >
                      <span className={styles.cellLabel}>
                        {scene ? scene.name.replace(/^APC40 Deck [AB] /, '') : '—'}
                      </span>
                    </button>
                  );
                })}
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
                  className={`${styles.sceneLaunchBtn} ${act ? styles.bound : styles.unbound} ${isActive ? styles.active : ''} ${isFlashing ? styles.flash : ''}`}
                  onClick={() => onSceneLaunchClick(idx)}
                  title={act ? `ACT ${idx + 1}: ${act.name}` : `ACT ${idx + 1} (empty)`}
                  disabled={mode !== 'acts' && mode !== 'view'}
                >
                  <span className={styles.cellLabel}>{act ? act.name : `ACT ${idx + 1}`}</span>
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
                const isArmed = rowName === 'ARM' && apc40State?.armedColumns?.includes(col);
                const group = groups[col];
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
                    className={`${styles.stripBtn} ${styles[`row_${rowName}`]} ${isGroupSelected || isArmed || isAutoArmed ? styles.active : ''} ${isFlashing ? styles.flash : ''} ${isSel && group ? styles.bound : ''}`}
                    onClick={() => isSel && onTrackSelectClick(col)}
                    disabled={!isSel || (mode !== 'fixtures' && mode !== 'view')}
                    title={isSel && group ? `Select group "${group.name}"` : `${rowName} col ${col + 1}`}
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
              className={`${styles.fader} ${faderBindings.get(col) ? styles.bound : ''} ${flashing[`fader-${col}`] ? styles.flash : ''}`}
              title={faderBindings.get(col) ?? `Fader ${col + 1} · CC7 ch${col}`}
            >
              <span className={styles.faderTrack}>
                <span className={styles.faderCap} />
              </span>
              <span className={styles.faderLabel}>{faderBindings.get(col) ?? `T${col + 1}`}</span>
            </div>
          ))}
          <div
            className={`${styles.fader} ${styles.masterFader} ${masterFaderBinding ? styles.bound : ''} ${flashing['master-fader'] ? styles.flash : ''}`}
            title={masterFaderBinding?.label ?? 'Master · CC14 ch0'}
          >
            <span className={styles.faderTrack}>
              <span className={styles.faderCap} />
            </span>
            <span className={styles.faderLabel}>MASTER</span>
          </div>
        </div>

        {/* Transport */}
        <div className={styles.transport}>
          <button type="button" className={`${styles.txBtn} ${flashing['shift'] ? styles.flash : ''} ${apc40State?.shiftLatched ? styles.active : ''}`} disabled title="SHIFT (note 0x62)">SHIFT</button>
          <button type="button" className={`${styles.txBtn} ${flashing['nav-scene-prev'] ? styles.flash : ''}`} disabled title="← scene (0x60)">◀</button>
          <button type="button" className={`${styles.txBtn} ${flashing['nav-scene-next'] ? styles.flash : ''}`} disabled title="→ scene (0x61)">▶</button>
          <button type="button" className={`${styles.txBtn} ${flashing['nav-fixture-prev'] ? styles.flash : ''}`} disabled title="↑ fixture (0x5E)">▲</button>
          <button type="button" className={`${styles.txBtn} ${flashing['nav-fixture-next'] ? styles.flash : ''}`} disabled title="↓ fixture (0x5F)">▼</button>
          <button type="button" className={`${styles.txBtn} ${styles.play} ${flashing['play'] ? styles.flash : ''}`} disabled title="PLAY (0x5B)">▶</button>
          <button type="button" className={`${styles.txBtn} ${styles.stop} ${flashing['stop'] ? styles.flash : ''}`} disabled title="STOP (0x5C)">■</button>
          <button type="button" className={`${styles.txBtn} ${styles.record} ${flashing['record'] ? styles.flash : ''}`} disabled title="REC (0x5D)">●</button>
          <button type="button" className={`${styles.txBtn} ${flashing['select-all'] ? styles.flash : ''}`} disabled title="PAN / SEL-ALL (0x57)">PAN</button>
          <div className={`${styles.knob} ${flashing['cue'] ? styles.flash : ''}`} title="CUE (CC 0x2F ch0)">
            <span className={styles.knobDot} />
            <span className={styles.knobLabel}>CUE</span>
          </div>
          <div className={`${styles.crossfader} ${flashing['crossfader'] ? styles.flash : ''}`} title="Crossfader (CC 0x0F ch0)">
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
