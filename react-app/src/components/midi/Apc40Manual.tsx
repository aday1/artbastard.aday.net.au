import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import { getTemplateById, SuperControlBinding } from './midiControllerTemplates';
import { APC40_CATEGORY_COLORS, APC40_HARDWIRED_SPECS, stripDeviceKnobPrefix } from './apc40Metadata';
import styles from './Apc40Manual.module.scss';

type FocusMode = 'off' | 'mapped' | 'touched';

const sigForBinding = (b?: SuperControlBinding): string => {
  if (!b) return '—';
  if (b.controller !== undefined) return `CC${b.controller} ch${b.channel + 1}`;
  if (b.note !== undefined) return `N${b.note} ch${b.channel + 1}`;
  if (b.pitch) return `PB ch${b.channel + 1}`;
  return `ch${b.channel + 1}`;
};

const fmtMidiMsg = (m: any): string => {
  const t = m?._type || m?.type;
  const ch = (m?.channel ?? 0) + 1;
  if (t === 'cc') return `cc ch${ch} cc${m.controller} = ${m.value}`;
  if (t === 'noteon') return `note on ch${ch} n${m.note} v${m.velocity}`;
  if (t === 'noteoff') return `note off ch${ch} n${m.note}`;
  if (t === 'pitch') return `pitch ch${ch} = ${m.value}`;
  return t ?? 'msg';
};

const messageKey = (m: any): string | null => {
  const t = m?._type || m?.type;
  if (t === 'cc') return `cc:${m.channel}:${m.controller}`;
  if (t === 'noteon') return `note:${m.channel}:${m.note}`;
  if (t === 'pitch') return `pitch:${m.channel}`;
  return null;
};

export const Apc40Manual: React.FC = () => {
  const superControlMidiMappings = useStore(s => s.superControlMidiMappings);
  const applyMidiControllerTemplate = useStore(s => s.applyMidiControllerTemplate);
  const midiMessages = useStore(s => s.midiMessages);
  const fixtures = useStore(s => s.fixtures);
  const selectedFixtures = useStore(s => s.selectedFixtures);
  const scenes = useStore(s => s.scenes);
  const activeSceneName = useStore(s => s.activeSceneName);
  const acts = useStore(s => s.acts);
  const currentActId = useStore(s => s.actPlaybackState.currentActId);
  const apc40State = useStore(s => s.apc40CrossfaderState);
  const dmxFrozen = useStore(s => s.dmxFrozen);
  const superControlLearnTarget = useStore(s => s.superControlLearnTarget);
  const startSuperControlLearn = useStore(s => s.startSuperControlLearn);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [lastTouchedKey, setLastTouchedKey] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState<FocusMode>('off');
  // Live values per signature, used to animate knob rotation / fader position.
  const [liveValues, setLiveValues] = useState<Record<string, number>>({});
  // Direct-path activity ring for the ticker (the store's midiMessages only
  // covers the server transport; Web MIDI dispatches `midiMessageDirect`).
  const [directLog, setDirectLog] = useState<any[]>([]);
  const [isResettingTemplate, setIsResettingTemplate] = useState(false);
  const activeTimerRef = useRef<number | null>(null);
  const template = getTemplateById('apc40_mk1');

  const flashActive = (key: string) => {
    setActiveKey(key);
    setLastTouchedKey(key);
    if (activeTimerRef.current) window.clearTimeout(activeTimerRef.current);
    activeTimerRef.current = window.setTimeout(() => setActiveKey(prev => (prev === key ? null : prev)), 300);
  };

  const shouldMuteControl = (controlKey: string, mappingBound = false): boolean => {
    if (focusMode === 'off') return false;
    const touched = activeKey === controlKey || lastTouchedKey === controlKey;
    if (focusMode === 'touched') return !touched;
    return !mappingBound && !touched;
  };

  // React to server-MIDI store updates.
  useEffect(() => {
    if (!midiMessages || midiMessages.length === 0) return;
    const m: any = midiMessages[midiMessages.length - 1];
    const key = messageKey(m);
    if (key) {
      flashActive(key);
      const t = m._type || m.type;
      if (t === 'cc' && typeof m.value === 'number') {
        setLiveValues(prev => ({ ...prev, [key]: m.value }));
      }
    }
  }, [midiMessages]);

  // React to direct browser-MIDI events (Web MIDI bypasses the store for
  // throttled CC traffic, so the visualizer needs its own listener).
  useEffect(() => {
    const onDirect = (e: Event) => {
      const m = (e as CustomEvent).detail;
      const key = messageKey(m);
      if (!key) return;
      flashActive(key);
      const t = m._type || m.type;
      if (t === 'cc' && typeof m.value === 'number') {
        setLiveValues(prev => ({ ...prev, [key]: m.value }));
      }
      setDirectLog(prev => [...prev.slice(-9), m]);
    };
    window.addEventListener('midiMessageDirect', onDirect as EventListener);
    return () => window.removeEventListener('midiMessageDirect', onDirect as EventListener);
  }, []);

  useEffect(() => () => {
    if (activeTimerRef.current) window.clearTimeout(activeTimerRef.current);
  }, []);

  const bindingByKey = useMemo(() => {
    const map = new Map<string, SuperControlBinding>();
    superControlMidiMappings.forEach((b) => {
      if (b.controller !== undefined) map.set(`cc:${b.channel}:${b.controller}`, b);
      if (b.note !== undefined) map.set(`note:${b.channel}:${b.note}`, b);
      if (b.pitch) map.set(`pitch:${b.channel}`, b);
    });
    return map;
  }, [superControlMidiMappings]);

  const bindingByControl = useMemo(() => {
    const map = new Map<string, SuperControlBinding>();
    superControlMidiMappings.forEach((b) => {
      map.set(`${b.controlName}:${b.slotIndex ?? '-'}`, b);
    });
    return map;
  }, [superControlMidiMappings]);

  const fallbackBindingByControl = useMemo(() => {
    const map = new Map<string, SuperControlBinding>();
    (template?.superControlMappings ?? []).forEach((b) => {
      map.set(`${b.controlName}:${b.slotIndex ?? '-'}`, b);
    });
    return map;
  }, [template]);

  const fallbackBindingBySig = useMemo(() => {
    const map = new Map<string, SuperControlBinding>();
    (template?.superControlMappings ?? []).forEach((b) => {
      if (b.controller !== undefined) map.set(`cc:${b.channel}:${b.controller}`, b);
      if (b.note !== undefined) map.set(`note:${b.channel}:${b.note}`, b);
      if (b.pitch) map.set(`pitch:${b.channel}`, b);
    });
    return map;
  }, [template]);

  const resolveBinding = (controlName: string, slotIndex?: number): SuperControlBinding | undefined => (
    bindingByControl.get(`${controlName}:${slotIndex ?? '-'}`)
    ?? fallbackBindingByControl.get(`${controlName}:${slotIndex ?? '-'}`)
  );

  const trackFaderBinding = (trackIndex: number) => resolveBinding('dimmer', trackIndex);
  const masterFaderBinding = resolveBinding('masterDimmer');
  const knobBindingByCc = (cc: number) => bindingByKey.get(`cc:0:${cc}`) ?? fallbackBindingBySig.get(`cc:0:${cc}`);
  const cueBinding = bindingByKey.get('cc:0:47') ?? fallbackBindingBySig.get('cc:0:47');
  const crossfaderBinding = bindingByKey.get('cc:0:15') ?? fallbackBindingBySig.get('cc:0:15');

  const templateApplied = superControlMidiMappings.length > 0;

  const isLearningKey = (controlName: string, slotIndex?: number) =>
    superControlLearnTarget?.controlName === controlName &&
    superControlLearnTarget?.slotIndex === slotIndex;

  const beginLearn = (controlName: string, slotIndex?: number) => {
    if (isLearningKey(controlName, slotIndex)) {
      startSuperControlLearn(null);
    } else {
      startSuperControlLearn({ controlName, slotIndex });
    }
  };

  const handleResetApcDefaults = async () => {
    setIsResettingTemplate(true);
    try {
      await applyMidiControllerTemplate('apc40_mk1');
    } finally {
      setIsResettingTemplate(false);
    }
  };

  // Combined activity ticker — last few messages from either path.
  const lastMessages = useMemo(() => {
    const combined = [...(midiMessages ?? []), ...directLog];
    return combined.slice(-5).reverse();
  }, [midiMessages, directLog]);

  // Per-knob rotation: bind a knob's visual dot angle to the latest CC value.
  const knobAngle = (cc: number): number => {
    const key = `cc:0:${cc}`;
    const v = liveValues[key];
    if (v === undefined) return -135; // resting angle
    // 0-127 mapped to -135°..+135°
    return -135 + (v / 127) * 270;
  };

  const faderTopPct = (b?: SuperControlBinding): number => {
    if (!b) return 60;
    let key: string | null = null;
    if (b.controller !== undefined) key = `cc:${b.channel}:${b.controller}`;
    else if (b.note !== undefined) key = `note:${b.channel}:${b.note}`;
    if (!key) return 60;
    const v = liveValues[key];
    if (v === undefined) return 60;
    // 0 = cap at bottom (100%), 127 = cap at top (0%)
    return 100 - (v / 127) * 100;
  };

  const selectedFixtureNames = useMemo(() => {
    return selectedFixtures.map((fixtureId) => {
      const fixture = fixtures.find((item) => item.id === fixtureId);
      return fixture?.name?.trim() || fixtureId;
    });
  }, [fixtures, selectedFixtures]);

  const bindingTargetSummary = (binding?: SuperControlBinding): string => {
    if (!binding) return 'Targets: unassigned';
    if (selectedFixtureNames.length === 0) return 'Targets: none selected';

    if (binding.slotIndex !== undefined) {
      const slotNumber = binding.slotIndex + 1;
      const fixtureName = selectedFixtureNames[binding.slotIndex];
      if (!fixtureName) return `Targets: slot ${slotNumber} (no selected fixture in this slot)`;
      return `Targets: slot ${slotNumber} -> ${fixtureName}`;
    }

    const preview = selectedFixtureNames.slice(0, 3).join(', ');
    const suffix = selectedFixtureNames.length > 3 ? ` +${selectedFixtureNames.length - 3} more` : '';
    return `Targets: all selected fixtures (${selectedFixtureNames.length}) - ${preview}${suffix}`;
  };

  const displayedBindings = superControlMidiMappings.length > 0
    ? superControlMidiMappings
    : (template?.superControlMappings ?? []);

  // ACT LED status for the visual Scene Launch column.
  const actStatus = (idx: number): 'empty' | 'saved' | 'active' => {
    const act = acts?.[idx];
    if (!act) return 'empty';
    return act.id === currentActId ? 'active' : 'saved';
  };

  return (
    <div className={styles.manual}>
      <div className={styles.intro}>
        <p>
          Visual reference for the AKAI APC40 MK1. Controls light up and animate as MIDI arrives —
          click any SuperControl fader or fallback knob to <b>re-learn</b> its binding.
          The grid is <b>Deck A</b>; hold <b>SHIFT</b> for <b>Deck B</b>. Scene Launch buttons are ACT 1-5.
        </p>
        <div className={styles.statusRow}>
          <span className={`${styles.status} ${templateApplied ? styles.statusOn : styles.statusOff}`}>
            {templateApplied ? '● APC40 template applied' : '○ APC40 template not applied'}
          </span>
          <button
            type="button"
            className={styles.resetTemplateBtn}
            onClick={handleResetApcDefaults}
            disabled={isResettingTemplate}
            title="Reapply the APC40 default SuperControl mappings"
          >
            {isResettingTemplate ? 'Resetting…' : 'Reset to APC defaults'}
          </button>
          <span className={styles.statusMeta}>Selected fixtures: <b>{selectedFixtures.length}</b></span>
          <span className={styles.statusMeta}>Deck: <b>{apc40State.activeDeck}</b></span>
          <span className={styles.statusMeta}>A: <b>{apc40State.sceneAName ?? '—'}</b></span>
          <span className={styles.statusMeta}>B: <b>{apc40State.sceneBName ?? '—'}</b></span>
          <span className={styles.statusMeta}>Active scene: <b>{activeSceneName ?? '—'}</b></span>
        </div>
        <div className={styles.focusToolbar}>
          <span className={styles.focusLabel}>Control Focus:</span>
          <button
            type="button"
            className={`${styles.focusBtn} ${focusMode === 'off' ? styles.focusBtnActive : ''}`}
            onClick={() => setFocusMode('off')}
          >
            Off
          </button>
          <button
            type="button"
            className={`${styles.focusBtn} ${focusMode === 'mapped' ? styles.focusBtnActive : ''}`}
            onClick={() => setFocusMode('mapped')}
          >
            Mapped + touched
          </button>
          <button
            type="button"
            className={`${styles.focusBtn} ${focusMode === 'touched' ? styles.focusBtnActive : ''}`}
            onClick={() => setFocusMode('touched')}
          >
            Touched only
          </button>
          <span className={styles.focusHint}>Last touched: <b>{lastTouchedKey ?? 'none'}</b></span>
        </div>
        {template && (
          <p className={styles.templateHint}>{template.details}</p>
        )}
        {!templateApplied && (
          <p className={styles.templateHint}>Showing APC40 default control reference while live mappings are not applied.</p>
        )}

        {superControlLearnTarget && (
          <div className={styles.learnBanner}>
            <span>
              Listening for MIDI… touch a control on your APC40 to rebind
              <b> {superControlLearnTarget.controlName}{superControlLearnTarget.slotIndex !== undefined ? ` (slot ${superControlLearnTarget.slotIndex + 1})` : ''}</b>.
            </span>
            <button type="button" onClick={() => startSuperControlLearn(null)}>Cancel</button>
          </div>
        )}

        <div className={styles.activityTicker} aria-label="Live MIDI activity">
          {lastMessages.length === 0
            ? <span>No MIDI yet — connect APC40 (Settings → MIDI/OSC) and touch a control.</span>
            : lastMessages.map((m, i) => <span key={i}>{fmtMidiMsg(m)}</span>)}
        </div>
      </div>

      <div className={styles.deviceFrame}>
        <div className={styles.deviceHeader}>
          <span className={styles.brand}>AKAI</span>
          <span className={styles.model}>APC40 · ArtBastard Tactile Codex</span>
        </div>

        <div className={styles.layout}>
          {/* Device knobs (CC16-23) */}
          <div className={`${styles.cluster} ${styles.deviceKnobs}`}>
            <div className={styles.clusterLabel}>Device Control (CC16–23) — selected fixture DMX roles · Cue Level pages banks</div>
            <div className={styles.knobRow}>
              {[16, 17, 18, 19, 20, 21, 22, 23].map((cc) => {
                const key = `cc:0:${cc}`;
                const b = knobBindingByCc(cc);
                const roleLabel = apc40State.deviceRoleLabels[cc - 16] ?? b?.label?.replace(/^Device Knob \d+\s*→\s*/, '') ?? `CC${cc}`;
                const controlName = b?.controlName ?? '';
                const slot = b?.slotIndex;
                const learning = controlName && isLearningKey(controlName, slot);
                const angle = knobAngle(cc);
                return (
                  <div key={cc} className={styles.knobBlock}>
                    <div
                      className={`${styles.knob} ${activeKey === key ? styles.active : ''} ${learning ? styles.learning : ''} ${shouldMuteControl(key, Boolean(b)) ? styles.focusMuted : ''}`}
                      style={{ borderColor: learning ? '#3b82f6' : APC40_CATEGORY_COLORS.superControl }}
                      title={`${stripDeviceKnobPrefix(roleLabel) ?? roleLabel} - live APC40 role for selected fixtures\n${bindingTargetSummary(b)}`}
                      onClick={() => b && beginLearn(controlName, slot)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={styles.knobDot} style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: '50% 200%' }} />
                    </div>
                    <div className={styles.controlBlockLabel}>{roleLabel}</div>
                    <div className={styles.controlBlockSig}>{sigForBinding(b)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Clip grid + scene launch column */}
          <div className={`${styles.cluster} ${styles.clipGrid}`}>
            <div className={styles.clusterLabel}>Clip Grid 8×5 → Deck {apc40State.activeDeck} scene slots · REC enters save mode, then Clip pad saves current DMX</div>
            <div className={styles.gridAndScenes}>
              <div className={styles.grid}>
                {Array.from({ length: 5 }).map((_, row) => (
                  <div key={row} className={styles.gridRow}>
                    {Array.from({ length: 8 }).map((_, col) => {
                      const note = 0x35 + row;
                      const key = `note:${col}:${note}`;
                      const index = row * 8 + col;
                      const name = `APC40 Deck ${apc40State.activeDeck} ${String(index + 1).padStart(2, '0')}`;
                      const saved = scenes.some((scene) => scene.name === name);
                      const active = name === (apc40State.activeDeck === 'A' ? apc40State.sceneAName : apc40State.sceneBName);
                      const armed = apc40State.armedColumns.includes(col);
                      const padMuted = shouldMuteControl(key, saved || active);
                      return (
                        <div
                          key={col}
                          className={`${styles.pad} ${activeKey === key ? styles.active : ''} ${padMuted ? styles.focusMuted : ''}`}
                          style={{ background: armed ? '#ef4444' : active ? '#f59e0b' : saved ? '#22c55e' : '#334155' }}
                          title={`${name}${armed ? ' · column armed: press to save' : saved ? ' · press to launch' : ' · empty'}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className={styles.sceneColumn}>
                {[0x52, 0x53, 0x54, 0x55, 0x56].map((note, idx) => {
                  const key = `note:0:${note}`;
                  const status = actStatus(idx);
                  const bg = status === 'active' ? '#f59e0b'
                    : status === 'saved' ? '#22c55e'
                    : '#334155';
                  const muted = shouldMuteControl(key, status !== 'empty');
                  return (
                    <div
                      key={note}
                      className={`${styles.scenePad} ${activeKey === key ? styles.active : ''} ${muted ? styles.focusMuted : ''}`}
                      style={{ background: bg, color: status === 'empty' ? '#94a3b8' : '#0f172a' }}
                      title={`ACT ${idx + 1}: ${status === 'empty' ? 'empty' : status === 'active' ? 'currently playing' : 'saved'}`}
                    >
                      ACT {idx + 1}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tracks 1-8 + master */}
          <div className={`${styles.cluster} ${styles.tracks}`}>
            <div className={styles.clusterLabel}>Tracks 1–8: solo-group, group-auto, fixture/group select, slot dimmer (Track Select row unmapped — hardware CC bleed)</div>
            <div className={styles.trackRow}>
              {Array.from({ length: 8 }).map((_, trackIdx) => {
                const armKey = `note:${trackIdx}:48`;
                const soloKey = `note:${trackIdx}:49`;
                const autoKey = `note:${trackIdx}:50`;
                const selectKey = `note:${trackIdx}:51`;
                const stopKey = `note:${trackIdx}:52`;
                const b = trackFaderBinding(trackIdx);
                const faderKey = b?.controller !== undefined
                  ? `cc:${b.channel}:${b.controller}`
                  : (b?.note !== undefined ? `note:${b.channel}:${b.note}` : (b?.pitch ? `pitch:${b.channel}` : `cc:${trackIdx}:7`));
                const slotInUse = trackIdx < selectedFixtures.length;
                const learning = isLearningKey('dimmer', trackIdx);
                const capTop = faderTopPct(b);
                return (
                  <div key={trackIdx} className={styles.track}>
                    <div
                      className={`${styles.trackButton} ${activeKey === armKey ? styles.active : ''} ${shouldMuteControl(armKey, false) ? styles.focusMuted : ''}`}
                      style={{ background: apc40State.soloedGroups.includes(trackIdx) ? '#ef4444' : APC40_CATEGORY_COLORS.selection }}
                      title={`Record Arm ${trackIdx + 1} → SOLO GROUP ${trackIdx + 1} (latched blackout of non-soloed fixtures)`}
                    >S/G</div>
                    <div
                      className={`${styles.trackButton} ${activeKey === autoKey ? styles.active : ''} ${shouldMuteControl(autoKey, false) ? styles.focusMuted : ''}`}
                      style={{ background: apc40State.autoGroups.includes(trackIdx) ? '#f59e0b' : APC40_CATEGORY_COLORS.transport }}
                      title={`Activator ${trackIdx + 1} → select fixture group ${trackIdx + 1}`}
                    >GRP</div>
                    <div
                      className={`${styles.trackButton} ${activeKey === soloKey ? styles.active : ''} ${shouldMuteControl(soloKey, false) ? styles.focusMuted : ''}`}
                      style={{ background: APC40_CATEGORY_COLORS.selection }}
                      title={`Solo/Cue ${trackIdx + 1} → select fixture ${trackIdx + 1}`}
                    >FIX</div>
                    <div
                      className={`${styles.trackButton} ${activeKey === selectKey ? styles.active : ''} ${shouldMuteControl(selectKey, false) ? styles.focusMuted : ''}`}
                      style={{ background: '#475569' }}
                      title={`Track Select ${trackIdx + 1} → UNMAPPED (APC40 hardware CC bleed)`}
                    >—</div>
                    <div
                      className={`${styles.trackButton} ${activeKey === stopKey ? styles.active : ''} ${shouldMuteControl(stopKey, false) ? styles.focusMuted : ''}`}
                      style={{ background: APC40_CATEGORY_COLORS.utility }}
                      title={`Clip Stop ${trackIdx + 1} → stop/unselect current Deck ${apc40State.activeDeck} scene`}
                    >STOP</div>
                    <div
                      className={`${styles.fader} ${activeKey === faderKey ? styles.active : ''} ${slotInUse ? styles.faderLive : styles.faderIdle} ${learning ? styles.learning : ''} ${shouldMuteControl(faderKey, Boolean(b)) ? styles.focusMuted : ''}`}
                      title={`${b?.label ?? `Track ${trackIdx + 1} Fader`}${slotInUse ? '' : ' (no fixture in this slot)'} - click to re-learn\n${bindingTargetSummary(b)}`}
                      onClick={() => beginLearn('dimmer', trackIdx)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={styles.faderTrack}>
                        <div className={styles.faderCap} style={{ top: `${capTop}%` }} />
                      </div>
                    </div>
                    <div className={styles.controlBlockLabel}>Slot {trackIdx + 1} dim</div>
                    <div className={styles.controlBlockSig}>{sigForBinding(b)}</div>
                  </div>
                );
              })}

              <div className={styles.track}>
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className={styles.trackButton} style={{ background: APC40_CATEGORY_COLORS.utility, visibility: 'hidden' }}>·</div>
                ))}
                <div
                  className={`${styles.trackButton} ${shouldMuteControl('note:0:80', false) ? styles.focusMuted : ''}`}
                  style={{ background: dmxFrozen ? '#ef4444' : APC40_CATEGORY_COLORS.utility }}
                  title="Master Select → FREEZE DMX latch. Press once to freeze output; press again to unfreeze and flush current state."
                >{dmxFrozen ? 'MSTR FRZ' : 'FREEZE'}</div>
                <div
                  className={`${styles.fader} ${styles.masterFader} ${activeKey === `cc:${masterFaderBinding?.channel ?? 0}:${masterFaderBinding?.controller ?? 14}` ? styles.active : ''} ${isLearningKey('masterDimmer') ? styles.learning : ''} ${shouldMuteControl(`cc:${masterFaderBinding?.channel ?? 0}:${masterFaderBinding?.controller ?? 14}`, Boolean(masterFaderBinding)) ? styles.focusMuted : ''}`}
                  title={`${masterFaderBinding?.label ?? 'Master Fader -> Master Dimmer'} - click to re-learn\n${bindingTargetSummary(masterFaderBinding)}`}
                  onClick={() => beginLearn('masterDimmer')}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.faderTrack}>
                    <div className={styles.faderCap} style={{ top: `${faderTopPct(masterFaderBinding)}%` }} />
                  </div>
                </div>
                <div className={styles.controlBlockLabel}>Master</div>
                <div className={styles.controlBlockSig}>{sigForBinding(masterFaderBinding)}</div>
              </div>
            </div>
          </div>

          {/* Transport + nav cluster */}
          <div className={`${styles.cluster} ${styles.transport}`}>
            <div className={styles.clusterLabel}>Transport / Nav — Up/Down cycles fixtures, Left/Right cycles scenes</div>
            <div className={styles.transportRow}>
              <div className={`${styles.transportButton} ${shouldMuteControl('note:0:91', false) ? styles.focusMuted : ''}`} style={{ background: APC40_CATEGORY_COLORS.scene }} title="PLAY → enable Auto Scene playback (LED green-blink while running)">▶ PLAY</div>
              <div className={`${styles.transportButton} ${shouldMuteControl('note:0:92', false) ? styles.focusMuted : ''}`} style={{ background: APC40_CATEGORY_COLORS.utility }} title="STOP → disable Auto Scene playback (LED red while Auto Scene running)">■ STOP</div>
              <div className={`${styles.transportButton} ${shouldMuteControl('note:0:93', false) ? styles.focusMuted : ''}`} style={{ background: apc40State.armedColumns.length > 0 ? '#ef4444' : APC40_CATEGORY_COLORS.transport }} title="REC → enter/exit clip-grid save mode. REC then SHIFT+Clip saves Deck B. SHIFT+REC rolls a fresh random look (preview only).">● REC</div>
              <div className={`${styles.transportButton} ${shouldMuteControl('note:0:82', false) ? styles.focusMuted : ''}`} style={{ background: APC40_CATEGORY_COLORS.utility }} title="Clear Selection">CLEAR</div>
              <div className={`${styles.transportButton} ${shouldMuteControl('note:0:98', false) ? styles.focusMuted : ''}`} style={{ background: apc40State.shiftLatched ? '#f59e0b' : APC40_CATEGORY_COLORS.utility }} title="Hold SHIFT → Deck B grid mode">SHIFT</div>
              <div className={`${styles.transportButton} ${shouldMuteControl('note:0:87', false) ? styles.focusMuted : ''}`} style={{ background: APC40_CATEGORY_COLORS.selection }} title="Pan button → Select All fixtures">SEL ALL</div>

              {/* Nav arrows */}
              <div className={styles.navCluster} title="Up/Down → cycle fixtures · Left/Right → cycle scenes">
                <div className={`${styles.navBtn} ${activeKey === 'note:0:94' ? styles.active : ''} ${shouldMuteControl('note:0:94', false) ? styles.focusMuted : ''}`} style={{ background: APC40_CATEGORY_COLORS.nav, gridArea: 'up' }} title="Up → previous fixture">▲ FX-</div>
                <div className={`${styles.navBtn} ${activeKey === 'note:0:96' ? styles.active : ''} ${shouldMuteControl('note:0:96', false) ? styles.focusMuted : ''}`} style={{ background: APC40_CATEGORY_COLORS.nav, gridArea: 'left' }} title="Left → previous scene">◀ SC-</div>
                <div className={`${styles.navBtn} ${activeKey === 'note:0:97' ? styles.active : ''} ${shouldMuteControl('note:0:97', false) ? styles.focusMuted : ''}`} style={{ background: APC40_CATEGORY_COLORS.nav, gridArea: 'right' }} title="Right → next scene">SC+ ▶</div>
                <div className={`${styles.navBtn} ${activeKey === 'note:0:95' ? styles.active : ''} ${shouldMuteControl('note:0:95', false) ? styles.focusMuted : ''}`} style={{ background: APC40_CATEGORY_COLORS.nav, gridArea: 'down' }} title="Down → next fixture">▼ FX+</div>
              </div>

              <div className={styles.knobBlock}>
                <div
                  className={`${styles.knob} ${activeKey === `cc:${cueBinding?.channel ?? 0}:${cueBinding?.controller ?? 47}` ? styles.active : ''} ${shouldMuteControl(`cc:${cueBinding?.channel ?? 0}:${cueBinding?.controller ?? 47}`, Boolean(cueBinding)) ? styles.focusMuted : ''}`}
                  style={{ borderColor: '#475569' }}
                  title="Cue Level → automation direction. CW = forward, CCW = reverse."
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.knobDot} />
                </div>
                <div className={styles.controlBlockLabel}>Cue dir</div>
                <div className={styles.controlBlockSig}>CC47</div>
              </div>
              <div className={styles.knobBlock}>
                <div
                  className={`${styles.crossfader} ${activeKey === `cc:${crossfaderBinding?.channel ?? 0}:${crossfaderBinding?.controller ?? 15}` ? styles.active : ''} ${shouldMuteControl(`cc:${crossfaderBinding?.channel ?? 0}:${crossfaderBinding?.controller ?? 15}`, Boolean(crossfaderBinding)) ? styles.focusMuted : ''}`}
                  title="Crossfader → blend active Deck A scene with active Deck B scene"
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.crossfaderTrack}>
                    <div className={styles.crossfaderCap} />
                  </div>
                </div>
                <div className={styles.controlBlockLabel}>A/B Blend</div>
                <div className={styles.controlBlockSig}>CC15</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.bindingTable}>
        <h4>SuperControl Bindings ({superControlMidiMappings.length})</h4>
        {displayedBindings.length === 0 ? (
          <p className={styles.legendNote}>No SuperControl bindings or defaults available.</p>
        ) : (
          <>
            {superControlMidiMappings.length === 0 && (
              <p className={styles.legendNote}>Showing APC40 default bindings (reference mode).</p>
            )}
          <table>
            <thead>
              <tr>
                <th>Control</th>
                <th>Parameter</th>
                <th>MIDI</th>
                <th>Re-learn</th>
              </tr>
            </thead>
            <tbody>
              {displayedBindings.map((b, i) => {
                const learning = isLearningKey(b.controlName, b.slotIndex);
                return (
                  <tr key={i}>
                    <td>{b.label ?? b.controlName}</td>
                    <td>{b.controlName}{b.slotIndex !== undefined ? ` (slot ${b.slotIndex + 1})` : ''}</td>
                    <td><code>{sigForBinding(b)}</code></td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.relearnBtn} ${learning ? styles.learningBtn : ''}`}
                        onClick={() => beginLearn(b.controlName, b.slotIndex)}
                      >
                        {learning ? 'Listening… (click to cancel)' : 'Re-learn'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </>
        )}
      </div>

      <div className={styles.legend}>
        <h4>Legend</h4>
        <ul>
          {(Object.entries(APC40_CATEGORY_COLORS) as Array<[string, string]>).map(([cat, color]) => (
            <li key={cat}>
              <span className={styles.legendSwatch} style={{ background: color }} />
              {({
                selection: 'Fixture selection',
                scene: 'Scenes',
                transport: 'Capture / Transport',
                utility: 'Utility',
                superControl: 'SuperControl param',
                nav: 'Navigation (next/prev)',
              } as Record<string, string>)[cat]}
            </li>
          ))}
        </ul>
        <p className={styles.legendNote}>
          Knobs rotate and faders track live with incoming MIDI values. Grid pads show Deck A/B slots; Scene Launch pads show ACT availability/playback.
        </p>
      </div>

      <div className={styles.hardwireTable}>
        <h4>Hardware Button Wiring (always-on)</h4>
        <table>
          <thead>
            <tr><th>Control</th><th>What it does</th></tr>
          </thead>
          <tbody>
            {APC40_HARDWIRED_SPECS.map((row) => (
              <tr key={row.key}>
                <td>
                  <span className={styles.legendSwatch} style={{ background: APC40_CATEGORY_COLORS[row.category] }} />
                  {row.label}
                </td>
                <td>{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Apc40Manual;
