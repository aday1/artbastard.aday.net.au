import React from 'react';
import { type Fixture, type Group, useStore } from '../../store';
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

function describeMidiTarget(fixtures: Fixture[], groups: Group[], selectedFixtures: string[]): string {
  if (selectedFixtures.length === 0) return 'target: no fixture selected';

  const selectedIds = new Set(selectedFixtures);
  const selectedGroups = groups.filter(group => {
    const fixtureIds = group.fixtureIndices
      .map(index => fixtures[index]?.id)
      .filter((id): id is string => Boolean(id));
    return fixtureIds.length > 0 && fixtureIds.every(id => selectedIds.has(id));
  });

  if (selectedGroups.length === 1) return `target: group "${selectedGroups[0].name}"`;
  if (selectedGroups.length > 1) return `target: ${selectedGroups.length} groups`;

  const names = selectedFixtures
    .map(id => fixtures.find(fixture => fixture.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  if (names.length === 1) return `target: fixture "${names[0]}"`;
  return `target: ${names.length || selectedFixtures.length} fixtures`;
}

/**
 * Compact strip showing which SuperControl controls currently have a MIDI
 * binding from a persisted template (APC40, X-Touch, etc.). Renders one chip
 * per binding with the live CC/note label so the user can see at a glance
 * what the controller actually drives.
 */
export const SuperControlMidiBindingsBar: React.FC = () => {
  const { bindings, fixtures, groups, selectedFixtures, deviceRoleLabels } = useStore((s) => ({
    bindings: s.superControlMidiMappings,
    fixtures: s.fixtures,
    groups: s.groups,
    selectedFixtures: s.selectedFixtures,
    deviceRoleLabels: s.apc40CrossfaderState.deviceRoleLabels,
  }));
  const targetSummary = describeMidiTarget(fixtures, groups, selectedFixtures);
  const deviceSummary = deviceRoleLabels.length > 0
    ? `device: ${deviceRoleLabels.slice(0, 4).join(', ')}${deviceRoleLabels.length > 4 ? '...' : ''}`
    : 'device: role-aware';

  if (!bindings || bindings.length === 0) {
    return (
      <div className={styles.bar}>
        <div className={styles.header}>
          <LucideIcon name="Cable" size={13} />
          <strong>MIDI BINDINGS</strong>
          <span>{targetSummary} · apply APC40 / X-Touch to wire faders &amp; knobs</span>
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
          {bindings.length} bound · {targetSummary} · {deviceSummary}
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
