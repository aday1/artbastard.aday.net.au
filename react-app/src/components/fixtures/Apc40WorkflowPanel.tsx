import React, { useMemo } from 'react';
import { useStore } from '../../store';
import { isApc40Source } from '../../midi/apc40';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './FixtureSetup.module.scss';

export const Apc40WorkflowPanel: React.FC = () => {
  const { midiMessages, scenes, fixtures, groups, fixtureTemplates } = useStore((state) => ({
    midiMessages: state.midiMessages,
    scenes: state.scenes,
    fixtures: state.fixtures,
    groups: state.groups,
    fixtureTemplates: state.fixtureTemplates,
  }));

  const lastApcSource = useMemo(() => {
    const recent = [...midiMessages].reverse().find((message) => isApc40Source(message.source));
    return recent?.source;
  }, [midiMessages]);

  return (
    <section className={styles.apcPanel} aria-label="Akai APC40 remote workflow">
      <div className={styles.apcHeader}>
        <div>
          <span className={styles.stepKicker}>Remote control</span>
          <h3>Akai APC40 / APC40 mkII</h3>
          <p>Plug it in, enable the MIDI input, then use the grid as a fixture/show remote.</p>
        </div>
        <div className={lastApcSource ? styles.apcStatusReady : styles.apcStatusIdle}>
          <LucideIcon name={lastApcSource ? 'Cable' : 'Unplug'} size={16} />
          {lastApcSource || 'Waiting for APC40 MIDI'}
        </div>
      </div>

      <div className={styles.apcMapGrid}>
        <div title="Before a show exists, grid pads add fixture profile rows. After fixtures exist, grid pads toggle physical fixture selection.">
          <strong>Clip grid</strong>
          <span>Add fixture rows or select patched fixtures 1-40</span>
        </div>
        <div title="These buttons select group 1-8 when groups exist, otherwise fixture 1-8.">
          <strong>Track Select</strong>
          <span>Select groups or the first eight fixtures</span>
        </div>
        <div title="Scene launch buttons load scenes 1-5. Empty slots capture the current DMX state into that slot.">
          <strong>Scene Launch</strong>
          <span>Load or capture scenes 1-5</span>
        </div>
        <div title="Record captures the current DMX state as a new named scene. Stop/Stop All clears fixture selection.">
          <strong>Record / Stop</strong>
          <span>Create a scene or clear selection</span>
        </div>
      </div>

      <div className={styles.apcCounts}>
        <span>{fixtureTemplates.filter((template) => template.id !== 'custom-blank').length} fixture profiles</span>
        <span>{fixtures.length} patched fixtures</span>
        <span>{groups.length} groups</span>
        <span>{scenes.length} scenes</span>
        <a href="/#/mobile" target="_blank" rel="noreferrer" title="Open the tablet/mobile remote control surface">
          Open tablet remote
        </a>
      </div>
    </section>
  );
};
