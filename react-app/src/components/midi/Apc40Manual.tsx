import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { getTemplateById, SuperControlBinding } from './midiControllerTemplates';
import styles from './Apc40Manual.module.scss';

type SectionKey =
  | 'clipGrid'
  | 'sceneLaunch'
  | 'trackSelect'
  | 'trackStop'
  | 'transport'
  | 'trackFader'
  | 'masterFader'
  | 'crossfader'
  | 'cueLevel'
  | 'deviceKnob'
  | 'shift'
  | 'clear';

interface HardwireSpec {
  key: SectionKey;
  label: string;
  description: string;
  category: 'selection' | 'scene' | 'transport' | 'superControl' | 'utility';
}

// Wiring that lives in useApc40Workflow.ts (not in the template) — kept here
// for the visual manual so the user can see what every button does.
const HARDWIRED: HardwireSpec[] = [
  { key: 'clipGrid',    label: 'Clip Grid (8×5)',     description: 'Toggle fixture selection by slot; empty slot prompts to add a fixture template.', category: 'selection' },
  { key: 'sceneLaunch', label: 'Scene Launch (1–5)',  description: 'Load saved scene from slot; if slot is empty, captures current DMX state into it.', category: 'scene' },
  { key: 'trackSelect', label: 'Track Select (1–8)',  description: 'Select fixture group by index. Falls back to selecting the single fixture in that column.', category: 'selection' },
  { key: 'trackStop',   label: 'Track Stop',          description: 'Stops/clears the per-column group binding.', category: 'utility' },
  { key: 'transport',   label: 'Play / Stop / Record', description: 'Play = create show; Stop = deselect all; Record = quick-capture scene with timestamp.', category: 'scene' },
  { key: 'shift',       label: 'Shift',                description: 'Modifier reserved for shift-combos.', category: 'utility' },
  { key: 'clear',       label: 'Clear Selection',     description: 'Deselects all fixtures.', category: 'selection' },
];

const categoryColor: Record<HardwireSpec['category'] | 'superControl', string> = {
  selection:     '#22c55e',
  scene:         '#f59e0b',
  transport:     '#ec4899',
  utility:       '#64748b',
  superControl:  '#3b82f6',
};

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

export const Apc40Manual: React.FC = () => {
  const superControlMidiMappings = useStore(s => s.superControlMidiMappings);
  const midiMessages = useStore(s => s.midiMessages);
  const selectedFixtures = useStore(s => s.selectedFixtures);
  const superControlLearnTarget = useStore(s => s.superControlLearnTarget);
  const startSuperControlLearn = useStore(s => s.startSuperControlLearn);

  const [activeKey, setActiveKey] = useState<string | null>(null);

  // Highlight the matching control when a MIDI message arrives.
  useEffect(() => {
    if (!midiMessages || midiMessages.length === 0) return;
    const m: any = midiMessages[midiMessages.length - 1];
    const type = m?.type || m?._type;
    let key: string | null = null;
    if (type === 'cc') {
      key = `cc:${m.channel}:${m.controller}`;
    } else if (type === 'noteon') {
      key = `note:${m.channel}:${m.note}`;
    } else if (type === 'pitch') {
      key = `pitch:${m.channel}`;
    }
    if (key) {
      setActiveKey(key);
      const t = window.setTimeout(() => setActiveKey(prev => (prev === key ? null : prev)), 250);
      return () => window.clearTimeout(t);
    }
  }, [midiMessages]);

  // Build a quick lookup from MIDI signature → SuperControl binding label.
  const bindingByKey = useMemo(() => {
    const map = new Map<string, SuperControlBinding>();
    superControlMidiMappings.forEach((b) => {
      if (b.controller !== undefined) map.set(`cc:${b.channel}:${b.controller}`, b);
      if (b.note !== undefined) map.set(`note:${b.channel}:${b.note}`, b);
      if (b.pitch) map.set(`pitch:${b.channel}`, b);
    });
    return map;
  }, [superControlMidiMappings]);

  // Lookup by SuperControl identity (controlName + slotIndex) for the "current
  // signature" labels on each control. After a re-learn the binding may move
  // to a totally different CC/note, so we key by control identity not by sig.
  const bindingByControl = useMemo(() => {
    const map = new Map<string, SuperControlBinding>();
    superControlMidiMappings.forEach((b) => {
      map.set(`${b.controlName}:${b.slotIndex ?? '-'}`, b);
    });
    return map;
  }, [superControlMidiMappings]);

  const trackFaderBinding = (trackIndex: number) => bindingByControl.get(`dimmer:${trackIndex}`);
  const masterFaderBinding = bindingByControl.get('masterDimmer:-');
  const knobBindingByCc = (cc: number) => bindingByKey.get(`cc:0:${cc}`);
  const cueBinding = bindingByControl.get('fine_pan:-');
  const crossfaderBinding = bindingByControl.get('fine_tilt:-');

  const templateApplied = superControlMidiMappings.length > 0;
  const template = getTemplateById('apc40_mk1');

  const isLearningKey = (controlName: string, slotIndex?: number) =>
    superControlLearnTarget?.controlName === controlName &&
    superControlLearnTarget?.slotIndex === slotIndex;

  const beginLearn = (controlName: string, slotIndex?: number) => {
    if (isLearningKey(controlName, slotIndex)) {
      startSuperControlLearn(null); // toggle off
    } else {
      startSuperControlLearn({ controlName, slotIndex });
    }
  };

  // Activity ticker: last 5 messages
  const lastMessages = useMemo(() => {
    const tail = midiMessages?.slice(-5) ?? [];
    return tail.slice().reverse();
  }, [midiMessages]);

  return (
    <div className={styles.manual}>
      <div className={styles.intro}>
        <p>
          Visual reference for the AKAI APC40 MK1. Hover any control to read what it does;
          click a fader, knob, master, cue or crossfader to <b>re-learn</b> its MIDI signature —
          the next inbound MIDI message will rebind that SuperControl parameter.
          Hardware buttons (grid, scenes, transport) keep their roles regardless of template state.
        </p>
        <div className={styles.statusRow}>
          <span className={`${styles.status} ${templateApplied ? styles.statusOn : styles.statusOff}`}>
            {templateApplied ? '● APC40 template applied' : '○ APC40 template not applied'}
          </span>
          <span className={styles.statusMeta}>Selected fixtures: <b>{selectedFixtures.length}</b></span>
        </div>
        {template && (
          <p className={styles.templateHint}>{template.details}</p>
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
            ? <span>No MIDI messages yet — connect APC40 (Settings → MIDI/OSC) and wiggle a control.</span>
            : lastMessages.map((m, i) => <span key={i}>{fmtMidiMsg(m)}</span>)}
        </div>
      </div>

      <div className={styles.deviceFrame}>
        <div className={styles.deviceHeader}>
          <span className={styles.brand}>AKAI</span>
          <span className={styles.model}>APC40 · ArtBastard Tactile Codex</span>
        </div>

        <div className={styles.layout}>
          {/* Top-right device knob cluster */}
          <div className={`${styles.cluster} ${styles.deviceKnobs}`}>
            <div className={styles.clusterLabel}>Device Knobs (CC16–23) — click to re-learn</div>
            <div className={styles.knobRow}>
              {[16, 17, 18, 19, 20, 21, 22, 23].map((cc) => {
                const key = `cc:0:${cc}`;
                const b = knobBindingByCc(cc);
                const controlName = b?.controlName ?? '';
                const slot = b?.slotIndex;
                const learning = controlName && isLearningKey(controlName, slot);
                return (
                  <div
                    key={cc}
                    className={`${styles.knob} ${activeKey === key ? styles.active : ''} ${learning ? styles.learning : ''}`}
                    style={{ borderColor: learning ? '#3b82f6' : categoryColor.superControl }}
                    title={`${b?.label ?? `CC${cc}`} — click to re-learn`}
                    onClick={() => b && beginLearn(controlName, slot)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.knobDot} />
                    <div className={styles.controlLabel}>{b?.label ?? `Device Knob CC${cc}`}</div>
                    <div className={styles.controlSig}>{sigForBinding(b)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 8x5 clip grid + scene launch column */}
          <div className={`${styles.cluster} ${styles.clipGrid}`}>
            <div className={styles.clusterLabel}>Clip Grid 8×5 → fixture select (hardware-wired)</div>
            <div className={styles.gridAndScenes}>
              <div className={styles.grid}>
                {Array.from({ length: 5 }).map((_, row) => (
                  <div key={row} className={styles.gridRow}>
                    {Array.from({ length: 8 }).map((_, col) => {
                      const note = 0x35 + row;
                      const key = `note:${col}:${note}`;
                      return (
                        <div
                          key={col}
                          className={`${styles.pad} ${activeKey === key ? styles.active : ''}`}
                          style={{ background: categoryColor.selection }}
                          title={`Row ${row + 1}, Track ${col + 1} → Toggle fixture slot ${row * 8 + col + 1}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className={styles.sceneColumn}>
                {[0x52, 0x53, 0x54, 0x55, 0x56].map((note, idx) => {
                  const key = `note:0:${note}`;
                  return (
                    <div
                      key={note}
                      className={`${styles.scenePad} ${activeKey === key ? styles.active : ''}`}
                      style={{ background: categoryColor.scene }}
                      title={`Scene ${idx + 1}: load if saved, capture if empty`}
                    >
                      Scene {idx + 1}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Track row: select + stop buttons above each fader */}
          <div className={`${styles.cluster} ${styles.tracks}`}>
            <div className={styles.clusterLabel}>Tracks 1–8: fader → slot dimmer · click fader to re-learn</div>
            <div className={styles.trackRow}>
              {Array.from({ length: 8 }).map((_, trackIdx) => {
                const selectKey = `note:${trackIdx}:51`;
                const stopKey = `note:${trackIdx}:52`;
                const b = trackFaderBinding(trackIdx);
                const faderKey = b?.controller !== undefined
                  ? `cc:${b.channel}:${b.controller}`
                  : (b?.note !== undefined ? `note:${b.channel}:${b.note}` : (b?.pitch ? `pitch:${b.channel}` : `cc:${trackIdx}:7`));
                const slotInUse = trackIdx < selectedFixtures.length;
                const learning = isLearningKey('dimmer', trackIdx);
                return (
                  <div key={trackIdx} className={styles.track}>
                    <div
                      className={`${styles.trackButton} ${activeKey === selectKey ? styles.active : ''}`}
                      style={{ background: categoryColor.selection }}
                      title={`Track ${trackIdx + 1} Select → group/fixture index ${trackIdx + 1}`}
                    >SEL</div>
                    <div
                      className={`${styles.trackButton} ${activeKey === stopKey ? styles.active : ''}`}
                      style={{ background: categoryColor.utility }}
                      title="Track Stop"
                    >STOP</div>
                    <div
                      className={`${styles.fader} ${activeKey === faderKey ? styles.active : ''} ${slotInUse ? styles.faderLive : styles.faderIdle} ${learning ? styles.learning : ''}`}
                      title={`${b?.label ?? `Track ${trackIdx + 1} Fader`}${slotInUse ? '' : ' (no fixture in this slot)'} — click to re-learn`}
                      onClick={() => beginLearn('dimmer', trackIdx)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={styles.faderTrack}>
                        <div className={styles.faderCap} />
                      </div>
                      <div className={styles.controlLabel}>{b?.label ?? `Track ${trackIdx + 1} Fader`}</div>
                      <div className={styles.controlSig}>{sigForBinding(b)}</div>
                    </div>
                  </div>
                );
              })}

              {/* Master fader on the right */}
              <div className={styles.track}>
                <div className={styles.trackButton} style={{ background: categoryColor.utility, visibility: 'hidden' }}>·</div>
                <div className={styles.trackButton} style={{ background: categoryColor.utility, visibility: 'hidden' }}>·</div>
                <div
                  className={`${styles.fader} ${styles.masterFader} ${activeKey === `cc:${masterFaderBinding?.channel ?? 0}:${masterFaderBinding?.controller ?? 14}` ? styles.active : ''} ${isLearningKey('masterDimmer') ? styles.learning : ''}`}
                  title={`${masterFaderBinding?.label ?? 'Master Fader → Master Dimmer'} — click to re-learn`}
                  onClick={() => beginLearn('masterDimmer')}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.faderTrack}>
                    <div className={styles.faderCap} />
                  </div>
                  <div className={styles.controlLabel}>
                    {masterFaderBinding?.label ?? 'Master Fader'}
                  </div>
                  <div className={styles.controlSig}>{sigForBinding(masterFaderBinding)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom-left transport + crossfader cluster */}
          <div className={`${styles.cluster} ${styles.transport}`}>
            <div className={styles.clusterLabel}>Transport / Trim — knob &amp; crossfader are click-to-re-learn</div>
            <div className={styles.transportRow}>
              <div className={styles.transportButton} style={{ background: categoryColor.scene }} title="Play → dispatch 'create show' event">▶ PLAY</div>
              <div className={styles.transportButton} style={{ background: categoryColor.utility }} title="Stop → deselect all fixtures">■ STOP</div>
              <div className={styles.transportButton} style={{ background: categoryColor.transport }} title="Record → quick-capture current state into the next free scene slot">● REC</div>
              <div className={styles.transportButton} style={{ background: categoryColor.utility }} title="Clear Selection">CLEAR</div>
              <div className={styles.transportButton} style={{ background: categoryColor.utility }} title="Shift modifier">SHIFT</div>
              <div
                className={`${styles.knob} ${activeKey === `cc:${cueBinding?.channel ?? 0}:${cueBinding?.controller ?? 47}` ? styles.active : ''} ${isLearningKey('fine_pan') ? styles.learning : ''}`}
                style={{ borderColor: categoryColor.superControl }}
                title={`${cueBinding?.label ?? 'Cue Level → Fine Pan'} — click to re-learn`}
                onClick={() => beginLearn('fine_pan')}
                role="button"
                tabIndex={0}
              >
                <div className={styles.knobDot} />
                <div className={styles.controlLabel}>{cueBinding?.label ?? 'Cue Level'}</div>
                <div className={styles.controlSig}>{sigForBinding(cueBinding)}</div>
              </div>
              <div
                className={`${styles.crossfader} ${activeKey === `cc:${crossfaderBinding?.channel ?? 0}:${crossfaderBinding?.controller ?? 15}` ? styles.active : ''} ${isLearningKey('fine_tilt') ? styles.learning : ''}`}
                title={`${crossfaderBinding?.label ?? 'Crossfader → Fine Tilt'} — click to re-learn`}
                onClick={() => beginLearn('fine_tilt')}
                role="button"
                tabIndex={0}
              >
                <div className={styles.crossfaderTrack}>
                  <div className={styles.crossfaderCap} />
                </div>
                <div className={styles.controlLabel}>{crossfaderBinding?.label ?? 'Crossfader'}</div>
                <div className={styles.controlSig}>{sigForBinding(crossfaderBinding)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active SuperControl bindings — the source of truth */}
      <div className={styles.bindingTable}>
        <h4>SuperControl Bindings ({superControlMidiMappings.length})</h4>
        {superControlMidiMappings.length === 0 ? (
          <p className={styles.legendNote}>No SuperControl bindings yet. Apply the APC40 template in the MIDI Mappings card above.</p>
        ) : (
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
              {superControlMidiMappings.map((b, i) => {
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
        )}
      </div>

      <div className={styles.legend}>
        <h4>Legend</h4>
        <ul>
          {(Object.entries(categoryColor) as Array<[string, string]>).map(([cat, color]) => (
            <li key={cat}>
              <span className={styles.legendSwatch} style={{ background: color }} />
              {({
                selection: 'Fixture selection',
                scene: 'Scenes',
                transport: 'Capture / Transport',
                utility: 'Utility',
                superControl: 'SuperControl param',
              } as Record<string, string>)[cat]}
            </li>
          ))}
        </ul>
        <p className={styles.legendNote}>
          Controls light up briefly when the matching MIDI message is received.
          Hardware wiring (grid/scenes/transport) is fixed; everything else can be re-learned.
        </p>
      </div>

      <div className={styles.hardwireTable}>
        <h4>Hardware Button Wiring (always-on)</h4>
        <table>
          <thead>
            <tr><th>Control</th><th>What it does</th></tr>
          </thead>
          <tbody>
            {HARDWIRED.map((row) => (
              <tr key={row.key}>
                <td>
                  <span className={styles.legendSwatch} style={{ background: categoryColor[row.category] }} />
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
