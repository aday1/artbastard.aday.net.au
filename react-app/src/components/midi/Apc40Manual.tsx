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

export const Apc40Manual: React.FC = () => {
  const superControlMidiMappings = useStore(s => s.superControlMidiMappings);
  const midiMessages = useStore(s => s.midiMessages);
  const selectedFixtures = useStore(s => s.selectedFixtures);

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
    });
    return map;
  }, [superControlMidiMappings]);

  // Pull friendly labels for the 8 track faders, master, crossfader, cue, and 8 device knobs.
  const trackFaderLabel = (trackIndex: number): string => {
    const b = bindingByKey.get(`cc:${trackIndex}:7`);
    return b?.label ?? `Track ${trackIndex + 1} Fader (CC7 ch${trackIndex + 1})`;
  };
  const knobLabel = (cc: number): string => {
    const b = bindingByKey.get(`cc:0:${cc}`);
    return b?.label ?? `Device Knob CC${cc}`;
  };

  const templateApplied = superControlMidiMappings.length > 0;
  const template = getTemplateById('apc40_mk1');

  return (
    <div className={styles.manual}>
      <div className={styles.intro}>
        <p>
          Visual reference for the AKAI APC40 MK1. Hover or touch the hardware to read what each
          control does. Hardware buttons (grid, scenes, transport) keep their roles regardless
          of the template state; faders and knobs activate once you apply the APC40 template.
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
      </div>

      <div className={styles.deviceFrame}>
        <div className={styles.deviceHeader}>
          <span className={styles.brand}>AKAI</span>
          <span className={styles.model}>APC40 · ArtBastard SuperControl Mode</span>
        </div>

        <div className={styles.layout}>
          {/* Top-right device knob cluster */}
          <div className={`${styles.cluster} ${styles.deviceKnobs}`}>
            <div className={styles.clusterLabel}>Device Knobs (CC16–23)</div>
            <div className={styles.knobRow}>
              {[16, 17, 18, 19, 20, 21, 22, 23].map((cc) => {
                const key = `cc:0:${cc}`;
                return (
                  <div
                    key={cc}
                    className={`${styles.knob} ${activeKey === key ? styles.active : ''}`}
                    style={{ borderColor: categoryColor.superControl }}
                    title={knobLabel(cc)}
                  >
                    <div className={styles.knobDot} />
                    <div className={styles.controlLabel}>{knobLabel(cc)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 8x5 clip grid + scene launch column */}
          <div className={`${styles.cluster} ${styles.clipGrid}`}>
            <div className={styles.clusterLabel}>Clip Grid 8×5 → fixture select</div>
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
            <div className={styles.clusterLabel}>Tracks 1–8: select / stop / fader → per-slot dimmer</div>
            <div className={styles.trackRow}>
              {Array.from({ length: 8 }).map((_, trackIdx) => {
                const selectKey = `note:${trackIdx}:51`; // 0x33 = 51
                const stopKey = `note:${trackIdx}:52`;   // 0x34 = 52
                const faderKey = `cc:${trackIdx}:7`;
                const slotInUse = trackIdx < selectedFixtures.length;
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
                      className={`${styles.fader} ${activeKey === faderKey ? styles.active : ''} ${slotInUse ? styles.faderLive : styles.faderIdle}`}
                      title={trackFaderLabel(trackIdx) + (slotInUse ? '' : ' (no fixture in this slot)')}
                    >
                      <div className={styles.faderTrack}>
                        <div className={styles.faderCap} />
                      </div>
                      <div className={styles.controlLabel}>{trackFaderLabel(trackIdx)}</div>
                    </div>
                  </div>
                );
              })}

              {/* Master fader on the right */}
              <div className={styles.track}>
                <div className={styles.trackButton} style={{ background: categoryColor.utility, visibility: 'hidden' }}>·</div>
                <div className={styles.trackButton} style={{ background: categoryColor.utility, visibility: 'hidden' }}>·</div>
                <div
                  className={`${styles.fader} ${activeKey === 'cc:0:14' ? styles.active : ''} ${styles.masterFader}`}
                  title={bindingByKey.get('cc:0:14')?.label ?? 'Master Fader → Master Dimmer'}
                >
                  <div className={styles.faderTrack}>
                    <div className={styles.faderCap} />
                  </div>
                  <div className={styles.controlLabel}>
                    {bindingByKey.get('cc:0:14')?.label ?? 'Master Fader'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom-left transport + crossfader cluster */}
          <div className={`${styles.cluster} ${styles.transport}`}>
            <div className={styles.clusterLabel}>Transport / Trim</div>
            <div className={styles.transportRow}>
              <div className={styles.transportButton} style={{ background: categoryColor.scene }} title="Play → dispatch 'create show' event">▶ PLAY</div>
              <div className={styles.transportButton} style={{ background: categoryColor.utility }} title="Stop → deselect all fixtures">■ STOP</div>
              <div className={styles.transportButton} style={{ background: categoryColor.transport }} title="Record → quick-capture current state into the next free scene slot">● REC</div>
              <div className={styles.transportButton} style={{ background: categoryColor.utility }} title="Clear Selection (CC0x51)">CLEAR</div>
              <div className={styles.transportButton} style={{ background: categoryColor.utility }} title="Shift modifier">SHIFT</div>
              <div
                className={`${styles.knob} ${activeKey === 'cc:0:47' ? styles.active : ''}`}
                style={{ borderColor: categoryColor.superControl }}
                title={bindingByKey.get('cc:0:47')?.label ?? 'Cue Level → Fine Pan'}
              >
                <div className={styles.knobDot} />
                <div className={styles.controlLabel}>{bindingByKey.get('cc:0:47')?.label ?? 'Cue Level'}</div>
              </div>
              <div
                className={`${styles.crossfader} ${activeKey === 'cc:0:15' ? styles.active : ''}`}
                title={bindingByKey.get('cc:0:15')?.label ?? 'Crossfader → Fine Tilt'}
              >
                <div className={styles.crossfaderTrack}>
                  <div className={styles.crossfaderCap} />
                </div>
                <div className={styles.controlLabel}>{bindingByKey.get('cc:0:15')?.label ?? 'Crossfader'}</div>
              </div>
            </div>
          </div>
        </div>
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
          Controls light up briefly when the matching MIDI message is received,
          so you can verify your physical APC40 is connected and which buttons map where.
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
