import React from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './SuperControlMidiBindingsBar.module.scss';

const FRIENDLY_NAMES: Record<string, string> = {
  masterDimmer: 'Master',
  dimmer: 'Dim',
  pan: 'Pan',
  tilt: 'Tilt',
  fine_pan: 'Pan fine',
  fine_tilt: 'Tilt fine',
  red: 'R',
  green: 'G',
  blue: 'B',
  gobo: 'Gobo',
  gobo_rotation: 'Gobo rot',
  color_wheel: 'Color wheel',
  prism: 'Prism',
  iris: 'Iris',
  focus: 'Focus',
  zoom: 'Zoom',
  shutter: 'Shutter',
  strobe: 'Strobe',
};

/**
 * Compact strip showing which SuperControl controls currently have a MIDI
 * binding from a persisted template (APC40, X-Touch, etc.). Renders one chip
 * per binding with the live CC/note label so the user can see at a glance
 * what the controller actually drives.
 */
export const SuperControlMidiBindingsBar: React.FC = () => {
  const bindings = useStore((s) => s.superControlMidiMappings);

  if (!bindings || bindings.length === 0) {
    return (
      <div className={styles.bar}>
        <div className={styles.header}>
          <LucideIcon name="Cable" size={13} />
          <strong>MIDI BINDINGS</strong>
          <span>none — apply a controller template (APC40 / X-Touch) to wire faders &amp; knobs</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.bar} aria-label="Active SuperControl MIDI bindings">
      <div className={styles.header}>
        <LucideIcon name="Cable" size={13} />
        <strong>MIDI BINDINGS</strong>
        <span>
          {bindings.length} bound · APC40 faders = CC 0x07 ch0–7, device knobs = CC 16–23 ch0
        </span>
      </div>
      <div className={styles.row}>
        {bindings.map((binding, idx) => {
          const friendly = FRIENDLY_NAMES[binding.controlName] ?? binding.controlName;
          const slot = binding.slotIndex !== undefined ? ` #${binding.slotIndex + 1}` : '';
          const detail =
            binding.controller !== undefined
              ? `CH${binding.channel} CC${binding.controller}`
              : binding.note !== undefined
                ? `CH${binding.channel} N${binding.note}`
                : `CH${binding.channel}`;
          return (
            <span
              key={`${binding.controlName}-${binding.slotIndex ?? 'all'}-${idx}`}
              className={styles.chip}
              title={`${binding.controlName}${slot} → ${detail}`}
            >
              <span className={styles.chipName}>
                {friendly}
                {slot}
              </span>
              <span className={styles.chipDetail}>{detail}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default SuperControlMidiBindingsBar;
