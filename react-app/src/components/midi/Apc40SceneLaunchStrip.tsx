import React from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './Apc40SceneLaunchStrip.module.scss';

const APC40_SCENE_LAUNCH_COUNT = 5;
const APC40_FIRST_NOTE = 0x52; // see midi/apc40.ts:69-74

/**
 * Top-of-Scenes/Acts strip rendering the five APC40 SCENE LAUNCH
 * buttons. Each cell shows the Act that the button will trigger,
 * with the active act lit. Hover to see the MIDI note hex value.
 */
export const Apc40SceneLaunchStrip: React.FC = () => {
  const acts = useStore((s) => s.acts);
  const activeActId = useStore((s) => s.actPlaybackState?.currentActId ?? null);

  return (
    <div className={styles.strip} aria-label="APC40 SCENE LAUNCH bindings">
      <div className={styles.header}>
        <LucideIcon name="Cable" size={13} />
        <strong>APC40 SCENE LAUNCH</strong>
        <span>buttons trigger acts 1–5</span>
      </div>
      <div className={styles.row}>
        {Array.from({ length: APC40_SCENE_LAUNCH_COUNT }).map((_, i) => {
          const act = acts[i];
          const noteHex = (APC40_FIRST_NOTE + i).toString(16).toUpperCase().padStart(2, '0');
          const active = act && activeActId === act.id;
          return (
            <button
              key={i}
              type="button"
              className={`${styles.cell} ${active ? styles.active : ''} ${!act ? styles.empty : ''}`}
              title={
                act
                  ? `SCENE LAUNCH ${i + 1} (MIDI note 0x${noteHex}) → ${act.name}`
                  : `SCENE LAUNCH ${i + 1} (MIDI note 0x${noteHex}) — no act assigned`
              }
              aria-pressed={!!active}
              tabIndex={-1}
            >
              <span className={styles.number}>{i + 1}</span>
              <span className={styles.label}>{act ? act.name : 'empty'}</span>
              <span className={styles.note}>0x{noteHex}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Apc40SceneLaunchStrip;
